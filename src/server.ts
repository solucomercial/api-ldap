import fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import healthcheck from 'fastify-healthcheck';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import net from 'node:net'; 
import { env } from './config/env';
import { loginRoutes } from './routes/login';
import { lastLogonRoutes } from './routes/lastLogon';
import { notifyConnectionFailure } from './services/mail';

const app = fastify({ 
  logger: true,
  trustProxy: true, // Importante para Docker/Proxies reconhecerem IPs corretamente
  ajv: {
    customOptions: {
      strict: false,
      keywords: ['example']
    }
  }
});

// SEGURANÇA: Configuração robusta para evitar tela em branco no Docker
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // 'unsafe-eval' e worker-src são fundamentais para o motor do Scalar renderizar no navegador
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      workerSrc: ["'self'", "blob:"],
    },
  },
});

app.register(cors, { origin: true, methods: ['POST'] });
app.register(rateLimit, { max: 15, timeWindow: '1 minute' });

// DOCUMENTAÇÃO: Registro do motor (Configurado para auto-detectar o IP no Docker)
app.register(swagger, {
  openapi: {
    info: {
      title: 'API LDAP - Soluções',
      description: 'Documentação técnica para autenticação e relatórios de domínio.',
      version: '1.0.0',
    },
    // Deixamos sem o campo "servers" fixo para que o Swagger use o IP/Host atual de acesso automaticamente
  },
});

// ROTAS
app.register(loginRoutes);
app.register(lastLogonRoutes);

// INTERFACE: Scalar
app.register(scalar, {
  routePrefix: '/docs',
  configuration: {
    spec: {
      content: () => app.swagger(),
    },
    theme: 'purple',
    customCss: `
      :root { --scalar-primary: #004a99; }
      .dark-mode { --scalar-background-1: #020617; --scalar-background-2: #0f172a; }
    `,
  },
});

app.register(healthcheck, {
  healthcheckUrl: '/health',
  underPressureOptions: {
    healthCheckInterval: 5000,
    healthCheck: async () => {
      const ldapStatus = await checkLdapConnectivity(env.LDAP_URL);
      return ldapStatus.alive;
    }
  }
});

/**
 * Validação de conectividade TCP com o servidor LDAP
 */
function checkLdapConnectivity(url: string): Promise<{ alive: boolean; host: string; port: number }> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const host = parsedUrl.hostname;
      const port = parseInt(parsedUrl.port) || 389;
      const socket = new net.Socket();
      socket.setTimeout(3000);
      socket.on('connect', () => { socket.destroy(); resolve({ alive: true, host, port }); });
      socket.on('timeout', () => { socket.destroy(); resolve({ alive: false, host, port }); });
      socket.on('error', () => { socket.destroy(); resolve({ alive: false, host, port }); });
      socket.connect(port, host);
    } catch {
      resolve({ alive: false, host: 'invalid', port: 0 });
    }
  });
}

/**
 * Ciclo de monitoramento interno
 */
async function runHealthCheck() {
  const status = await checkLdapConnectivity(env.LDAP_URL);
  if (!status.alive) {
    await notifyConnectionFailure({
      host: status.host,
      port: status.port,
      error: "Timeout de conexão TCP"
    }).catch(err => app.log.error(err.message));
  }
}

// INICIALIZAÇÃO: Garantindo prontidão antes de abrir a porta
const start = async () => {
  try {
    await app.ready(); // Crucial para o Swagger gerar o JSON antes do primeiro acesso à documentação
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 API LDAP rodando em http://localhost:${env.PORT}`);
    
    await runHealthCheck();
    setInterval(runHealthCheck, 600000);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
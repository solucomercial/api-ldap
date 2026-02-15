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

// 1. INICIALIZAÇÃO: Suporte para 'example' na documentação e validação
const app = fastify({ 
  logger: true,
  ajv: {
    customOptions: {
      strict: false,
      keywords: ['example']
    }
  }
});

// 2. SEGURANÇA: Configuração do Helmet ajustada para permitir scripts/estilos do Scalar
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
    },
  },
});

app.register(cors, { origin: true, methods: ['POST'] });
app.register(rateLimit, { max: 15, timeWindow: '1 minute' });

// 3. DOCUMENTAÇÃO (MOTOR): Swagger deve ser registado antes das rotas
app.register(swagger, {
  openapi: {
    info: {
      title: 'API LDAP - Soluções',
      description: 'Documentação técnica para autenticação e relatórios de domínio.',
      version: '1.0.0',
    },
  },
});

// 4. ROTAS: O Swagger irá "escanear" os schemas destas rotas
app.register(loginRoutes);
app.register(lastLogonRoutes);

// 5. INTERFACE: Scalar a carregar a especificação do Swagger
app.register(scalar, {
  routePrefix: '/docs',
  configuration: {
    spec: {
      content: () => app.swagger(),
    },
    theme: 'purple',
    customCss: `
      :root {
        --scalar-primary: #004a99; /* Azul Soluções */
      }
      .dark-mode {
        --scalar-background-1: #020617; /* Slate 950 */
        --scalar-background-2: #0f172a;
      }
    `,
  },
});

// 6. MONITORIZAÇÃO: Rota /health com verificação de LDAP
app.register(healthcheck, {
  healthcheckUrl: '/health',
  exposeUptime: true,
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

      socket.on('connect', () => {
        socket.destroy();
        resolve({ alive: true, host, port });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ alive: false, host, port });
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({ alive: false, host, port });
      });

      socket.connect(port, host);
    } catch {
      resolve({ alive: false, host: 'invalid', port: 0 });
    }
  });
}

/**
 * Ciclo de monitorização interna para envio de alertas por e-mail
 */
async function runHealthCheck() {
  const status = await checkLdapConnectivity(env.LDAP_URL);
  if (!status.alive) {
    const errorMsg = "O servidor não respondeu ao teste de conexão TCP.";
    app.log.error(`🚨 ALERTA CRÍTICO: ${status.host}:${status.port} inacessível.`);
    
    await notifyConnectionFailure({
      host: status.host,
      port: status.port,
      error: errorMsg
    }).catch(err => 
      app.log.error(`Falha ao enviar e-mail de alerta: ${err.message}`)
    );
  } else {
    app.log.info(`✅ Conexão estável com o domínio ${env.LDAP_DOMAIN}.`);
  }
}

// 7. INICIALIZAÇÃO DO SERVIDOR
app.listen({ port: env.PORT, host: '0.0.0.0' })
  .then(async () => {
    console.log(`🚀 API LDAP rodando em http://localhost:${env.PORT}`);
    console.log(`📄 Documentação disponível em http://localhost:${env.PORT}/docs`);
    
    await runHealthCheck();
    setInterval(runHealthCheck, 600000); // Executa o check interno a cada 10 min
  })
  .catch(err => {
    app.log.error(err);
    process.exit(1);
  });
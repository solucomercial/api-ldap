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
  trustProxy: true, // Necessário para Docker identificar IPs
  ajv: {
    customOptions: {
      strict: false,
      keywords: ['example']
    }
  }
});

// SEGURANÇA: Liberando o Scalar no Docker (Obrigatório para não ficar branco)
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Adicionado 'unsafe-eval' e 'blob:' -> O Scalar precisa disso para rodar o motor de renderização
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      // Adicionado worker-src -> Permite que o Scalar processe o OpenAPI em segundo plano
      workerSrc: ["'self'", "blob:"],
    },
  },
});

app.register(cors, { origin: true, methods: ['POST', 'GET'] });
app.register(rateLimit, { max: 15, timeWindow: '1 minute' });

// DOCUMENTAÇÃO: Registro do motor Swagger
app.register(swagger, {
  openapi: {
    info: {
      title: 'API LDAP - Soluções',
      description: 'Documentação técnica de autenticação e relatórios.',
      version: '1.0.0',
    },
    // Removido o campo "servers" fixo para evitar erro de CORS/Mixed Content no Docker
  },
});

app.register(loginRoutes);
app.register(lastLogonRoutes);

app.register(scalar, {
  routePrefix: '/docs',
  configuration: {
    spec: {
      content: () => app.swagger(),
    },
    theme: 'purple',
    customCss: `:root { --scalar-primary: #004a99; }`,
  },
});

app.register(healthcheck, {
  healthcheckUrl: '/health',
  underPressureOptions: {
    healthCheckInterval: 5000,
    healthCheck: async () => {
      const status = await checkLdapConnectivity(env.LDAP_URL);
      return status.alive;
    }
  }
});

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

async function runHealthCheck() {
  const status = await checkLdapConnectivity(env.LDAP_URL);
  if (!status.alive) {
    await notifyConnectionFailure({
      host: status.host,
      port: status.port,
      error: "Falha de conectividade TCP no Docker"
    }).catch(err => app.log.error(err.message));
  }
}

const start = async () => {
  try {
    await app.ready(); // Garante que as rotas foram mapeadas antes de abrir o servidor
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
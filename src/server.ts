import fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import net from 'node:net'; 
import { env } from './config/env';
import { loginRoutes } from './routes/login';
import { lastLogonRoutes } from './routes/lastLogon';
import { notifyConnectionFailure } from './services/mail'; // Importação do serviço de e-mail

const app = fastify({ logger: true });

/**
 * Validação nativa de conectividade TCP
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
 * Ciclo de vida da monitoração com notificação por e-mail
 */
async function runHealthCheck() {
  const status = await checkLdapConnectivity(env.LDAP_URL);
  if (!status.alive) {
    const errorMessage = `Servidor de domínio ${status.host} (${env.LDAP_DOMAIN}) está inacessível.`;
    app.log.error(`🚨 ALERTA CRÍTICO: ${errorMessage}`);
    
    // Dispara o e-mail de alerta em caso de falha
    await notifyConnectionFailure(errorMessage).catch(err => 
      app.log.error(`Falha ao enviar e-mail de alerta: ${err.message}`)
    );
  } else {
    app.log.info(`✅ Conexão estável com o domínio ${env.LDAP_DOMAIN}.`);
  }
}

app.register(helmet);
app.register(cors, { origin: true, methods: ['POST'] });
app.register(rateLimit, { max: 15, timeWindow: '1 minute' });

app.register(loginRoutes);
app.register(lastLogonRoutes);

app.listen({ port: env.PORT, host: '0.0.0.0' })
  .then(async () => {
    console.log(`🚀 API LDAP rodando em http://localhost:${env.PORT}`);
    
    // Inicia monitoramento imediato e agenda a cada 10 min (600.000ms)
    await runHealthCheck();
    setInterval(runHealthCheck, 600000);
  })
  .catch(err => {
    app.log.error(err);
    process.exit(1);
  });
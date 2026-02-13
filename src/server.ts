import fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { loginRoutes } from './routes/login';
import { lastLogonRoutes } from './routes/lastLogon';

const app = fastify({ logger: true });

// Segurança de Cabeçalhos
app.register(helmet);

// Controle de Acesso (CORS)
app.register(cors, {
  origin: true, // Em produção, mude para seu domínio específico
  methods: ['POST']
});

// Prevenção de Força Bruta
app.register(rateLimit, {
  max: 15, 
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    message: 'Muitas requisições. Tente novamente em breve.'
  })
});

// Registro de Rotas
app.register(loginRoutes);
app.register(lastLogonRoutes);

app.listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => {
    console.log(`🚀 API Soluções rodando em http://localhost:${env.PORT}`);
  })
  .catch(err => {
    app.log.error(err);
    process.exit(1);
  });
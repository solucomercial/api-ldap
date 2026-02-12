import fastify from 'fastify';
import { env } from './config/env';
import { loginRoutes } from './routes/login';

const app = fastify({ logger: true });

app.register(loginRoutes);

app.listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => {
    console.log(`🚀 Auth API rodando em http://localhost:${env.PORT}`);
  });
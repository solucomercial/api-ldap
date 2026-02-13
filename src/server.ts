import fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { loginRoutes } from './routes/login';

const app = fastify({ 
  logger: true 
});

// 1. Configuração de Cabeçalhos de Segurança (Helmet)
app.register(helmet);

// 2. Configuração de CORS (Restringir quem pode chamar a API)
app.register(cors, {
  origin: true, // Em produção, altere para ['https://seu-dashboard.com.br']
  methods: ['POST']
});

// 3. Proteção contra Brute Force
app.register(rateLimit, {
  max: 10, // Máximo de 10 pedidos
  timeWindow: '1 minute', // Por minuto por IP
  errorResponseBuilder: () => {
    return { 
      statusCode: 429, 
      error: 'Too Many Requests', 
      message: 'Muitas tentativas de login. Tente novamente em 1 minuto.' 
    };
  }
});

app.register(loginRoutes);

app.listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => {
    console.log(`🚀 Auth API Segura rodando em http://localhost:${env.PORT}`);
  });
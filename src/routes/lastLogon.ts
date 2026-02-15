import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getLastLogonReport } from '../services/ldap';

export async function lastLogonRoutes(app: FastifyInstance) {
  app.post('/lastLogon/report', {
    schema: {
      description: 'Gera relatório de usuários inativos no domínio.',
      tags: ['Relatórios'],
      body: {
        type: 'object',
        required: ['username', 'password', 'days'],
        properties: {
          username: { type: 'string', description: 'Usuário administrador' },
          password: { type: 'string', format: 'password' },
          days: { type: 'number', minimum: 1, example: 90 }
        }
      },
      response: {
        200: {
          description: 'Lista de usuários inativos gerada',
          type: 'object',
          properties: {
            totalInativos: { type: 'number' },
            prazoDias: { type: 'number' },
            usuarios: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  lastLogon: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        400: {
          description: 'Dados inválidos na requisição',
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        403: {
          description: 'Erro de permissão administrativa',
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const reportSchema = z.object({
      username: z.string(),
      password: z.string(),
      days: z.number().min(1),
    });

    try {
      const { username, password, days } = reportSchema.parse(request.body);
      const result = await getLastLogonReport(username, password, days);

      if (!result.success) {
        return reply.status(403).send({ message: result.message });
      }

      return { 
        totalInativos: result.data?.length,
        prazoDias: days,
        usuarios: result.data 
      };
    } catch (err) {
      return reply.status(400).send({ message: 'Dados inválidos na requisição.' });
    }
  });
}
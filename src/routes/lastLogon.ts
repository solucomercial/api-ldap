import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getLastLogonReport } from '../services/ldap';

export async function lastLogonRoutes(app: FastifyInstance) {
  app.post('/lastLogon/report', async (request, reply) => {
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
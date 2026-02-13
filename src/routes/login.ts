import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { validateLDAPWithGroup } from '../services/ldap';

export async function loginRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const loginBodySchema = z.object({
      username: z.string(),
      password: z.string(),
      group: z.string(), // Novo campo obrigatório
    });

    const { username, password, group } = loginBodySchema.parse(request.body);

    const result = await validateLDAPWithGroup(username, password, group);

    if (!result.isValid) {
      return reply.status(401).send({ message: result.message });
    }

    const token = jwt.sign(
      { name: username, company: "Soluções", authorizedGroup: group },
      env.JWT_SECRET,
      { subject: username, expiresIn: '8h' }
    );

    return { token, user: { username, group } };
  });
}
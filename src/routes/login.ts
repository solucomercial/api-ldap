import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { validateLDAPCredentials } from '../services/ldap.js';

export async function loginRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const loginBodySchema = z.object({
      username: z.string(),
      password: z.string(),
    });

    const { username, password } = loginBodySchema.parse(request.body);

    const isValid = await validateLDAPCredentials(username, password);

    if (!isValid) {
      return reply.status(401).send({ message: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { name: username, company: "Soluções" },
      env.JWT_SECRET,
      { subject: username, expiresIn: '8h' }
    );

    return { token, user: { username } };
  });
}
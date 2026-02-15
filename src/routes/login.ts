import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { validateLDAPWithGroup } from '../services/ldap';

export async function loginRoutes(app: FastifyInstance) {
  app.post('/login', {
    schema: {
      description: 'Autentica um usuário no Active Directory e verifica permissão de grupo.',
      tags: ['Autenticação'],
      body: {
        type: 'object',
        required: ['username', 'password', 'group'],
        properties: {
          username: { type: 'string', example: 'joao.silva' },
          password: { type: 'string', format: 'password', example: 'senha123' },
          group: { type: 'string', description: 'Nome do grupo no AD', example: 'VPN_Users' }
        }
      },
      response: {
        200: {
          description: 'Sucesso',
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                group: { type: 'string' }
              }
            }
          }
        },
        401: {
          description: 'Não autorizado',
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const loginBodySchema = z.object({
      username: z.string(),
      password: z.string(),
      group: z.string(),
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
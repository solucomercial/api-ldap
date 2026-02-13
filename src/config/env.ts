import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  LDAP_URL: z.string().url(),
  LDAP_BASE_DN: z.string(),
  LDAP_DOMAIN: z.string().min(1), // Nova variável para o domínio (ex: solucoes.int)
  LDAP_BIND_USER: z.string(),
  LDAP_BIND_PASSWORD: z.string(),
  JWT_SECRET: z.string().min(32),
  PORT: z.string().default('3001').transform(Number),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Variáveis de ambiente inválidas:', _env.error.format());
  throw new Error('Variáveis de ambiente inválidas.');
}

export const env = _env.data;
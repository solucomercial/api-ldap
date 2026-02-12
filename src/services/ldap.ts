import ldap from 'ldapjs';
import { env } from '../config/env.js';

export async function validateLDAPCredentials(username: string, pass: string): Promise<boolean> {
  const client = ldap.createClient({ url: env.LDAP_URL });
  
  // O DN do usuário pode variar conforme sua estrutura de AD/LDAP
  const userDn = `uid=${username},${env.LDAP_BASE_DN}`;

  return new Promise((resolve) => {
    client.bind(userDn, pass, (err) => {
      client.destroy();
      if (err) {
        console.error(`❌ Falha de login para ${username}:`, err.message);
        return resolve(false);
      }
      resolve(true);
    });
  });
}
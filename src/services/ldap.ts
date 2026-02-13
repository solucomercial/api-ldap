import { EventEmitter } from 'events';
import ldap from 'ldapjs';
import { env } from '../config/env';

export async function validateLDAPWithGroup(
  username: string, 
  pass: string, 
  requiredGroup: string
): Promise<{ isValid: boolean; message?: string }> {
  const client = ldap.createClient({ url: env.LDAP_URL });
  
  // 1. Sanitização contra LDAP Injection
  // Remove caracteres que podem ser usados para manipular filtros LDAP
  const sanitizedUsername = username.replace(/[()|&*=]/g, '');
  const userDn = `uid=${sanitizedUsername},${env.LDAP_BASE_DN}`;

  return new Promise((resolve) => {
    client.bind(userDn, pass, (err: Error | null) => {
      if (err) {
        client.destroy();
        return resolve({ isValid: false, message: 'Usuário ou senha inválidos.' });
      }

      const opts: ldap.SearchOptions = {
        filter: `(uid=${sanitizedUsername})`,
        scope: 'sub',
        attributes: ['memberOf']
      };

      client.search(env.LDAP_BASE_DN, opts, (err: Error | null, res: EventEmitter) => {
        if (err) {
          client.destroy();
          return resolve({ isValid: false, message: 'Erro na consulta de permissões.' });
        }

        let userGroups: string[] = [];

        res.on('searchEntry', (entry: ldap.SearchEntry) => {
          const memberOf = entry.attributes.find((a: any) => a.type === 'memberOf');
          if (memberOf) {
            const values = Array.isArray(memberOf.values) ? memberOf.values : [memberOf.values];
            userGroups = values.map((v: any) => String(v).toLowerCase());
          }
        });

        res.on('end', () => {
          client.destroy();
          
          const hasGroup = userGroups.some(groupDn => 
            groupDn.includes(`cn=${requiredGroup.toLowerCase()}`)
          );

          if (!hasGroup) {
            return resolve({ isValid: false, message: 'Acesso negado: Grupo necessário não encontrado.' });
          }

          resolve({ isValid: true });
        });

        res.on('error', (err: Error) => {
          console.error('LDAP Stream Error:', err.message);
          client.destroy();
          resolve({ isValid: false, message: 'Falha na comunicação com o domínio.' });
        });
      });
    });
  });
}
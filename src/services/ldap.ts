import { EventEmitter } from 'events';
import ldap from 'ldapjs';
import { env } from '../config/env';

export async function validateLDAPWithGroup(
  username: string, 
  pass: string, 
  requiredGroup: string
): Promise<{ isValid: boolean; message?: string }> {
  const client = ldap.createClient({ url: env.LDAP_URL });
  
  const sanitizedUsername = username.replace(/[()|&*=]/g, '');
  
  // Monta o login no formato Windows (UPN) usando a variável de ambiente
  const userPrincipalName = `${sanitizedUsername}@${env.LDAP_DOMAIN}`;

  return new Promise((resolve) => {
    client.bind(userPrincipalName, pass, (err: Error | null) => {
      if (err) {
        console.error(`❌ Falha de autenticação para: ${userPrincipalName}`);
        console.error(`Motivo técnico: ${err.message}`);
        client.destroy();
        return resolve({ isValid: false, message: 'Usuário ou senha inválidos.' });
      }

      const opts: ldap.SearchOptions = {
        filter: `(sAMAccountName=${sanitizedUsername})`,
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
            console.warn(`⚠️ Usuário ${sanitizedUsername} logado, mas sem o grupo: ${requiredGroup}`);
            return resolve({ isValid: false, message: 'Acesso negado: Grupo necessário não encontrado.' });
          }
          resolve({ isValid: true });
        });

        res.on('error', (err: Error) => {
          client.destroy();
          resolve({ isValid: false, message: 'Falha na comunicação com o domínio.' });
        });
      });
    });
  });
}

export async function getLastLogonReport(
  adminUser: string,
  adminPass: string,
  daysInactive: number
): Promise<{ success: boolean; data?: any[]; message?: string }> {
  const client = ldap.createClient({ url: env.LDAP_URL });
  const adminUpn = `${adminUser.replace(/[()|&*=]/g, '')}@${env.LDAP_DOMAIN}`;

  return new Promise((resolve) => {
    client.bind(adminUpn, adminPass, (err: Error | null) => {
      if (err) {
        client.destroy();
        return resolve({ success: false, message: 'Autenticação do administrador falhou.' });
      }

      const adminSearchOpts: ldap.SearchOptions = {
        filter: `(sAMAccountName=${adminUser.replace(/[()|&*=]/g, '')})`,
        scope: 'sub',
        attributes: ['memberOf']
      };

      client.search(env.LDAP_BASE_DN, adminSearchOpts, (err: Error | null, res: EventEmitter) => {
        let isAdmin = false;
        res.on('searchEntry', (entry: ldap.SearchEntry) => {
          const memberOf = entry.attributes.find((a: any) => a.type === 'memberOf');
          if (memberOf) {
            const values = Array.isArray(memberOf.values) ? memberOf.values : [memberOf.values];
            isAdmin = values.some(v => String(v).toLowerCase().includes('cn=administrators'));
          }
        });

        res.on('end', () => {
          if (!isAdmin) {
            client.destroy();
            return resolve({ success: false, message: 'Acesso negado: Requer privilégios de administrador.' });
          }

          const thresholdDate = new Date();
          thresholdDate.setDate(thresholdDate.getDate() - daysInactive);
          const adTimestamp = (thresholdDate.getTime() + 11644473600000) * 10000;

          const reportOpts: ldap.SearchOptions = {
            filter: `(&(objectClass=user)(lastLogonTimestamp<=${adTimestamp}))`,
            scope: 'sub',
            attributes: ['cn', 'mail', 'lastLogonTimestamp']
          };

          const inactiveUsers: any[] = [];
          client.search(env.LDAP_BASE_DN, reportOpts, (err, reportRes: EventEmitter) => {
            reportRes.on('searchEntry', (entry: ldap.SearchEntry) => {
              const cn = entry.attributes.find((a: any) => a.type === 'cn')?.values[0];
              const mail = entry.attributes.find((a: any) => a.type === 'mail')?.values[0];
              const ts = entry.attributes.find((a: any) => a.type === 'lastLogonTimestamp')?.values[0];
              
              const lastLogonDate = ts ? new Date(Number(ts) / 10000 - 11644473600000) : 'Nunca';
              inactiveUsers.push({ name: cn, email: mail, lastLogon: lastLogonDate });
            });

            reportRes.on('end', () => {
              client.destroy();
              resolve({ success: true, data: inactiveUsers });
            });
          });
        });
      });
    });
  });
}
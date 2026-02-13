import { EventEmitter } from 'events';
import ldap from 'ldapjs';
import { env } from '../config/env';

/**
 * Valida as credenciais do usuário e verifica o pertencimento a um grupo específico no Active Directory.
 * Utiliza o formato UPN (usuario@dominio) para maior compatibilidade com ambientes Windows.
 */
export async function validateLDAPWithGroup(
  username: string, 
  pass: string, 
  requiredGroup: string
): Promise<{ isValid: boolean; message?: string }> {
  const client = ldap.createClient({ url: env.LDAP_URL });
  
  const sanitizedUsername = username.replace(/[()|&*=]/g, '');
  const userPrincipalName = `${sanitizedUsername}@${env.LDAP_DOMAIN}`;

  return new Promise((resolve) => {
    client.bind(userPrincipalName, pass, (err: Error | null) => {
      if (err) {
        console.error(`❌ Falha de autenticação (Bind) para: ${userPrincipalName}`);
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
            console.warn(`⚠️ Usuário ${sanitizedUsername} autenticado, mas não pertence ao grupo: ${requiredGroup}`);
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

/**
 * Gera relatório de usuários inativos que estão COM A CONTA ATIVA.
 * Informa explicitamente se o sizeLimit do servidor for excedido.
 */
export async function getLastLogonReport(
  adminUser: string,
  adminPass: string,
  daysInactive: number
): Promise<{ success: boolean; data?: any[]; message?: string }> {
  const client = ldap.createClient({ url: env.LDAP_URL });
  
  const sanitizedAdmin = adminUser.replace(/[()|&*=]/g, '');
  const adminUpn = `${sanitizedAdmin}@${env.LDAP_DOMAIN}`;

  return new Promise((resolve) => {
    client.bind(adminUpn, adminPass, (err: Error | null) => {
      if (err) {
        console.error(`❌ Falha no bind administrativo para relatório: ${adminUpn}`);
        client.destroy();
        return resolve({ success: false, message: 'Autenticação do administrador falhou.' });
      }

      const adminSearchOpts: ldap.SearchOptions = {
        filter: `(sAMAccountName=${sanitizedAdmin})`,
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
            filter: `(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2))(lastLogonTimestamp<=${adTimestamp}))`,
            scope: 'sub',
            attributes: ['cn', 'mail', 'lastLogonTimestamp']
          };

          const inactiveUsers: any[] = [];
          
          client.search(env.LDAP_BASE_DN, reportOpts, (err, reportRes: EventEmitter) => {
            if (err) {
              client.destroy();
              return resolve({ success: false, message: 'Erro ao iniciar a busca no servidor.' });
            }

            reportRes.on('searchEntry', (entry: ldap.SearchEntry) => {
              const cn = entry.attributes.find((a: any) => a.type === 'cn')?.values[0];
              const mail = entry.attributes.find((a: any) => a.type === 'mail')?.values[0];
              const ts = entry.attributes.find((a: any) => a.type === 'lastLogonTimestamp')?.values[0];
              
              const lastLogonDate = ts ? new Date(Number(ts) / 10000 - 11644473600000) : 'Nunca';
              inactiveUsers.push({ name: cn, email: mail, lastLogon: lastLogonDate });
            });

            // Tratamento específico para limite de tamanho excedido
            reportRes.on('error', (err: any) => {
              client.destroy();
              if (err.name === 'SizeLimitExceededError') {
                return resolve({ 
                  success: false, 
                  message: 'O limite de resultados do servidor LDAP foi excedido (MaxPageSize). A lista é muito grande para ser exibida sem paginação.' 
                });
              }
              resolve({ success: false, message: `Erro na consulta: ${err.message}` });
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
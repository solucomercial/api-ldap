import nodemailer from 'nodemailer';
import { env } from '../config/env';

/**
 * Configuração do transporte SMTP utilizando variáveis de ambiente
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Envia notificação de falha de conexão com a identidade visual da Soluções
 */
export async function notifyConnectionFailure(error: string) {
  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  await transporter.sendMail({
    from: `"Monitoramento API LDAP" <${process.env.SMTP_USER}>`,
    to: process.env.EMAIL_NOTIFICACAO,
    subject: "🚨 ALERTA CRÍTICO: Falha de Conexão LDAP",
    text: `Alerta de Sistema: A conexão com o LDAP falhou em ${date}. Erro: ${error}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #004a8d; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px;">
            Soluções Serviços Terceirizados
          </h1>
          <p style="color: #aec6cf; margin: 5px 0 0 0; font-size: 14px;">Departamento de Tecnologia da Informação</p>
        </div>

        <div style="padding: 30px; background-color: #ffffff;">
          <div style="background-color: #fff4f4; border-left: 4px solid #d9534f; padding: 15px; margin-bottom: 25px;">
            <h3 style="color: #d9534f; margin-top: 0;">🚨 Falha de Comunicação Detectada</h3>
            <p style="color: #333; font-size: 15px; line-height: 1.6;">
              O sistema de monitoramento automático identificou que o servidor <strong>LDAP/Active Directory</strong> está inacessível no momento.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666; width: 30%;"><strong>Data/Hora:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">${date}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;"><strong>Domínio:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">${env.LDAP_DOMAIN}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;"><strong>Detalhe do Erro:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #d9534f; font-family: monospace;">${error}</td>
            </tr>
          </table>

          <div style="margin-top: 30px; text-align: center;">
            <p style="color: #777; font-size: 13px;">
              Este incidente pode impactar autenticações de utilizadores e consultas de permissões na rede.
            </p>
          </div>
        </div>

        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 11px; margin: 0;">
            &copy; ${new Date().getFullYear()} Soluções Serviços Terceirizados. Todos os direitos reservados.<br>
            Este é um alerta automático gerado pela <strong>API LDAP-System</strong>.
          </p>
        </div>
      </div>
    `
  });
}
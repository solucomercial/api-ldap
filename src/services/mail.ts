import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT),
  secure: false, 
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Nova interface para os detalhes do erro
interface ErrorDetails {
  host: string;
  port: number;
  error: string;
}

export async function notifyConnectionFailure(details: ErrorDetails) {
  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  await transporter.sendMail({
    from: `"Monitoramento API LDAP" <${env.SMTP_USER}>`,
    to: env.EMAIL_NOTIFICACAO,
    subject: "🚨 ALERTA CRÍTICO: Falha de Conexão LDAP",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #004a8d; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px;">
            Soluções Serviços Terceirizados
          </h1>
        </div>

        <div style="padding: 30px; background-color: #ffffff;">
          <div style="background-color: #fff4f4; border-left: 4px solid #d9534f; padding: 15px; margin-bottom: 25px;">
            <h3 style="color: #d9534f; margin-top: 0;">🚨 Falha de Conexão Detectada</h3>
            <p style="color: #333; font-size: 15px;">O servidor <strong>LDAP</strong> está inacessível. Isso pode acarretar em interrupções nos serviços dependentes do domínio.</p>
          </div>

          <h4 style="color: #004a8d; border-bottom: 1px solid #eee; padding-bottom: 5px;">Informações do Servidor</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px; color: #666;"><strong>Hostname/IP:</strong></td>
              <td style="padding: 8px; color: #333;">${details.host}</td>
            </tr>
            <tr>
              <td style="padding: 8px; color: #666;"><strong>Porta:</strong></td>
              <td style="padding: 8px; color: #333;">${details.port}</td>
            </tr>
            <tr>
              <td style="padding: 8px; color: #666;"><strong>Domínio AD:</strong></td>
              <td style="padding: 8px; color: #333;">${env.LDAP_DOMAIN}</td>
            </tr>
          </table>

          <h4 style="color: #004a8d; border-bottom: 1px solid #eee; padding-bottom: 5px;">Detalhes do Incidente</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px; color: #666; width: 30%;"><strong>Data/Hora:</strong></td>
              <td style="padding: 8px; color: #333;">${date}</td>
            </tr>
            <tr>
              <td style="padding: 8px; color: #666;"><strong>Mensagem:</strong></td>
              <td style="padding: 8px; color: #d9534f; font-family: monospace;">${details.error}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 11px; margin: 0;">
            &copy; ${new Date().getFullYear()} Soluções Serviços Terceirizados. Todos os direitos reservados.<br> 
            Alerta automático da <strong>API-LDAP</strong>.
          </p>
        </div>
      </div>
    `
  });
}
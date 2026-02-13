import nodemailer from 'nodemailer';
import { env } from '../config/env';

// Configure com os dados do seu provedor (ex: Hostinger)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function notifyConnectionFailure(error: string) {
  await transporter.sendMail({
    from: `"Monitoramento API" <${process.env.SMTP_USER}>`,
    to: process.env.EMAIL_NOTIFICACAO,
    subject: "🚨 Falha de Comunicação: LDAP Down",
    text: `Alerta: A conexão com o LDAP falhou às ${new Date().toISOString()}. Erro: ${error}`,
    html: `<b>Alerta de Sistema</b><p>O serviço LDAP não está respondendo adequadamente.</p><p>Erro retornado: <code>${error}</code></p>`
  });
}
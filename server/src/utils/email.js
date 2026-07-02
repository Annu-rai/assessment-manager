import nodemailer from 'nodemailer';

/**
 * Email delivery (Module 13).
 *
 * Uses SMTP when EMAIL_HOST is configured; otherwise falls back to nodemailer's
 * jsonTransport, which serializes the message and logs it instead of sending —
 * so invites "work" in dev (the link is returned to the caller) without SMTP.
 */
export const isEmailConfigured = () => Boolean(process.env.EMAIL_HOST);

let transporter = null;

export function getTransport() {
  if (transporter) return transporter;
  if (isEmailConfigured()) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: process.env.EMAIL_USER
        ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        : undefined,
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  const from = process.env.EMAIL_FROM || 'Assessments <no-reply@assessments.local>';
  const info = await getTransport().sendMail({ from, to, subject, text, html });
  if (!isEmailConfigured()) {
    // Dev mode: make it visible that the email was logged, not delivered.
    console.log(`[email:dev] would send to ${to} — "${subject}"`);
  }
  return info;
}

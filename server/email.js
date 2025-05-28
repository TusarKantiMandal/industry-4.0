require('dotenv').config();
const nodemailer = require('nodemailer');

/**
 * Send an email using SMTP
 * @param {string|string[]} to - Recipient email address(es)
 * @param {string|string[]} cc - CC email address(es)
 * @param {string} subject - Email subject
 * @param {string} body - Email body (HTML or plain text)
 * @returns {Promise<void>}
 */
async function sendEmail({ to, cc, subject, body }) {
  // Configure the SMTP transporter
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Send the email
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    cc,
    subject,
    html: `${body}<br><br><div style="font-size:12px;color:#b9770e;background:#fffbe6;border-left:4px solid #f39c12;padding:6px 12px;margin-top:8px;border-radius:3px;"><strong>Note:</strong> This is an auto-generated email. Please do not reply to this message.</div>`
  });
  console.log(`Email sent to: ${to}${cc && cc.length ? ", cc: " + cc : ""}, subject: ${subject}`);
}

module.exports = { sendEmail };
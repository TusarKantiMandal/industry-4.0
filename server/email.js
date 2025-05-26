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
    html: body,
  });
  console.log(`Email sent to: ${to}${cc && cc.length ? ", cc: " + cc : ""}, subject: ${subject}`);
}

module.exports = { sendEmail };
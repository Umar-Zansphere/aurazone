const { Resend } = require('resend');
const ejs = require('ejs');
const path = require('path');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, template, data) => {
  try {
    // Construct the path to the main layout and the specific template
    const templatePath = path.join(__dirname, `../emails/templates/${template}.ejs`);
    const layoutPath = path.join(__dirname, '../emails/layout.ejs');

    // Render the specific email content first
    const content = await ejs.renderFile(templatePath, data);

    // Then, render the main layout, injecting the content
    const html = await ejs.renderFile(layoutPath, { body: content });

    const { data: emailData, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Error sending email via Resend:', error);
      throw new Error('Failed to send email.');
    }

    console.log(`Email sent successfully to: ${to} (Template: ${template}, ID: ${emailData.id})`)
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email.');
  }
};

module.exports = { sendEmail };
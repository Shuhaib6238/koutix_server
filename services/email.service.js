const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendBranchManagerInvitation(email, branchName, resetLink) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: `You've been invited to manage ${branchName}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Branch Manager Invitation</h2>
            <p>You have been invited to be the Branch Manager for <strong>${branchName}</strong>.</p>
            <p>To get started, please click the button below to reset your password and activate your account:</p>
            <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>If the button doesn't work, copy and paste the following link into your browser:</p>
            <p>${resetLink}</p>
            <hr>
            <p>Best regards,<br>Koutix Team</p>
          </div>
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email successfully sent to:', email, ' - ID:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ CRITICAL ERROR: Failed to send email to:', email);
      console.error('Error Details:', error.message);
      if (error.code === 'EAUTH') {
        console.error('SMTP Authentication failed. Check your EMAIL_USER and EMAIL_PASS.');
      }
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();

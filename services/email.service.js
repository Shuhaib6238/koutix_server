class EmailService {
  async sendBranchManagerInvitation(email, branchName, invitationLink) {
    // For now, just log to console
    // In production, integrate with SendGrid, AWS SES, or similar
    console.log(`
========================================
Branch Manager Invitation Email
========================================
To: ${email}
Subject: You've been invited to manage ${branchName}

You have been invited to be the Branch Manager for ${branchName}.

Click the link below to set your password and get started:
${invitationLink}

This link will expire in 7 days.
========================================
    `);
    
    return { success: true, message: 'Email logged to console' };
  }
}

module.exports = new EmailService();

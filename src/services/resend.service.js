/**
 * @file Resend.com email service — branch manager invite emails ONLY.
 * @description Sends styled HTML invite emails to new branch managers.
 */
const { Resend } = require("resend");
const logger = require("../utils/logger");

let resend = null;

/**
 * Initialize the Resend client.
 * @param {string} apiKey - Resend API key
 */
function initResend(apiKey) {
  if (!apiKey) {
    logger.warn(
      "⚠️  RESEND_API_KEY not set — invite emails will be logged only",
    );
    return;
  }
  resend = new Resend(apiKey);
  logger.info("✅ Resend email client initialized");
}

/**
 * Send branch manager invite email with styled HTML.
 * @param {object} params
 * @param {string} params.to - Manager email
 * @param {string} params.managerName
 * @param {string} params.chainName
 * @param {string} params.branchName
 * @param {string} params.inviteToken
 * @param {string} params.from - Sender address
 * @param {string} params.frontendUrl - Base URL for set-password page
 * @returns {Promise<object>}
 */
async function sendBranchInviteEmail({
  to,
  managerName,
  chainName,
  branchName,
  inviteToken,
  from,
  frontendUrl,
}) {
  const setPasswordUrl = `${frontendUrl}/set-password?token=${inviteToken}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5F5F5;font-family:Inter,system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F5F5F5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Top bar -->
          <tr>
            <td style="height:4px;background-color:#A9ED42;"></td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 36px;">
              <h1 style="margin:0 0 20px 0;font-size:22px;font-weight:600;color:#111111;">Hi ${managerName},</h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#444444;">
                <strong>${chainName}</strong> has set up your Koutix branch manager account
                for <strong>${branchName}</strong>. Click below to create your password
                and access your dashboard.
              </p>
              <!-- Button -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 32px 0;">
                <tr>
                  <td align="center" style="background-color:#A9ED42;border-radius:8px;">
                    <a href="${setPasswordUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#111111;text-decoration:none;">
                      Create Your Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#888888;">
                Link expires in 72 hours.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #EEEEEE;">
              <p style="margin:0;font-size:12px;color:#AAAAAA;text-align:center;">
                &copy; ${new Date().getFullYear()} Koutix
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  if (!resend) {
    logger.info(`📧 [DEV] Invite email to ${to}: ${setPasswordUrl}`);
    return { id: "dev-mock", to };
  }

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject: `Your branch manager account is ready — ${chainName}`,
      html,
    });
    logger.info(`📧 Invite email sent to ${to} — ID: ${result.data?.id}`);
    return result;
  } catch (err) {
    logger.error(`❌ Failed to send invite email to ${to}: ${err.message}`);
    throw err;
  }
}

module.exports = { initResend, sendBranchInviteEmail };

/**
 * @file Firebase Cloud Messaging (FCM) service.
 * @description Helper for sending push notifications to customers and staff.
 */
const { getMessaging } = require("../config/firebase");
const logger = require("../utils/logger");

/**
 * Send an FCM push notification.
 * @param {string} token - Device FCM token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} [data] - Optional metadata payload
 */
async function sendPushNotification(token, title, body, data = {}) {
  if (!token) {
    logger.warn("FCM push aborted: No device token provided");
    return false;
  }

  try {
    const message = {
      notification: { title, body },
      data: {
        ...data,
        click_action: "FLUTTER_NOTIFICATION_CLICK", // for flutter handling
      },
      token,
    };

    const response = await getMessaging().send(message);
    logger.info(
      `FCM message sent successfully to ${token.substring(0, 10)}... (Message ID: ${response})`,
    );
    return true;
  } catch (error) {
    logger.error(`FCM send failed: ${error.message}`);
    return false;
  }
}

module.exports = { sendPushNotification };

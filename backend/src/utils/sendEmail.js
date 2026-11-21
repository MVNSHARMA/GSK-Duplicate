import { BrevoClient } from "@getbrevo/brevo";

let brevoClient = null;
let cachedApiKey = null;

/**
 * Send an email using Brevo Transactional Email API
 * @param {Object} options - { to, subject, text, html, attachments }
 */
const sendEmail = async (options) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "GSK Automotive";
  
  // We keep the old config checks conditionally or just check Brevo ones
  if (!apiKey || !senderEmail) {
    const errMsg = "Brevo Configuration Missing. BREVO_API_KEY and BREVO_SENDER_EMAIL must be configured in .env";
    console.error(`[EMAIL ERROR]: ${errMsg}`);
    throw new Error(errMsg);
  }

  if (!brevoClient || cachedApiKey !== apiKey) {
    brevoClient = new BrevoClient({
      apiKey: apiKey
    });
    cachedApiKey = apiKey;
  }

  // Handle the old test email recipient fallback gracefully
  const finalRecipient = process.env.TEST_EMAIL_RECIPIENT || options.to;

  const emailPayload = {
    sender: {
      email: senderEmail,
      name: senderName
    },
    to: [
      {
        email: finalRecipient
      }
    ],
    subject: options.subject,
    htmlContent: options.html,
    textContent: options.text || options.html.replace(/<[^>]*>?/gm, ''), // fallback to stripped HTML if no text
  };

  if (Array.isArray(options.tags) && options.tags.length > 0) {
    emailPayload.tags = options.tags;
  }

  // Brevo sandbox mode: request is fully validated by Brevo but the email is NOT delivered.
  // Used by automated tests so they never send real mail.
  if (options.sandbox || process.env.BREVO_SANDBOX === 'true') {
    emailPayload.headers = { ...(emailPayload.headers || {}), 'X-Sib-Sandbox': 'drop' };
  }

  // Support reply-to
  const replyTo = process.env.BREVO_REPLY_TO_EMAIL || process.env.ADMIN_EMAIL;
  if (replyTo) {
    const match = replyTo.match(/(.*)<(.+?)>/);
    if (match) {
      emailPayload.replyTo = { 
        name: match[1].trim().replace(/^"|"$/g, '') || undefined,
        email: match[2].trim() 
      };
    } else {
      emailPayload.replyTo = { email: replyTo.trim() };
    }
  }

  // Map attachments if present
  if (options.attachments && options.attachments.length > 0) {
    emailPayload.attachment = options.attachments.map(att => {
      // Nodemailer attachments usually have: { filename, content (Buffer) }
      return {
        name: att.filename,
        content: att.content.toString('base64')
      };
    });
  }

  try {
    const info = await brevoClient.transactionalEmails.sendTransacEmail(emailPayload);
    // "Accepted" by Brevo — this is not proof of delivery.
    console.log(`[EMAIL ACCEPTED]: Brevo accepted message (${info.messageId}) for ${maskEmail(finalRecipient)}`);
    return info;
  } catch (error) {
    console.error(`[EMAIL ERROR]: Brevo rejected email for ${maskEmail(finalRecipient)}:`, error.message || error);
    throw error;
  }
};

/** Mask an email address for logs, e.g. jo***@gmail.com */
export const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '[no-email]';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};

/**
 * Look up Brevo transactional events (requests, delivered, bounces, blocked...) for a messageId.
 * Uses the same server-side BREVO_API_KEY. Returns [] if unavailable.
 */
export const getEmailDeliveryEvents = async (messageId) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || !messageId) return [];
  const url = `https://api.brevo.com/v3/smtp/statistics/events?messageId=${encodeURIComponent(messageId)}&limit=50`;
  const res = await fetch(url, { headers: { 'api-key': apiKey, accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Brevo events lookup failed with HTTP ${res.status}`);
  }
  const body = await res.json();
  return Array.isArray(body.events) ? body.events : [];
};

export default sendEmail;

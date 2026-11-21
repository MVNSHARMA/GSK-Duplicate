import { BrevoClient } from '@getbrevo/brevo';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const brevoClient = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
  console.log("transactionalEmails exists?", !!brevoClient.transactionalEmails);
  if (brevoClient.transactionalEmails) {
    console.log("sendTransacEmail exists?", !!brevoClient.transactionalEmails.sendTransacEmail);
  }
}
test().catch(console.error);

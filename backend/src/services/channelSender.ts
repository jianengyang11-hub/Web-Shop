import { Tenant } from "../models/types";

/** Best-effort outbound reply senders. Never throw — a webhook must always return 200 to Meta
 * regardless of whether sending a reply succeeded, and these run with whatever credentials the
 * Owner has entered in Settings, which may be missing, wrong, or a test value. This intentionally
 * sends only a fixed acknowledgement text — no message understanding/generation is implemented,
 * keeping the "no real AI agent" boundary intact. */

const GRAPH_API_VERSION = "v19.0";

export async function sendWhatsAppReply(tenant: Tenant, to: string, text: string): Promise<void> {
  if (!tenant.whatsappPhoneNumberId || !tenant.whatsappAccessToken) return;
  try {
    await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${tenant.whatsappPhoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tenant.whatsappAccessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
  } catch (err) {
    console.error("Failed to send WhatsApp reply", err);
  }
}

export async function sendMessengerReply(tenant: Tenant, recipientId: string, text: string): Promise<void> {
  if (!tenant.messengerAccessToken) return;
  try {
    await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(tenant.messengerAccessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
        }),
      }
    );
  } catch (err) {
    console.error("Failed to send Messenger reply", err);
  }
}

export const AUTO_ACK_MESSAGE = "ได้รับข้อความแล้วค่ะ ทางร้านจะติดต่อกลับโดยเร็วที่สุด";

import webpush from "web-push";
import { ENV } from "./_core/env";

// Chaves VAPID - geradas uma vez e armazenadas em variáveis de ambiente
function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || "mailto:admin@nutricrm.com.br";

  if (publicKey && privateKey) {
    return { publicKey, privateKey, email };
  }

  // Fallback: gerar chaves temporárias (somente dev - em produção use variáveis de ambiente)
  if (!ENV.isProduction) {
    const keys = webpush.generateVAPIDKeys();
    console.warn("[Push] VAPID keys not set. Generated temporary keys for dev. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL in production.");
    return { publicKey: keys.publicKey, privateKey: keys.privateKey, email };
  }

  throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in production.");
}

let vapidKeys: { publicKey: string; privateKey: string; email: string } | null = null;

function initWebPush() {
  if (vapidKeys) return vapidKeys;
  vapidKeys = getVapidKeys();
  webpush.setVapidDetails(vapidKeys.email, vapidKeys.publicKey, vapidKeys.privateKey);
  return vapidKeys;
}

export function getVapidPublicKey(): string {
  const keys = initWebPush();
  return keys.publicKey;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  type?: "nova_oportunidade" | "followup_pendente" | "orcamento_aprovado" | "geral";
}

export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ success: boolean; error?: string }> {
  initWebPush();

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icon-192x192.png",
    badge: payload.badge || "/icon-72x72.png",
    url: payload.url || "/",
    tag: payload.tag || "nutricrm",
    type: payload.type || "geral",
  });

  try {
    await webpush.sendNotification(pushSubscription, notificationPayload);
    return { success: true };
  } catch (err: any) {
    console.error("[Push] Failed to send notification:", err.message);
    return { success: false, error: err.message };
  }
}

export async function sendPushToUsers(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(sub, payload);
      if (result.success) sent++;
      else failed++;
    })
  );

  return { sent, failed };
}

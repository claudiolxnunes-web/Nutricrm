import Stripe from "stripe";
import { ENV } from "./_core/env";

export const stripe = new Stripe(ENV.stripeSecretKey || "sk_test_placeholder", {
  apiVersion: "2024-12-18.acacia",
});

export const PLANS = [
  {
    id: "mensal",
    name: "Plano Mensal",
    description: "Acesso por 30 dias",
    price: 9700,
    days: 30,
    label: "R$ 97/mes",
    badge: null,
  },
  {
    id: "semestral",
    name: "Plano Semestral",
    description: "Acesso por 6 meses",
    price: 49700,
    days: 180,
    label: "R$ 497",
    badge: "14% off",
  },
  {
    id: "anual",
    name: "Plano Anual",
    description: "Acesso por 12 meses",
    price: 89700,
    days: 365,
    label: "R$ 897",
    badge: "23% off",
  },
] as const;

export type PlanId = typeof PLANS[number]["id"];

export async function createCheckoutSession(userId: number, userEmail: string, planId: PlanId) {
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) throw new Error("Plano invalido");

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "boleto", "pix"],
    line_items: [{
      price_data: {
        currency: "brl",
        product_data: { name: plan.name, description: plan.description },
        unit_amount: plan.price,
      },
      quantity: 1,
    }],
    mode: "payment",
    success_url: `${ENV.appUrl}/dashboard?payment=success`,
    cancel_url: `${ENV.appUrl}/trial-expired?payment=cancelled`,
    customer_email: userEmail,
    metadata: {
      userId: String(userId),
      planId: plan.id,
      days: String(plan.days),
    },
    payment_intent_data: {
      description: `NutriCRM - ${plan.name}`,
    },
  });

  return { url: session.url, sessionId: session.id };
}

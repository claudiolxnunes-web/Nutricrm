import Stripe from "stripe";
import { ENV } from "./_core/env";

export const stripe = new Stripe(ENV.stripeSecretKey || "sk_test_placeholder", {
  apiVersion: "2026-03-25.dahlia",
});

export const PLAN_LIMITS: Record<string, number> = {
  individual: 1,
  equipe: 6,
  empresa: 21,
};

export const PLANS = [
  { id: "individual_mensal",   name: "Individual Mensal",   description: "1 usuario · 30 dias",                      price: 4900,   days: 30,  label: "R$ 49/mes",   badge: null,      tier: "individual", userLimit: 1  },
  { id: "individual_semestral",name: "Individual Semestral",description: "1 usuario · 6 meses",                      price: 24900,  days: 180, label: "R$ 249",      badge: "15% off", tier: "individual", userLimit: 1  },
  { id: "individual_anual",    name: "Individual Anual",    description: "1 usuario · 12 meses",                     price: 43900,  days: 365, label: "R$ 439",      badge: "25% off", tier: "individual", userLimit: 1  },
  { id: "equipe_mensal",       name: "Equipe Mensal",       description: "Admin + ate 5 representantes · 30 dias",   price: 14900,  days: 30,  label: "R$ 149/mes",  badge: null,      tier: "equipe",     userLimit: 6  },
  { id: "equipe_semestral",    name: "Equipe Semestral",    description: "Admin + ate 5 representantes · 6 meses",   price: 74900,  days: 180, label: "R$ 749",      badge: "16% off", tier: "equipe",     userLimit: 6  },
  { id: "equipe_anual",        name: "Equipe Anual",        description: "Admin + ate 5 representantes · 12 meses",  price: 134900, days: 365, label: "R$ 1.349",    badge: "25% off", tier: "equipe",     userLimit: 6  },
  { id: "empresa_mensal",      name: "Empresa Mensal",      description: "Admin + ate 20 representantes · 30 dias",  price: 34900,  days: 30,  label: "R$ 349/mes",  badge: null,      tier: "empresa",    userLimit: 21 },
  { id: "empresa_semestral",   name: "Empresa Semestral",   description: "Admin + ate 20 representantes · 6 meses",  price: 174900, days: 180, label: "R$ 1.749",    badge: "17% off", tier: "empresa",    userLimit: 21 },
  { id: "empresa_anual",       name: "Empresa Anual",       description: "Admin + ate 20 representantes · 12 meses", price: 314900, days: 365, label: "R$ 3.149",    badge: "25% off", tier: "empresa",    userLimit: 21 },
] as const;

export type PlanId = typeof PLANS[number]["id"];

export async function createCheckoutSession(userId: number, userEmail: string, planId: PlanId) {
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) throw new Error("Plano invalido");
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "boleto", "pix"],
    line_items: [{ price_data: { currency: "brl", product_data: { name: plan.name, description: plan.description }, unit_amount: plan.price }, quantity: 1 }],
    mode: "payment",
    success_url: `${ENV.appUrl}/dashboard?payment=success`,
    cancel_url: `${ENV.appUrl}/trial-expired?payment=cancelled`,
    customer_email: userEmail,
    metadata: { userId: String(userId), planId: plan.id, days: String(plan.days), tier: plan.tier },
    payment_intent_data: { description: `NutriCRM - ${plan.name}` },
  });
  return { url: session.url, sessionId: session.id };
}
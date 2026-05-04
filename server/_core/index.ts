import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import Stripe from "stripe";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { stripe } from "../stripe";
import { activateUser } from "../db";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Health check endpoint - diagnoses DB connectivity
  app.get("/api/health", async (_req, res) => {
    const status: Record<string, unknown> = {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_defined: !!process.env.DATABASE_URL,
        DATABASE_URL_prefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + "..." : null,
      },
    };

    try {
      const { Pool } = await import("pg");
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        status.database = { ok: false, error: "DATABASE_URL not defined" };
      } else {
        const testPool = new Pool({
          connectionString: dbUrl,
          ssl: dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")
            ? false
            : { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000,
          max: 1,
        });
        try {
          const client = await testPool.connect();
          const result = await client.query("SELECT version()");
          client.release();
          await testPool.end();
          status.database = { ok: true, version: result.rows[0]?.version ?? "unknown" };
        } catch (err: any) {
          await testPool.end().catch(() => {});
          status.database = { ok: false, error: err.message, code: err.code };
        }
      }
    } catch (importErr: any) {
      status.database = { ok: false, error: "pg import failed: " + importErr.message };
    }

    const httpStatus = (status.database as any)?.ok ? 200 : 503;
    res.status(httpStatus).json(status);
  });

  // Reset DB connection (useful to recover after transient errors)
  app.post("/api/health/reset-db", async (_req, res) => {
    const { resetDb } = await import("../db");
    resetDb();
    res.json({ ok: true, message: "DB connection reset - will reconnect on next query" });
  });

  // Stripe webhook - MUST be registered before express.json() to receive raw body
  app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    if (!ENV.stripeWebhookSecret) {
      console.warn("[Stripe] STRIPE_WEBHOOK_SECRET not configured - rejecting webhook");
      res.status(400).send("Webhook secret not configured");
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, ENV.stripeWebhookSecret);
    } catch (err: any) {
      console.error("[Stripe] Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = parseInt(session.metadata?.userId || "0");
        const days = parseInt(session.metadata?.days || "30");
        if (userId) {
          await activateUser(userId, days);
          console.log(`[Stripe] checkout.session.completed: activated user ${userId} for ${days} days`);
        }
      } else if (event.type === "invoice.paid") {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string | null;
        const customerId = invoice.customer as string;
        // Tenta recuperar userId pelo metadata da assinatura ou da sessão de checkout original
        let userId: number | null = null;
        let days = 30;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          userId = parseInt(subscription.metadata?.userId || "0") || null;
          days = parseInt(subscription.metadata?.days || "30");
        }
        if (!userId && customerId) {
          // Busca via email do cliente Stripe
          const customer = await stripe.customers.retrieve(customerId);
          if (customer && !customer.deleted && (customer as Stripe.Customer).email) {
            const { getUserByEmail } = await import("../db");
            const user = await getUserByEmail((customer as Stripe.Customer).email!);
            if (user) userId = user.id;
          }
        }
        if (userId) {
          await activateUser(userId, days);
          console.log(`[Stripe] invoice.paid: extended access for user ${userId} by ${days} days`);
        } else {
          console.warn(`[Stripe] invoice.paid: could not resolve userId for invoice ${invoice.id}`);
        }
      }
    } catch (handlerErr: any) {
      console.error(`[Stripe] Error handling event ${event.type}:`, handlerErr.message);
      // Retornar 200 para evitar reenvios desnecessários do Stripe
    }

    res.json({ received: true });
  });

  // Webhook legado mantido por compatibilidade
  app.post("/api/payments/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    if (!ENV.stripeWebhookSecret) {
      // No webhook secret configured - manual activation only
      res.json({ received: true });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, ENV.stripeWebhookSecret);
    } catch (err: any) {
      console.error("[Stripe] Webhook signature failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = parseInt(session.metadata?.userId || "0");
      const days = parseInt(session.metadata?.days || "30");
      if (userId) {
        await activateUser(userId, days);
        console.log(`[Stripe] Activated user ${userId} for ${days} days`);
      }
    }

    res.json({ received: true });
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

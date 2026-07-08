import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { sendPasswordResetEmail } from "../email";
import { ENV } from "./env";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

export function registerOAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email e senha sao obrigatorios" });
      return;
    }
    try {
      const user = await db.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Email ou senha invalidos" });
        return;
      }

      // Suporte a hashes legados SHA-256 e novos bcrypt
      let passwordValid = false;
      const isBcrypt = user.passwordHash.startsWith("$2");
      if (isBcrypt) {
        passwordValid = await bcrypt.compare(password, user.passwordHash);
      } else {
        // Hash legado SHA-256 com salt fixo
        const { createHash } = await import("crypto");
        const legacyHash = createHash("sha256").update(password + "nutricrm-salt").digest("hex");
        passwordValid = legacyHash === user.passwordHash;
        // Migrar para bcrypt automaticamente (nao interrompe o login se falhar)
        if (passwordValid) {
          try {
            const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
            await db.updateUserPasswordHash(user.id, newHash);
            console.log("[Auth] Migrated password hash to bcrypt for user", user.id);
          } catch (migrateErr) {
            console.warn("[Auth] Failed to migrate password hash, login continues", migrateErr);
          }
        }
      }

      if (!passwordValid) {
        res.status(401).json({ error: "Email ou senha invalidos" });
        return;
      }

      // Garantir que openId nunca seja null (usuários legados podem não ter openId no banco)
      let openId = user.openId as string | null | undefined;
      if (!openId) {
        openId = `local_${user.id}_${Date.now()}`;
        console.log("[Auth] User missing openId, generating:", openId, "for userId:", user.id);
        try {
          await db.updateUserOpenId(user.id, openId);
        } catch (e) {
          console.warn("[Auth] Could not persist generated openId, continuing anyway:", e);
        }
      }
      console.log("[Auth] createSessionToken for openId:", openId, "userId:", user.id);
      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error: any) {
      console.error("[Auth] Login failed:", error?.message ?? error, error?.stack ?? "");
      res.status(500).json({ error: "Erro interno", detail: process.env.NODE_ENV !== "production" ? error?.message : undefined });
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { name, email, password, companyName } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Nome, email e senha sao obrigatorios" });
      return;
    }
    if (!companyName) {
      res.status(400).json({ error: "Nome da empresa obrigatorio" });
      return;
    }
    try {
      const existing = await db.getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "Email ja cadastrado" });
        return;
      }
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const company = await db.createCompany({ name: companyName, email });
      const user = await db.createUserWithPassword({ name, email, passwordHash, companyId: company.id });
      await db.updateUserRole(user.id, "admin");
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error: any) {
      console.error("[Auth] Register failed:", error?.message ?? error, error?.stack ?? "");
      res.status(500).json({ error: "Erro interno", detail: error?.message });
    }
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email e obrigatorio" });
      return;
    }
    try {
      const user = await db.getUserByEmail(email);
      // Sempre responder com sucesso para nao vazar quais emails existem
      if (!user) {
        res.json({ success: true });
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await db.setPasswordResetToken(user.id, token, expiresAt);
      const resetUrl = `${ENV.appUrl}/reset-password?token=${token}`;
      try {
        await sendPasswordResetEmail({
          toEmail: user.email!,
          toName: user.name || "",
          resetUrl,
        });
      } catch (emailError) {
        console.error("[Auth] Failed to send password reset email:", emailError);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Auth] Forgot password failed:", error?.message ?? error, error?.stack ?? "");
      res.status(500).json({ error: "Erro interno" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: "Token e nova senha sao obrigatorios" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "A senha deve ter no minimo 6 caracteres" });
      return;
    }
    try {
      const user = await db.getUserByResetToken(token);
      if (!user || !user.resetPasswordExpiresAt || user.resetPasswordExpiresAt.getTime() < Date.now()) {
        res.status(400).json({ error: "Token invalido ou expirado" });
        return;
      }
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await db.updateUserPasswordHash(user.id, passwordHash);
      await db.clearPasswordResetToken(user.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Auth] Reset password failed:", error?.message ?? error, error?.stack ?? "");
      res.status(500).json({ error: "Erro interno" });
    }
  });
}


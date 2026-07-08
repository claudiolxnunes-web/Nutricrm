-- Migration: Adiciona colunas de reset de senha na tabela users
-- Created: 2026-07-08
-- Seguro para rodar múltiplas vezes: ADD COLUMN IF NOT EXISTS.
--
-- Uso: psql $DATABASE_URL -f drizzle/0012_password_reset.sql

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordToken" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordExpiresAt" timestamp;

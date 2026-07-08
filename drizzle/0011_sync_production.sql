-- Migration: Sincroniza banco de produção com o schema atual (drizzle/schema.ts)
-- Created: 2026-07-08
-- Motivo: produção ficou desatualizada; várias colunas/tabelas do schema
-- nunca foram migradas (herdProfile, productionSystem, métricas de sales,
-- pedidos_carteira, orcamentos_simples, etc.)
--
-- Seguro para rodar múltiplas vezes: todos os comandos usam
-- IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
--
-- Uso: psql $DATABASE_URL -f drizzle/0011_sync_production.sql

-- ============================================================
-- clients
-- ============================================================
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "externalCode" varchar(100);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "herdProfile" varchar(40);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "productionSystem" varchar(40);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "dailyMilkProduction" integer;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "monthlyFeedConsumptionKg" integer;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "pastureAreaHa" numeric(10, 2);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "confinementCapacity" integer;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "nutritionChallenges" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "lastPurchaseDate" timestamp;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "purchaseFrequencyDays" integer;

CREATE INDEX IF NOT EXISTS "cliCompanyExternalCodeIdx" ON "clients" ("companyId", "externalCode");

-- ============================================================
-- products
-- ============================================================
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "externalCode" varchar(100);

CREATE INDEX IF NOT EXISTS "prodCompanyExternalCodeIdx" ON "products" ("companyId", "externalCode");

-- ============================================================
-- companies
-- ============================================================
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "plan" varchar(20) DEFAULT 'individual' NOT NULL;

-- ============================================================
-- quoteItems
-- ============================================================
ALTER TABLE "quoteItems" ADD COLUMN IF NOT EXISTS "productName" varchar(255);
ALTER TABLE "quoteItems" ADD COLUMN IF NOT EXISTS "unit" varchar(50) DEFAULT 'saco';

-- ============================================================
-- interactions
-- ============================================================
ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "nextVisitDate" timestamp;
ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "visitResult" varchar(50);

-- ============================================================
-- sales (métricas financeiras, comerciais e de importação)
-- ============================================================
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "importKey" varchar(160);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "notaFiscal" varchar(50);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "pedidoNumber" varchar(50);

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "discountValue" numeric(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "discountPercent" numeric(5, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "bonusValue" numeric(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "bonusQuantity" integer DEFAULT 0;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "finalValue" numeric(12, 2) NOT NULL DEFAULT '0';

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "volumeSacos" numeric(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "volumeKg" numeric(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "precoPorKg" numeric(10, 2) DEFAULT '0';

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "custoTotal" numeric(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "despesaComercial" numeric(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "frete" numeric(12, 2) DEFAULT '0';

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "margemBrutaPercent" numeric(5, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "margemBrutaValor" numeric(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "margemLiquidaPercent" numeric(5, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "margemLiquidaValor" numeric(12, 2) DEFAULT '0';

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "comissaoPercent" numeric(5, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "comissaoValor" numeric(12, 2) DEFAULT '0';

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "icms" numeric(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "pis" numeric(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "cofins" numeric(12, 2) DEFAULT '0';

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "grupoProduto" text;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "solucao" text;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "subsolucao" text;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "linha" text;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "grv" text;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "gnv" text;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "filial" text;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "codigoCFOP" text;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "mesAno" text;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "ano" integer;

CREATE INDEX IF NOT EXISTS "salNotaFiscalIdx" ON "sales" ("notaFiscal");
CREATE INDEX IF NOT EXISTS "salPedidoIdx" ON "sales" ("pedidoNumber");
CREATE INDEX IF NOT EXISTS "salMesAnoIdx" ON "sales" ("mesAno");
CREATE INDEX IF NOT EXISTS "salAnoIdx" ON "sales" ("ano");
CREATE INDEX IF NOT EXISTS "salCompanyImportKeyIdx" ON "sales" ("companyId", "importKey");

-- ============================================================
-- pedidos_carteira (tabela nova, pedidos em carteira separados de vendas faturadas)
-- ============================================================
CREATE TABLE IF NOT EXISTS "pedidos_carteira" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer DEFAULT 1 NOT NULL,
	"importKey" varchar(160),
	"clientId" integer NOT NULL,
	"pedidoNumber" varchar(50) NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"totalValue" numeric(12, 2) NOT NULL,
	"qtdeSacos" integer DEFAULT 0,
	"precoSaco" numeric(10, 2),
	"dataPedido" timestamp NOT NULL,
	"dataPrevFaturamento" timestamp,
	"representante" text,
	"notaFiscal" varchar(50),
	"observacoes" text,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pedcart_client_idx" ON "pedidos_carteira" ("clientId");
CREATE INDEX IF NOT EXISTS "pedcart_status_idx" ON "pedidos_carteira" ("status");
CREATE INDEX IF NOT EXISTS "pedcart_pedido_idx" ON "pedidos_carteira" ("pedidoNumber");
CREATE INDEX IF NOT EXISTS "pedcart_company_import_key_idx" ON "pedidos_carteira" ("companyId", "importKey");

-- ============================================================
-- orcamentos_simples (tabela nova)
-- ============================================================
CREATE TABLE IF NOT EXISTS "orcamentos_simples" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"cliente_nome" text NOT NULL,
	"cliente_email" text,
	"produtos" jsonb NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'rascunho',
	"criado_em" timestamp DEFAULT now() NOT NULL
);

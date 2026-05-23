-- Migration: Adicionar campos de métricas financeiras à tabela sales
-- Created: 2026-05-23

-- Adicionar campos de identificação
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "notaFiscal" varchar(50);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "pedidoNumber" varchar(50);

-- Adicionar campos de métricas de volume
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "volumeSacos" decimal(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "volumeKg" decimal(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "precoPorKg" decimal(10, 2) DEFAULT '0';

-- Adicionar campos de custos operacionais
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "custoTotal" decimal(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "despesaComercial" decimal(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "frete" decimal(12, 2) DEFAULT '0';

-- Adicionar campos de margens
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "margemBrutaPercent" decimal(5, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "margemBrutaValor" decimal(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "margemLiquidaPercent" decimal(5, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "margemLiquidaValor" decimal(12, 2) DEFAULT '0';

-- Adicionar campos de comissões
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "comissaoPercent" decimal(5, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "comissaoValor" decimal(12, 2) DEFAULT '0';

-- Adicionar campos de impostos
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "icms" decimal(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "pis" decimal(12, 2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "cofins" decimal(12, 2) DEFAULT '0';

-- Adicionar campos de classificação
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

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS "salNotaFiscalIdx" ON "sales" ("notaFiscal");
CREATE INDEX IF NOT EXISTS "salPedidoIdx" ON "sales" ("pedidoNumber");
CREATE INDEX IF NOT EXISTS "salMesAnoIdx" ON "sales" ("mesAno");
CREATE INDEX IF NOT EXISTS "salAnoIdx" ON "sales" ("ano");

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "externalCode" varchar(100);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "externalCode" varchar(100);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "importKey" varchar(160);
ALTER TABLE "pedidos_carteira" ADD COLUMN IF NOT EXISTS "importKey" varchar(160);

CREATE INDEX IF NOT EXISTS "cliCompanyExternalCodeIdx" ON "clients" ("companyId", "externalCode");
CREATE INDEX IF NOT EXISTS "prodCompanyExternalCodeIdx" ON "products" ("companyId", "externalCode");
CREATE INDEX IF NOT EXISTS "salCompanyImportKeyIdx" ON "sales" ("companyId", "importKey");
CREATE INDEX IF NOT EXISTS "pedcart_company_import_key_idx" ON "pedidos_carteira" ("companyId", "importKey");
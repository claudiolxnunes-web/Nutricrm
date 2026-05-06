CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"endpoint" text NOT NULL UNIQUE,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "push_subs_user_idx" ON "push_subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "push_subs_company_idx" ON "push_subscriptions" ("company_id");
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "plan" varchar(20) DEFAULT 'individual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "nextVisitDate" timestamp;
--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN IF NOT EXISTS "visitResult" varchar(50);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "openId" varchar(64);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "createdBy" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  BEGIN ALTER TABLE "clients" ADD COLUMN "clientType" varchar(50) DEFAULT 'fazenda' NOT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;

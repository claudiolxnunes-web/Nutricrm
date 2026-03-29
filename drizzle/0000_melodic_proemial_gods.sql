CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientType" varchar(50) DEFAULT 'fazenda' NOT NULL,
	"farmName" varchar(255) NOT NULL,
	"producerName" varchar(255) NOT NULL,
	"email" varchar(320),
	"phone" varchar(20),
	"whatsapp" varchar(20),
	"animalType" text NOT NULL,
	"animalQuantity" integer DEFAULT 0,
	"address" text,
	"city" varchar(100),
	"state" varchar(2),
	"zipCode" varchar(10),
	"notes" text,
	"status" text DEFAULT 'prospect' NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"opportunityId" integer,
	"type" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"date" timestamp NOT NULL,
	"duration" integer,
	"result" text,
	"nextAction" text,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"stage" text DEFAULT 'prospeccao' NOT NULL,
	"value" numeric(12, 2),
	"probability" integer DEFAULT 0,
	"expectedCloseDate" timestamp,
	"closedDate" timestamp,
	"assignedTo" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"stock" integer DEFAULT 0,
	"unit" varchar(50) DEFAULT 'kg',
	"active" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quoteItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"quoteId" integer NOT NULL,
	"productId" integer NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unitPrice" numeric(10, 2) NOT NULL,
	"totalPrice" numeric(12, 2) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"opportunityId" integer,
	"clientId" integer NOT NULL,
	"quoteNumber" varchar(50) NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"totalValue" numeric(12, 2) DEFAULT '0',
	"discount" numeric(10, 2) DEFAULT '0',
	"finalValue" numeric(12, 2) DEFAULT '0',
	"validityDays" integer DEFAULT 30,
	"notes" text,
	"createdBy" integer NOT NULL,
	"sentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_quoteNumber_unique" UNIQUE("quoteNumber")
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"opportunityId" integer,
	"clientId" integer NOT NULL,
	"quoteId" integer,
	"saleNumber" varchar(50) NOT NULL,
	"totalValue" numeric(12, 2) NOT NULL,
	"paymentStatus" text DEFAULT 'pendente' NOT NULL,
	"saleDate" timestamp NOT NULL,
	"deliveryDate" timestamp,
	"notes" text,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_saleNumber_unique" UNIQUE("saleNumber")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"passwordHash" text,
	"role" text DEFAULT 'vendedor' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE INDEX "cliCreatedByIdx" ON "clients" USING btree ("createdBy");--> statement-breakpoint
CREATE INDEX "cliStatusIdx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "intClientIdIdx" ON "interactions" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "intTypeIdx" ON "interactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "oppClientIdIdx" ON "opportunities" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "oppStageIdx" ON "opportunities" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "prodCategoryIdx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "qiQuoteIdIdx" ON "quoteItems" USING btree ("quoteId");--> statement-breakpoint
CREATE INDEX "qtClientIdIdx" ON "quotes" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "qtStatusIdx" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "salClientIdIdx" ON "sales" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "salPaymentStatusIdx" ON "sales" USING btree ("paymentStatus");
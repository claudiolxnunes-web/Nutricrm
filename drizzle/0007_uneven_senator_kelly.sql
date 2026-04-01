CREATE TABLE "monthly_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer DEFAULT 1 NOT NULL,
	"userId" integer,
	"month" varchar(7) NOT NULL,
	"goalValue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "monthly_goals_idx" ON "monthly_goals" USING btree ("companyId","month");
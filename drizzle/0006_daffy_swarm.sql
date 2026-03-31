ALTER TABLE "clients" ADD COLUMN "score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "lat" numeric(10, 6);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "lng" numeric(10, 6);
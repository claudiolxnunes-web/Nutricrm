ALTER TABLE "products" ADD COLUMN "productCode" varchar(50);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "packaging" varchar(20) DEFAULT 'saco';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "bagWeight" varchar(50);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "species" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "phase" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "indication" varchar(255);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "usageMode" varchar(255);
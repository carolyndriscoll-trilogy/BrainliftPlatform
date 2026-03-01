ALTER TABLE "brainlifts" ADD COLUMN "purpose_what_learning" text;--> statement-breakpoint
ALTER TABLE "brainlifts" ADD COLUMN "purpose_why_matters" text;--> statement-breakpoint
ALTER TABLE "brainlifts" ADD COLUMN "purpose_what_able_to_do" text;--> statement-breakpoint
ALTER TABLE "brainlifts" ADD COLUMN "build_phase" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "experts" ADD COLUMN "who" text;--> statement-breakpoint
ALTER TABLE "experts" ADD COLUMN "focus" text;--> statement-breakpoint
ALTER TABLE "experts" ADD COLUMN "why" text;--> statement-breakpoint
ALTER TABLE "experts" ADD COLUMN "where" text;--> statement-breakpoint
ALTER TABLE "experts" ADD COLUMN "draft_status" text DEFAULT 'draft';
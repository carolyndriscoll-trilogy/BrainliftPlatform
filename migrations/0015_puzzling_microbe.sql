CREATE TABLE "dok4_coe_model_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"model" text NOT NULL,
	"model_family" text NOT NULL,
	"axis_scores" jsonb NOT NULL,
	"ownership_assessment" text,
	"feedback" text,
	"status" text DEFAULT 'pending',
	"error" text,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dok4_dok2_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"dok2_summary_id" integer NOT NULL,
	CONSTRAINT "dok4_dok2_links_unique" UNIQUE("submission_id","dok2_summary_id")
);
--> statement-breakpoint
CREATE TABLE "dok4_dok3_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"dok3_insight_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false,
	CONSTRAINT "dok4_dok3_links_unique" UNIQUE("submission_id","dok3_insight_id")
);
--> statement-breakpoint
CREATE TABLE "dok4_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"brainlift_id" integer NOT NULL,
	"text" text NOT NULL,
	"status" text DEFAULT 'draft',
	"current_step" text,
	"rejection_reason" text,
	"rejection_category" text,
	"validated_at" timestamp,
	"foundation_integrity_index" text,
	"dok1_component_score" text,
	"dok2_component_score" text,
	"dok3_component_score" text,
	"foundation_ceiling" integer,
	"traceability_status" text,
	"traceability_is_borrowed" boolean,
	"traceability_flagged_source" text,
	"traceability_overlap_summary" text,
	"quality_score_raw" integer,
	"quality_score_final" integer,
	"quality_criteria" jsonb,
	"s2_divergence_classification" text,
	"s2_vanilla_response" text,
	"position_summary" text,
	"framework_dependency" text,
	"key_evidence" jsonb,
	"vulnerability_points" jsonb,
	"quality_rationale" text,
	"quality_feedback" text,
	"quality_evaluator_model" text,
	"ownership_assessment_score" integer,
	"coe_per_axis_scores" jsonb,
	"coe_conjunctive_failure" boolean DEFAULT false,
	"coe_conjunctive_failure_axis" text,
	"coe_evaluation_tier" text,
	"coe_adjustment" integer,
	"confidence_level" text,
	"conversion_text" text,
	"conversion_rationale" text,
	"conversion_score" integer,
	"conversion_criteria" jsonb,
	"conversion_feedback" text,
	"conversion_evaluator_model" text,
	"conversion_submitted_at" timestamp,
	"conversion_graded_at" timestamp,
	"needs_recalculation" boolean DEFAULT false,
	"recalculation_reason" text,
	"recalculation_triggered_at" timestamp,
	"error_code" text,
	"error_detail" text,
	"retry_count" integer DEFAULT 0,
	"last_attempt_at" timestamp,
	"graded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dok4_coe_model_scores" ADD CONSTRAINT "dok4_coe_model_scores_submission_id_dok4_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."dok4_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dok4_dok2_links" ADD CONSTRAINT "dok4_dok2_links_submission_id_dok4_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."dok4_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dok4_dok2_links" ADD CONSTRAINT "dok4_dok2_links_dok2_summary_id_dok2_summaries_id_fk" FOREIGN KEY ("dok2_summary_id") REFERENCES "public"."dok2_summaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dok4_dok3_links" ADD CONSTRAINT "dok4_dok3_links_submission_id_dok4_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."dok4_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dok4_dok3_links" ADD CONSTRAINT "dok4_dok3_links_dok3_insight_id_dok3_insights_id_fk" FOREIGN KEY ("dok3_insight_id") REFERENCES "public"."dok3_insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dok4_submissions" ADD CONSTRAINT "dok4_submissions_brainlift_id_brainlifts_id_fk" FOREIGN KEY ("brainlift_id") REFERENCES "public"."brainlifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dok4_dok2_links_submission" ON "dok4_dok2_links" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_dok4_dok3_links_submission" ON "dok4_dok3_links" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_dok4_dok3_links_dok3" ON "dok4_dok3_links" USING btree ("dok3_insight_id");--> statement-breakpoint
CREATE INDEX "idx_dok4_submissions_brainlift" ON "dok4_submissions" USING btree ("brainlift_id");
ALTER TABLE "brainlift_versions" DROP CONSTRAINT "brainlift_versions_brainlift_id_brainlifts_id_fk";
--> statement-breakpoint
ALTER TABLE "contradiction_clusters" DROP CONSTRAINT "contradiction_clusters_brainlift_id_brainlifts_id_fk";
--> statement-breakpoint
ALTER TABLE "dok2_fact_relations" DROP CONSTRAINT "dok2_fact_relations_summary_id_dok2_summaries_id_fk";
--> statement-breakpoint
ALTER TABLE "dok2_fact_relations" DROP CONSTRAINT "dok2_fact_relations_fact_id_facts_id_fk";
--> statement-breakpoint
ALTER TABLE "dok2_points" DROP CONSTRAINT "dok2_points_summary_id_dok2_summaries_id_fk";
--> statement-breakpoint
ALTER TABLE "dok2_summaries" DROP CONSTRAINT "dok2_summaries_brainlift_id_brainlifts_id_fk";
--> statement-breakpoint
ALTER TABLE "experts" DROP CONSTRAINT "experts_brainlift_id_brainlifts_id_fk";
--> statement-breakpoint
ALTER TABLE "fact_model_scores" DROP CONSTRAINT "fact_model_scores_verification_id_fact_verifications_id_fk";
--> statement-breakpoint
ALTER TABLE "fact_redundancy_groups" DROP CONSTRAINT "fact_redundancy_groups_brainlift_id_brainlifts_id_fk";
--> statement-breakpoint
ALTER TABLE "fact_verifications" DROP CONSTRAINT "fact_verifications_fact_id_facts_id_fk";
--> statement-breakpoint
ALTER TABLE "facts" DROP CONSTRAINT "facts_brainlift_id_brainlifts_id_fk";
--> statement-breakpoint
ALTER TABLE "llm_feedback" DROP CONSTRAINT "llm_feedback_verification_id_fact_verifications_id_fk";
--> statement-breakpoint
ALTER TABLE "llm_feedback" DROP CONSTRAINT "llm_feedback_fact_id_facts_id_fk";
--> statement-breakpoint
ALTER TABLE "brainlift_versions" ADD CONSTRAINT "brainlift_versions_brainlift_id_brainlifts_id_fk" FOREIGN KEY ("brainlift_id") REFERENCES "public"."brainlifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradiction_clusters" ADD CONSTRAINT "contradiction_clusters_brainlift_id_brainlifts_id_fk" FOREIGN KEY ("brainlift_id") REFERENCES "public"."brainlifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dok2_fact_relations" ADD CONSTRAINT "dok2_fact_relations_summary_id_dok2_summaries_id_fk" FOREIGN KEY ("summary_id") REFERENCES "public"."dok2_summaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dok2_fact_relations" ADD CONSTRAINT "dok2_fact_relations_fact_id_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."facts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dok2_points" ADD CONSTRAINT "dok2_points_summary_id_dok2_summaries_id_fk" FOREIGN KEY ("summary_id") REFERENCES "public"."dok2_summaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dok2_summaries" ADD CONSTRAINT "dok2_summaries_brainlift_id_brainlifts_id_fk" FOREIGN KEY ("brainlift_id") REFERENCES "public"."brainlifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experts" ADD CONSTRAINT "experts_brainlift_id_brainlifts_id_fk" FOREIGN KEY ("brainlift_id") REFERENCES "public"."brainlifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_model_scores" ADD CONSTRAINT "fact_model_scores_verification_id_fact_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."fact_verifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_redundancy_groups" ADD CONSTRAINT "fact_redundancy_groups_brainlift_id_brainlifts_id_fk" FOREIGN KEY ("brainlift_id") REFERENCES "public"."brainlifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_verifications" ADD CONSTRAINT "fact_verifications_fact_id_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."facts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_brainlift_id_brainlifts_id_fk" FOREIGN KEY ("brainlift_id") REFERENCES "public"."brainlifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_feedback" ADD CONSTRAINT "llm_feedback_verification_id_fact_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."fact_verifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_feedback" ADD CONSTRAINT "llm_feedback_fact_id_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."facts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_brainlift_versions_brainlift_id" ON "brainlift_versions" USING btree ("brainlift_id");--> statement-breakpoint
CREATE INDEX "idx_contradiction_clusters_brainlift_id" ON "contradiction_clusters" USING btree ("brainlift_id");--> statement-breakpoint
CREATE INDEX "idx_dok2_fact_relations_summary_id" ON "dok2_fact_relations" USING btree ("summary_id");--> statement-breakpoint
CREATE INDEX "idx_dok2_fact_relations_fact_id" ON "dok2_fact_relations" USING btree ("fact_id");--> statement-breakpoint
CREATE INDEX "idx_dok2_points_summary_id" ON "dok2_points" USING btree ("summary_id");--> statement-breakpoint
CREATE INDEX "idx_dok2_summaries_brainlift_id" ON "dok2_summaries" USING btree ("brainlift_id");--> statement-breakpoint
CREATE INDEX "idx_experts_brainlift_id" ON "experts" USING btree ("brainlift_id");--> statement-breakpoint
CREATE INDEX "idx_fact_model_scores_verification_id" ON "fact_model_scores" USING btree ("verification_id");--> statement-breakpoint
CREATE INDEX "idx_fact_redundancy_groups_brainlift_id" ON "fact_redundancy_groups" USING btree ("brainlift_id");--> statement-breakpoint
CREATE INDEX "idx_fact_verifications_fact_id" ON "fact_verifications" USING btree ("fact_id");--> statement-breakpoint
CREATE INDEX "idx_facts_brainlift_id" ON "facts" USING btree ("brainlift_id");--> statement-breakpoint
CREATE INDEX "idx_llm_feedback_fact_id" ON "llm_feedback" USING btree ("fact_id");
import { pgTable, text, serial, integer, jsonb, boolean, timestamp, varchar, index, unique, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";


// === AUTH TABLES (Better Auth) ===

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  // Better Auth admin plugin fields
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Better Auth admin plugin field
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// === TABLE DEFINITIONS ===

// Classification enum values
export const CLASSIFICATION = {
  BRAINLIFT: 'brainlift',
  PARTIAL: 'partial',
  NOT_BRAINLIFT: 'not_brainlift'
} as const;

export type Classification = typeof CLASSIFICATION[keyof typeof CLASSIFICATION];

export const brainlifts = pgTable("brainlifts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  displayPurpose: text("display_purpose"),  // Short UI-friendly summary of purpose
  author: text("author"),
  createdByUserId: text("created_by_user_id").references(() => user.id), // Nullable for legacy/public brainlifts
  classification: text("classification").$type<Classification>().default('brainlift').notNull(),
  rejectionReason: text("rejection_reason"),
  rejectionSubtype: text("rejection_subtype"),
  rejectionRecommendation: text("rejection_recommendation"),
  flags: text("flags").array(),
  improperlyFormatted: boolean("improperly_formatted").default(false).notNull(),
  originalContent: text("original_content"),
  sourceType: text("source_type"),
  coverImageUrl: text("cover_image_url"),  // AI-generated cover image stored in S3
  expertDiagnostics: jsonb("expert_diagnostics").$type<{
    isValid: boolean;
    diagnostics: Array<{
      code: string;
      severity: 'error' | 'warning' | 'info';
      message: string;
      details?: string;
      affectedExperts?: string[];
    }>;
    summary: {
      expertsFound: number;
      expertsWithStructuredFields: number;
      expertsWithSocialLinks: number;
      hasRequiredFields: boolean;
    };
  }>(),
  summary: jsonb("summary").$type<{
    totalFacts: number;
    meanScore: string;
    score5Count: number;
    contradictionCount: number;
  }>().notNull(),
  // Import Agent fields
  importStatus: text("import_status").$type<ImportStatus>().default('pending'),
  importHierarchy: jsonb("import_hierarchy"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("brainlifts_created_by_user_id_idx").on(table.createdByUserId),
]);

export const facts = pgTable("facts", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  originalId: text("original_id").notNull(), // The string ID from JSON like "6.1"
  category: text("category").notNull(),
  source: text("source"), // Citation or source reference
  fact: text("fact").notNull(),
  summary: text("summary"), // 3-line max AI summary
  score: integer("score").notNull(),
  contradicts: text("contradicts"), // Cluster name or null
  note: text("note"), // Explanation for the score
  flags: text("flags").array(), // New column for flags like "Incomplete/Unverifiable"
  isGradeable: boolean("is_gradeable").default(true).notNull(),
}, (table) => [
  index("idx_facts_brainlift_id").on(table.brainliftId),
]);

export const contradictionClusters = pgTable("contradiction_clusters", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tension: text("tension").notNull(),
  status: text("status").notNull(),
  factIds: text("fact_ids").array().notNull(),
  claims: text("claims").array().notNull(),
}, (table) => [
  index("idx_contradiction_clusters_brainlift_id").on(table.brainliftId),
]);

export const brainliftVersions = pgTable("brainlift_versions", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sourceType: text("source_type").notNull(), // "html", "workflowy", "googledocs"
  snapshot: jsonb("snapshot").$type<{
    title: string;
    description: string;
    author: string | null;
    summary: { totalFacts: number; meanScore: string; score5Count: number; contradictionCount: number };
    facts: Array<{ originalId: string; category: string; source: string | null; fact: string; score: number; contradicts: string | null; note: string | null }>;
    contradictionClusters: Array<{ name: string; tension: string; status: string; factIds: string[]; claims: string[] }>;
    readingList: Array<{ type: string; author: string; topic: string; time: string; facts: string; url: string }>;
    grades: Array<{ readingListTopic: string; aligns: string | null; contradicts: string | null; newInfo: string | null; quality: number | null }>;
  }>().notNull(),
}, (table) => [
  index("idx_brainlift_versions_brainlift_id").on(table.brainliftId),
]);

export const experts = pgTable("experts", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rankScore: integer("rank_score"), // 1-10 impact score (null if unranked)
  rationale: text("rationale"), // One-line explanation for ranking (null if unranked)
  source: text("source").notNull(), // "listed" (from brainlift) or "verification" (from fact notes)
  twitterHandle: text("twitter_handle"), // Optional X/Twitter handle
  isFollowing: boolean("is_following").notNull().default(true), // Auto-follow if rank > 5
}, (table) => [
  index("idx_experts_brainlift_id").on(table.brainliftId),
]);

// Brainlift Sharing - User-specific and token-based access control
export const brainliftShares = pgTable("brainlift_shares", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  type: text("type").notNull().$type<'user' | 'token'>(),
  permission: text("permission").notNull().$type<'viewer' | 'editor'>(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  token: text("token").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [
  // Indexes
  index("idx_brainlift_shares_brainlift_id").on(table.brainliftId),
  index("idx_brainlift_shares_user_id").on(table.userId).where(sql`${table.userId} IS NOT NULL`),
  index("idx_brainlift_shares_token").on(table.token).where(sql`${table.token} IS NOT NULL`),

  // Constraints
  unique("unique_user_share").on(table.brainliftId, table.userId),

  // CHECK constraints
  check("valid_type", sql`${table.type} IN ('user', 'token')`),
  check("valid_permission", sql`${table.permission} IN ('viewer', 'editor')`),
  check("user_share_has_user_id", sql`
    (${table.type} = 'user' AND ${table.userId} IS NOT NULL AND ${table.token} IS NULL) OR
    (${table.type} = 'token' AND ${table.token} IS NOT NULL AND ${table.userId} IS NULL)
  `),
]);

// LLM Models for Fact Verification - Gemini primary, Qwen fallback
export const LLM_MODELS = {
  GEMINI_FLASH: 'google/gemini-2.0-flash-001',
  QWEN_32B: 'qwen/qwen3-32b',
} as const;

export const LLM_MODEL_NAMES: Record<LLMModel, string> = {
  'google/gemini-2.0-flash-001': 'Gemini 2.0 Flash',
  'qwen/qwen3-32b': 'Qwen 3 32B',
};

export type LLMModel = typeof LLM_MODELS[keyof typeof LLM_MODELS];

export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];

// Stores the overall verification state and consensus for each fact
export const factVerifications = pgTable("fact_verifications", {
  id: serial("id").primaryKey(),
  factId: integer("fact_id").notNull().references(() => facts.id, { onDelete: "cascade" }),
  status: text("status").$type<VerificationStatus>().notNull().default('pending'),

  // Evidence retrieved from cited source
  evidenceUrl: text("evidence_url"),
  evidenceContent: text("evidence_content"), // Actual content fetched from source
  evidenceFetchedAt: timestamp("evidence_fetched_at"),
  evidenceError: text("evidence_error"), // Error if fetch failed

  // Consensus results (after all models have graded)
  consensusScore: integer("consensus_score"), // 1-5 final grade
  confidenceLevel: text("confidence_level"), // "high", "medium", "low"
  needsReview: boolean("needs_review").notNull().default(false), // Flag for human review
  verificationNotes: text("verification_notes"), // Explanation of consensus

  // Human override
  humanOverrideScore: integer("human_override_score"), // If human overrides
  humanOverrideNotes: text("human_override_notes"),
  humanOverrideAt: timestamp("human_override_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fact_verifications_fact_id").on(table.factId),
]);

// Stores individual model scores for each fact
export const factModelScores = pgTable("fact_model_scores", {
  id: serial("id").primaryKey(),
  verificationId: integer("verification_id").notNull().references(() => factVerifications.id, { onDelete: "cascade" }),
  model: text("model").$type<LLMModel>().notNull(), // Which LLM model
  score: integer("score"), // 1-5 grade from this model
  rationale: text("rationale"), // Model's explanation
  status: text("status").$type<VerificationStatus>().notNull().default('pending'),
  error: text("error"), // Error if model call failed
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_fact_model_scores_verification_id").on(table.verificationId),
]);

// === RELATIONS ===

// Auth relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  brainlifts: many(brainlifts),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// App relations
export const brainliftsRelations = relations(brainlifts, ({ one, many }) => ({
  createdBy: one(user, {
    fields: [brainlifts.createdByUserId],
    references: [user.id],
  }),
  facts: many(facts),
  contradictionClusters: many(contradictionClusters),
  versions: many(brainliftVersions),
  experts: many(experts),
  shares: many(brainliftShares),
  learningStreamItems: many(learningStreamItems),
}));

export const brainliftSharesRelations = relations(brainliftShares, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [brainliftShares.brainliftId],
    references: [brainlifts.id],
  }),
  user: one(user, {
    fields: [brainliftShares.userId],
    references: [user.id],
  }),
  createdBy: one(user, {
    fields: [brainliftShares.createdByUserId],
    references: [user.id],
  }),
}));

export const expertsRelations = relations(experts, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [experts.brainliftId],
    references: [brainlifts.id],
  }),
}));

export const brainliftVersionsRelations = relations(brainliftVersions, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [brainliftVersions.brainliftId],
    references: [brainlifts.id],
  }),
}));

export const factsRelations = relations(facts, ({ one, many }) => ({
  brainlift: one(brainlifts, {
    fields: [facts.brainliftId],
    references: [brainlifts.id],
  }),
  verification: one(factVerifications),
}));

export const factVerificationsRelations = relations(factVerifications, ({ one, many }) => ({
  fact: one(facts, {
    fields: [factVerifications.factId],
    references: [facts.id],
  }),
  modelScores: many(factModelScores),
}));

export const factModelScoresRelations = relations(factModelScores, ({ one }) => ({
  verification: one(factVerifications, {
    fields: [factModelScores.verificationId],
    references: [factVerifications.id],
  }),
}));

// LLM Feedback System - Tracks human overrides to improve AI grading
export const llmFeedback = pgTable("llm_feedback", {
  id: serial("id").primaryKey(),
  verificationId: integer("verification_id").notNull().references(() => factVerifications.id, { onDelete: "cascade" }),
  factId: integer("fact_id").notNull().references(() => facts.id, { onDelete: "cascade" }),
  llmModel: text("llm_model").$type<LLMModel>().notNull(),
  llmScore: integer("llm_score").notNull(), // Original AI score (1-5)
  humanScore: integer("human_score").notNull(), // Human override score (1-5)
  scoreDifference: integer("score_difference").notNull(), // Absolute difference
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_llm_feedback_fact_id").on(table.factId),
]);

// Aggregated model accuracy stats - updated on each human override
export const modelAccuracyStats = pgTable("model_accuracy_stats", {
  id: serial("id").primaryKey(),
  model: text("model").$type<LLMModel>().notNull().unique(),
  totalSamples: integer("total_samples").notNull().default(0),
  totalAbsoluteError: integer("total_absolute_error").notNull().default(0), // Sum of all score differences
  meanAbsoluteError: text("mean_absolute_error").notNull().default('0'), // Stored as string for precision
  weight: text("weight").notNull().default('1'), // Model weight for consensus (stored as string)
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const llmFeedbackRelations = relations(llmFeedback, ({ one }) => ({
  verification: one(factVerifications, {
    fields: [llmFeedback.verificationId],
    references: [factVerifications.id],
  }),
  fact: one(facts, {
    fields: [llmFeedback.factId],
    references: [facts.id],
  }),
}));

export const modelAccuracyStatsRelations = relations(modelAccuracyStats, ({ }) => ({}));

// DOK1 Redundancy Flagging - Groups of semantically similar facts
export const REDUNDANCY_STATUS = {
  PENDING: 'pending', // Awaiting review
  KEPT: 'kept', // User chose to keep this fact
  MERGED: 'merged', // Fact was merged into another
  DISMISSED: 'dismissed', // Redundancy flag dismissed (not actually redundant)
} as const;

export type RedundancyStatus = typeof REDUNDANCY_STATUS[keyof typeof REDUNDANCY_STATUS];

export const factRedundancyGroups = pgTable("fact_redundancy_groups", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  groupName: text("group_name").notNull(), // e.g., "Funding statistics"
  factIds: integer("fact_ids").array().notNull(), // Array of fact IDs in this group
  primaryFactId: integer("primary_fact_id"), // Suggested fact to keep (highest score/most comprehensive)
  similarityScore: text("similarity_score").notNull(), // Average similarity percentage (e.g., "87%")
  reason: text("reason").notNull(), // Why these are considered redundant
  status: text("status").$type<RedundancyStatus>().notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fact_redundancy_groups_brainlift_id").on(table.brainliftId),
]);

export const factRedundancyGroupsRelations = relations(factRedundancyGroups, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [factRedundancyGroups.brainliftId],
    references: [brainlifts.id],
  }),
}));

// Learning Stream - Extracted content types (discriminated union)
export type ExtractedContent =
  | { contentType: 'embed'; embedType: 'youtube'; embedId: string }
  | { contentType: 'embed'; embedType: 'spotify'; embedId: string }
  | { contentType: 'embed'; embedType: 'apple-podcast'; embedUrl: string }
  | { contentType: 'embed'; embedType: 'tweet'; tweetId: string }
  | { contentType: 'article'; markdown: string; title?: string; siteName?: string }
  | { contentType: 'pdf'; url: string }
  | { contentType: 'fallback'; reason: string };

// Learning Stream - Automated research feed items
export const learningStreamItems = pgTable("learning_stream_items", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),

  // Source metadata
  type: text("type").notNull(), // "Substack", "Twitter", "Academic Paper", "Podcast", "Video", "News"
  author: text("author").notNull(),
  topic: text("topic").notNull(), // Title or brief description
  time: text("time").notNull(), // "5 min", "15 min"
  facts: text("facts").notNull(), // Summary/relevance description
  url: text("url").notNull(),

  // Learning stream state
  status: text("status").$type<'pending' | 'bookmarked' | 'graded' | 'discarded'>()
    .default('pending')
    .notNull(),
  source: text("source").$type<'quick-search' | 'deep-research' | 'twitter' | 'swarm-research'>().notNull(),

  // Grading fields (populated when status='graded')
  quality: integer("quality"), // 1-5 scale, nullable
  alignment: text("alignment").$type<'yes' | 'no'>(), // nullable

  // AI metadata
  relevanceScore: text("relevance_score"), // "0.85" from AI classification
  aiRationale: text("ai_rationale"), // Why AI suggested this

  // Cached extracted content for inline viewing
  extractedContent: jsonb("extracted_content").$type<ExtractedContent | null>(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // Prevent duplicate URLs per brainlift
  unique("unique_brainlift_url").on(table.brainliftId, table.url),
  // Optimize status filtering queries
  index("idx_learning_stream_status").on(table.brainliftId, table.status),
]);

export type LearningStreamItem = typeof learningStreamItems.$inferSelect;
export type NewLearningStreamItem = typeof learningStreamItems.$inferInsert;

// DOK2 Grading - Fail reasons for auto-fail conditions
export const DOK2_FAIL_REASON = {
  COPY_PASTE: 'copy_paste',
  NO_PURPOSE_RELATION: 'no_purpose_relation',
  FACTUAL_MISREPRESENTATION: 'factual_misrepresentation',
  FACT_MANIPULATION: 'fact_manipulation',
} as const;

export type DOK2FailReason = typeof DOK2_FAIL_REASON[keyof typeof DOK2_FAIL_REASON];

// DOK2 Summary Storage - Owner's interpretation/synthesis of sources
// One summary group per source, containing multiple summary points
export const dok2Summaries = pgTable("dok2_summaries", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  displayTitle: text("display_title"),  // AI-generated insight title (e.g., "Key findings on athlete compensation")
  workflowyNodeId: text("workflowy_node_id"), // Original DOK2 marker node ID
  sourceWorkflowyNodeId: text("source_workflowy_node_id"), // Source node ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // DOK2 Grading fields
  grade: integer("grade"), // 1-5 grading scale
  diagnosis: text("diagnosis"), // Why this score was given
  feedback: text("feedback"), // How to improve
  gradedAt: timestamp("graded_at"),
  failReason: text("fail_reason").$type<DOK2FailReason>(), // Auto-fail reason if grade=1
  sourceVerified: boolean("source_verified"), // Was the source URL successfully fetched?
}, (table) => [
  index("idx_dok2_summaries_brainlift_id").on(table.brainliftId),
]);

// Individual summary points within a DOK2 group
export const dok2Points = pgTable("dok2_points", {
  id: serial("id").primaryKey(),
  summaryId: integer("summary_id").notNull().references(() => dok2Summaries.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_dok2_points_summary_id").on(table.summaryId),
]);

// Link DOK2 summaries to related DOK1 facts (for grading: "do summaries capture these facts?")
export const dok2FactRelations = pgTable("dok2_fact_relations", {
  id: serial("id").primaryKey(),
  summaryId: integer("summary_id").notNull().references(() => dok2Summaries.id, { onDelete: "cascade" }),
  factId: integer("fact_id").notNull().references(() => facts.id, { onDelete: "cascade" }),
}, (table) => [
  index("idx_dok2_fact_relations_summary_id").on(table.summaryId),
  index("idx_dok2_fact_relations_fact_id").on(table.factId),
]);

export const dok2SummariesRelations = relations(dok2Summaries, ({ one, many }) => ({
  brainlift: one(brainlifts, {
    fields: [dok2Summaries.brainliftId],
    references: [brainlifts.id],
  }),
  points: many(dok2Points),
  factRelations: many(dok2FactRelations),
}));

export const dok2PointsRelations = relations(dok2Points, ({ one }) => ({
  summary: one(dok2Summaries, {
    fields: [dok2Points.summaryId],
    references: [dok2Summaries.id],
  }),
}));

export const dok2FactRelationsRelations = relations(dok2FactRelations, ({ one }) => ({
  summary: one(dok2Summaries, {
    fields: [dok2FactRelations.summaryId],
    references: [dok2Summaries.id],
  }),
  fact: one(facts, {
    fields: [dok2FactRelations.factId],
    references: [facts.id],
  }),
}));

export const contradictionClustersRelations = relations(contradictionClusters, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [contradictionClusters.brainliftId],
    references: [brainlifts.id],
  }),
}));

export const learningStreamItemsRelations = relations(learningStreamItems, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [learningStreamItems.brainliftId],
    references: [brainlifts.id],
  }),
}));

// Swarm Usage - Tracks daily swarm runs per user for rate limiting
export const swarmUsage = pgTable("swarm_usage", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_swarm_usage_user_date").on(table.userId, table.createdAt),
]);

export const swarmUsageRelations = relations(swarmUsage, ({ one }) => ({
  user: one(user, {
    fields: [swarmUsage.userId],
    references: [user.id],
  }),
  brainlift: one(brainlifts, {
    fields: [swarmUsage.brainliftId],
    references: [brainlifts.id],
  }),
}));

// DOK3 Models — separate from LLM_MODELS (which is for fact verification)
export const DOK3_MODELS = {
  // Step 3: Quality-tier for conceptual coherence evaluation
  OPUS: 'anthropic/claude-opus-4.6',
  SONNET_FALLBACK: 'anthropic/claude-sonnet-4.5',
  // Step 2: Mid-tier for traceability checks
  GEMINI_FLASH: 'google/gemini-2.0-flash-001',
  SONNET_TRACEABILITY_FALLBACK: 'anthropic/claude-sonnet-4.5',
} as const;

export type DOK3Model = typeof DOK3_MODELS[keyof typeof DOK3_MODELS];

// DOK3 Insight Status
export const DOK3_INSIGHT_STATUS = {
  PENDING_LINKING: 'pending_linking',
  LINKED: 'linked',
  GRADING: 'grading',
  GRADED: 'graded',
  ERROR: 'error',
  SCRATCHPADDED: 'scratchpadded',
} as const;

export type DOK3InsightStatus = typeof DOK3_INSIGHT_STATUS[keyof typeof DOK3_INSIGHT_STATUS];

// DOK3 Insights - Cross-source insights linking multiple DOK2 summaries
export const dok3Insights = pgTable("dok3_insights", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  workflowyNodeId: text("workflowy_node_id"),
  status: text("status").$type<DOK3InsightStatus>().notNull().default('pending_linking'),
  score: integer("score"),
  frameworkName: text("framework_name"),
  frameworkDescription: text("framework_description"),
  criteriaBreakdown: jsonb("criteria_breakdown"),
  rationale: text("rationale"),
  feedback: text("feedback"),
  foundationIntegrityIndex: text("foundation_integrity_index"),
  dok1FoundationScore: text("dok1_foundation_score"),
  dok2SynthesisScore: text("dok2_synthesis_score"),
  traceabilityFlagged: boolean("traceability_flagged").default(false),
  traceabilityFlaggedSource: text("traceability_flagged_source"),
  evaluatorModel: text("evaluator_model"),
  sourceRankings: jsonb("source_rankings").$type<Record<string, number>>(),
  gradedAt: timestamp("graded_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_dok3_insights_brainlift").on(table.brainliftId),
]);

// DOK3 Insight Links (many-to-many: insight ↔ dok2_summary)
export const dok3InsightLinks = pgTable("dok3_insight_links", {
  id: serial("id").primaryKey(),
  insightId: integer("insight_id").notNull().references(() => dok3Insights.id, { onDelete: "cascade" }),
  dok2SummaryId: integer("dok2_summary_id").notNull().references(() => dok2Summaries.id, { onDelete: "cascade" }),
}, (table) => [
  unique("dok3_insight_links_unique").on(table.insightId, table.dok2SummaryId),
  index("idx_dok3_insight_links_insight").on(table.insightId),
  index("idx_dok3_insight_links_dok2").on(table.dok2SummaryId),
]);

// DOK3 Scratchpad table removed in Phase 5 — scratchpad is now a soft-delete status on dok3_insights

export const dok3InsightsRelations = relations(dok3Insights, ({ one, many }) => ({
  brainlift: one(brainlifts, {
    fields: [dok3Insights.brainliftId],
    references: [brainlifts.id],
  }),
  links: many(dok3InsightLinks),
}));

export const dok3InsightLinksRelations = relations(dok3InsightLinks, ({ one }) => ({
  insight: one(dok3Insights, {
    fields: [dok3InsightLinks.insightId],
    references: [dok3Insights.id],
  }),
  dok2Summary: one(dok2Summaries, {
    fields: [dok3InsightLinks.dok2SummaryId],
    references: [dok2Summaries.id],
  }),
}));

// dok3Scratchpad relations removed in Phase 5

// === IMPORT AGENT TABLES ===

// Import Agent Phase enum
export const IMPORT_PHASE = {
  INIT: 'init',
  SOURCES: 'sources',
  DOK1: 'dok1',
  DOK2: 'dok2',
  DOK3: 'dok3',
  DOK3_LINKING: 'dok3_linking',
  FINAL: 'final',
} as const;

export type ImportPhase = typeof IMPORT_PHASE[keyof typeof IMPORT_PHASE];

// Import Status enum (on brainlifts table)
export const IMPORT_STATUS = {
  PENDING: 'pending',
  AGENT_IN_PROGRESS: 'agent_in_progress',
  COMPLETE: 'complete',
} as const;

export type ImportStatus = typeof IMPORT_STATUS[keyof typeof IMPORT_STATUS];

// Source curation status
export const SOURCE_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SCRATCHPADDED: 'scratchpadded',
} as const;

export type SourceStatus = typeof SOURCE_STATUS[keyof typeof SOURCE_STATUS];

// Import Agent Conversations - persists agent chat history across sessions
export const importAgentConversations = pgTable("import_agent_conversations", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  messages: jsonb("messages").notNull().default([]),
  currentPhase: text("current_phase").$type<ImportPhase>().notNull().default('init'),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("unique_brainlift_conversation").on(table.brainliftId),
]);

// Brainlift Sources - URLs/references curated during import
export const brainliftSources = pgTable("brainlift_sources", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  url: text("url"),
  name: text("name"),
  category: text("category"),
  surroundingContext: text("surrounding_context"),
  status: text("status").$type<SourceStatus>().notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_brainlift_sources_brainlift").on(table.brainliftId),
  unique("uq_brainlift_sources_url").on(table.brainliftId, table.url),
]);

// Import Agent Relations
export const importAgentConversationsRelations = relations(importAgentConversations, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [importAgentConversations.brainliftId],
    references: [brainlifts.id],
  }),
}));

export const brainliftSourcesRelations = relations(brainliftSources, ({ one }) => ({
  brainlift: one(brainlifts, {
    fields: [brainliftSources.brainliftId],
    references: [brainlifts.id],
  }),
}));

// === SCHEMAS ===

export const insertBrainliftSchema = createInsertSchema(brainlifts);
export const insertFactSchema = createInsertSchema(facts).omit({ id: true });
export const insertContradictionClusterSchema = createInsertSchema(contradictionClusters).omit({ id: true });
export const insertBrainliftVersionSchema = createInsertSchema(brainliftVersions).omit({ id: true, createdAt: true });
export const insertExpertSchema = createInsertSchema(experts).omit({ id: true });
export const insertFactVerificationSchema = createInsertSchema(factVerifications).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFactModelScoreSchema = createInsertSchema(factModelScores).omit({ id: true });
export const insertLlmFeedbackSchema = createInsertSchema(llmFeedback).omit({ id: true, createdAt: true });
export const insertModelAccuracyStatsSchema = createInsertSchema(modelAccuracyStats).omit({ id: true, lastUpdated: true });
export const insertFactRedundancyGroupSchema = createInsertSchema(factRedundancyGroups).omit({ id: true, createdAt: true });
export const insertDok2SummarySchema = createInsertSchema(dok2Summaries).omit({ id: true, createdAt: true });
export const insertDok2PointSchema = createInsertSchema(dok2Points).omit({ id: true });
export const insertDok2FactRelationSchema = createInsertSchema(dok2FactRelations).omit({ id: true });
export const insertDok3InsightSchema = createInsertSchema(dok3Insights).omit({ id: true, createdAt: true });
export const insertDok3InsightLinkSchema = createInsertSchema(dok3InsightLinks).omit({ id: true });
export const insertBrainliftShareSchema = createInsertSchema(brainliftShares).omit({ id: true, createdAt: true });
export const insertLearningStreamItemSchema = createInsertSchema(learningStreamItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertImportAgentConversationSchema = createInsertSchema(importAgentConversations).omit({ id: true, updatedAt: true });
export const insertBrainliftSourceSchema = createInsertSchema(brainliftSources).omit({ id: true, createdAt: true });

// === TYPES ===

// Auth types
export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;

export type Brainlift = typeof brainlifts.$inferSelect;
export type InsertBrainlift = z.infer<typeof insertBrainliftSchema>;

export type Fact = typeof facts.$inferSelect;
export type ContradictionCluster = typeof contradictionClusters.$inferSelect;
export type BrainliftVersion = typeof brainliftVersions.$inferSelect;
export type InsertBrainliftVersion = z.infer<typeof insertBrainliftVersionSchema>;
export type Expert = typeof experts.$inferSelect;
export type InsertExpert = z.infer<typeof insertExpertSchema>;
export type FactVerification = typeof factVerifications.$inferSelect;
export type InsertFactVerification = z.infer<typeof insertFactVerificationSchema>;
export type FactModelScore = typeof factModelScores.$inferSelect;
export type InsertFactModelScore = z.infer<typeof insertFactModelScoreSchema>;
export type LlmFeedback = typeof llmFeedback.$inferSelect;
export type InsertLlmFeedback = z.infer<typeof insertLlmFeedbackSchema>;
export type ModelAccuracyStats = typeof modelAccuracyStats.$inferSelect;
export type InsertModelAccuracyStats = z.infer<typeof insertModelAccuracyStatsSchema>;
export type FactRedundancyGroup = typeof factRedundancyGroups.$inferSelect;
export type InsertFactRedundancyGroup = z.infer<typeof insertFactRedundancyGroupSchema>;
export type Dok2Summary = typeof dok2Summaries.$inferSelect;
export type InsertDok2Summary = z.infer<typeof insertDok2SummarySchema>;
export type Dok2Point = typeof dok2Points.$inferSelect;
export type InsertDok2Point = z.infer<typeof insertDok2PointSchema>;
export type Dok2FactRelation = typeof dok2FactRelations.$inferSelect;
export type InsertDok2FactRelation = z.infer<typeof insertDok2FactRelationSchema>;
export type DOK3Insight = typeof dok3Insights.$inferSelect;
export type InsertDOK3Insight = z.infer<typeof insertDok3InsightSchema>;
export type DOK3InsightLink = typeof dok3InsightLinks.$inferSelect;
export type InsertDOK3InsightLink = z.infer<typeof insertDok3InsightLinkSchema>;
export type BrainliftShare = typeof brainliftShares.$inferSelect;
export type InsertBrainliftShare = z.infer<typeof insertBrainliftShareSchema>;
export type InsertLearningStreamItem = z.infer<typeof insertLearningStreamItemSchema>;
export type ImportAgentConversation = typeof importAgentConversations.$inferSelect;
export type InsertImportAgentConversation = z.infer<typeof insertImportAgentConversationSchema>;
export type BrainliftSource = typeof brainliftSources.$inferSelect;
export type InsertBrainliftSource = z.infer<typeof insertBrainliftSourceSchema>;

// Full brainlift data with nested relations (for API response)
export interface BrainliftData extends Brainlift {
  facts: Fact[];
  contradictionClusters: ContradictionCluster[];
  experts: Expert[];
  dok2Summaries?: Array<{
    id: number;
    category: string;
    sourceName: string;
    sourceUrl: string | null;
    points: Array<{ id: number; text: string; sortOrder: number }>;
    relatedFactIds: number[];
    // DOK2 Grading fields
    grade: number | null;
    diagnosis: string | null;
    feedback: string | null;
    failReason: DOK2FailReason | null;
    sourceVerified: boolean | null;
  }>;
}

// Fact with verification data for API response
export interface FactWithVerification extends Fact {
  verification?: FactVerification & {
    modelScores: FactModelScore[];
  };
}

// === DOK4 TABLES ===

// DOK4 Status
export const DOK4_STATUS = {
  DRAFT: 'draft',
  REJECTED: 'rejected',
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type DOK4Status = typeof DOK4_STATUS[keyof typeof DOK4_STATUS];

// DOK4 Pipeline Steps
export const DOK4_PIPELINE_STEP = {
  POV_VALIDATION: 'pov_validation',
  FOUNDATION_INTEGRITY: 'foundation_integrity',
  SOURCE_TRACEABILITY: 'source_traceability',
  QUALITY_EVALUATION: 'quality_evaluation',
  COGNITIVE_OWNERSHIP: 'cognitive_ownership',
  SCORE_ADJUSTMENT: 'score_adjustment',
  CONVERSION_EVALUATION: 'conversion_evaluation',
} as const;

export type DOK4PipelineStep = typeof DOK4_PIPELINE_STEP[keyof typeof DOK4_PIPELINE_STEP];

// DOK4 Rejection Categories (from POV Validation Classifier)
export const DOK4_REJECTION_CATEGORY = {
  TAUTOLOGY: 'tautology',
  DEFINITION: 'definition',
  UNFALSIFIABLE: 'unfalsifiable',
  OPINION_WITHOUT_EVIDENCE: 'opinion_without_evidence',
  DOK3_MISCLASSIFICATION: 'dok3_misclassification',
  NOT_A_CLAIM: 'not_a_claim',
} as const;

export type DOK4RejectionCategory = typeof DOK4_REJECTION_CATEGORY[keyof typeof DOK4_REJECTION_CATEGORY];

// DOK4 Confidence Levels
export const DOK4_CONFIDENCE = {
  PROVISIONAL: 'provisional',
  STANDARD: 'standard',
  VERIFIED: 'verified',
} as const;

export type DOK4Confidence = typeof DOK4_CONFIDENCE[keyof typeof DOK4_CONFIDENCE];

// DOK4 Models — separate from DOK3_MODELS
export const DOK4_MODELS = {
  // POV Validation + Traceability + S2 Vanilla (mid-tier)
  GEMINI_FLASH: 'google/gemini-2.0-flash-001',
  SONNET_MID: 'anthropic/claude-sonnet-4.5',
  // Quality Evaluation (quality-tier)
  OPUS: 'anthropic/claude-opus-4.6',
  OPUS_FALLBACK: 'anthropic/claude-sonnet-4.5',
  // COE Jury (cross-family, quality-tier)
  COE_MODEL_1: 'anthropic/claude-opus-4.6',
  COE_MODEL_2: 'google/gemini-2.5-pro',
  COE_MODEL_3: 'openai/gpt-4o',
} as const;

export type DOK4Model = typeof DOK4_MODELS[keyof typeof DOK4_MODELS];

// DOK4 Submissions — Primary DOK4 table
export const dok4Submissions = pgTable("dok4_submissions", {
  id: serial("id").primaryKey(),
  brainliftId: integer("brainlift_id").notNull().references(() => brainlifts.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  status: text("status").$type<DOK4Status>().default('draft'),
  currentStep: text("current_step").$type<DOK4PipelineStep>(),

  // POV Validation
  rejectionReason: text("rejection_reason"),
  rejectionCategory: text("rejection_category").$type<DOK4RejectionCategory>(),
  validatedAt: timestamp("validated_at"),

  // Foundation Integrity
  foundationIntegrityIndex: text("foundation_integrity_index"),
  dok1ComponentScore: text("dok1_component_score"),
  dok2ComponentScore: text("dok2_component_score"),
  dok3ComponentScore: text("dok3_component_score"),
  foundationCeiling: integer("foundation_ceiling"),

  // Source Traceability
  traceabilityStatus: text("traceability_status"),
  traceabilityIsBorrowed: boolean("traceability_is_borrowed"),
  traceabilityFlaggedSource: text("traceability_flagged_source"),
  traceabilityOverlapSummary: text("traceability_overlap_summary"),

  // Quality Evaluation
  qualityScoreRaw: integer("quality_score_raw"),
  qualityScoreFinal: integer("quality_score_final"),
  qualityCriteria: jsonb("quality_criteria"),
  s2DivergenceClassification: text("s2_divergence_classification"),
  s2VanillaResponse: text("s2_vanilla_response"),
  positionSummary: text("position_summary"),
  frameworkDependency: text("framework_dependency"),
  keyEvidence: jsonb("key_evidence"),
  vulnerabilityPoints: jsonb("vulnerability_points"),
  qualityRationale: text("quality_rationale"),
  qualityFeedback: text("quality_feedback"),
  qualityEvaluatorModel: text("quality_evaluator_model"),

  // COE (Cognitive Ownership Evaluation)
  ownershipAssessmentScore: integer("ownership_assessment_score"),
  coePerAxisScores: jsonb("coe_per_axis_scores"),
  coeConjunctiveFailure: boolean("coe_conjunctive_failure").default(false),
  coeConjunctiveFailureAxis: text("coe_conjunctive_failure_axis"),
  coeEvaluationTier: text("coe_evaluation_tier"),
  coeAdjustment: integer("coe_adjustment"),
  confidenceLevel: text("confidence_level").$type<DOK4Confidence>(),

  // Antimemetic Conversion
  conversionText: text("conversion_text"),
  conversionRationale: text("conversion_rationale"),
  conversionScore: integer("conversion_score"),
  conversionCriteria: jsonb("conversion_criteria"),
  conversionFeedback: text("conversion_feedback"),
  conversionEvaluatorModel: text("conversion_evaluator_model"),
  conversionSubmittedAt: timestamp("conversion_submitted_at"),
  conversionGradedAt: timestamp("conversion_graded_at"),

  // Cascading invalidation
  needsRecalculation: boolean("needs_recalculation").default(false),
  recalculationReason: text("recalculation_reason"),
  recalculationTriggeredAt: timestamp("recalculation_triggered_at"),

  // Error/retry state
  errorCode: text("error_code"),
  errorDetail: text("error_detail"),
  retryCount: integer("retry_count").default(0),
  lastAttemptAt: timestamp("last_attempt_at"),

  // Timestamps
  gradedAt: timestamp("graded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_dok4_submissions_brainlift").on(table.brainliftId),
]);

// DOK4 → DOK3 Links (with primary designation)
export const dok4Dok3Links = pgTable("dok4_dok3_links", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => dok4Submissions.id, { onDelete: "cascade" }),
  dok3InsightId: integer("dok3_insight_id").notNull().references(() => dok3Insights.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").default(false),
}, (table) => [
  unique("dok4_dok3_links_unique").on(table.submissionId, table.dok3InsightId),
  index("idx_dok4_dok3_links_submission").on(table.submissionId),
  index("idx_dok4_dok3_links_dok3").on(table.dok3InsightId),
]);

// DOK4 → DOK2 Links
export const dok4Dok2Links = pgTable("dok4_dok2_links", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => dok4Submissions.id, { onDelete: "cascade" }),
  dok2SummaryId: integer("dok2_summary_id").notNull().references(() => dok2Summaries.id, { onDelete: "cascade" }),
}, (table) => [
  unique("dok4_dok2_links_unique").on(table.submissionId, table.dok2SummaryId),
  index("idx_dok4_dok2_links_submission").on(table.submissionId),
]);

// DOK4 COE Model Scores — Per-model jury scores
export const dok4CoeModelScores = pgTable("dok4_coe_model_scores", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => dok4Submissions.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  modelFamily: text("model_family").notNull(),
  axisScores: jsonb("axis_scores").notNull(),
  ownershipAssessment: text("ownership_assessment"),
  feedback: text("feedback"),
  status: text("status").default('pending'),
  error: text("error"),
  completedAt: timestamp("completed_at"),
});

// DOK4 Relations
export const dok4SubmissionsRelations = relations(dok4Submissions, ({ one, many }) => ({
  brainlift: one(brainlifts, {
    fields: [dok4Submissions.brainliftId],
    references: [brainlifts.id],
  }),
  dok3Links: many(dok4Dok3Links),
  dok2Links: many(dok4Dok2Links),
  coeModelScores: many(dok4CoeModelScores),
}));

export const dok4Dok3LinksRelations = relations(dok4Dok3Links, ({ one }) => ({
  submission: one(dok4Submissions, {
    fields: [dok4Dok3Links.submissionId],
    references: [dok4Submissions.id],
  }),
  dok3Insight: one(dok3Insights, {
    fields: [dok4Dok3Links.dok3InsightId],
    references: [dok3Insights.id],
  }),
}));

export const dok4Dok2LinksRelations = relations(dok4Dok2Links, ({ one }) => ({
  submission: one(dok4Submissions, {
    fields: [dok4Dok2Links.submissionId],
    references: [dok4Submissions.id],
  }),
  dok2Summary: one(dok2Summaries, {
    fields: [dok4Dok2Links.dok2SummaryId],
    references: [dok2Summaries.id],
  }),
}));

export const dok4CoeModelScoresRelations = relations(dok4CoeModelScores, ({ one }) => ({
  submission: one(dok4Submissions, {
    fields: [dok4CoeModelScores.submissionId],
    references: [dok4Submissions.id],
  }),
}));

// DOK4 Schemas
export const insertDok4SubmissionSchema = createInsertSchema(dok4Submissions).omit({ id: true, createdAt: true });
export const insertDok4Dok3LinkSchema = createInsertSchema(dok4Dok3Links).omit({ id: true });
export const insertDok4Dok2LinkSchema = createInsertSchema(dok4Dok2Links).omit({ id: true });
export const insertDok4CoeModelScoreSchema = createInsertSchema(dok4CoeModelScores).omit({ id: true });

// DOK4 Types
export type DOK4Submission = typeof dok4Submissions.$inferSelect;
export type InsertDOK4Submission = z.infer<typeof insertDok4SubmissionSchema>;
export type DOK4Dok3Link = typeof dok4Dok3Links.$inferSelect;
export type InsertDOK4Dok3Link = z.infer<typeof insertDok4Dok3LinkSchema>;
export type DOK4Dok2Link = typeof dok4Dok2Links.$inferSelect;
export type InsertDOK4Dok2Link = z.infer<typeof insertDok4Dok2LinkSchema>;
export type DOK4CoeModelScore = typeof dok4CoeModelScores.$inferSelect;
export type InsertDOK4CoeModelScore = z.infer<typeof insertDok4CoeModelScoreSchema>;

// === AUTHORIZATION ===

export const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
  // GUIDE: "guide", // Future: Guide role for accessing students' data
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export interface AuthContext {
  userId: string;
  role: UserRole;
  isAdmin: boolean;
}

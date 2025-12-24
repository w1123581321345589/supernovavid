import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const jobStatusEnum = pgEnum('job_status', ['pending', 'processing', 'completed', 'failed']);
export const testStatusEnum = pgEnum('test_status', ['draft', 'running', 'paused', 'completed', 'archived']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'canceled', 'past_due', 'trialing']);
export const campaignStatusEnum = pgEnum('campaign_status', ['pending_payment', 'analyzing', 'generating', 'testing', 'optimizing', 'settled', 'failed']);
export const assetTypeEnum = pgEnum('asset_type', ['transcript', 'frame', 'element', 'reference_image']);

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table - mandatory for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  credits: integer("credits").default(100).notNull(),
  stripeCustomerId: varchar("stripe_customer_id"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status"),
  subscriptionPlan: varchar("subscription_plan"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Templates - pre-built thumbnail templates
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category"),
  previewUrl: varchar("preview_url"),
  promptTemplate: text("prompt_template"),
  styleConfig: jsonb("style_config"),
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Generation Jobs - AI thumbnail generation requests
export const generationJobs = pgTable("generation_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  prompt: text("prompt").notNull(),
  templateId: varchar("template_id").references(() => templates.id),
  variationCount: integer("variation_count").default(4).notNull(),
  status: jobStatusEnum("status").default('pending').notNull(),
  styleConfig: jsonb("style_config"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Thumbnails - generated thumbnail images
export const thumbnails = pgTable("thumbnails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  jobId: varchar("job_id").references(() => generationJobs.id, { onDelete: 'cascade' }),
  name: varchar("name"),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  prompt: text("prompt"),
  variationIndex: integer("variation_index"),
  metadata: jsonb("metadata"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Rotation interval enum for scheduled thumbnail swapping
export const rotationIntervalEnum = pgEnum('rotation_interval', ['none', 'hourly', 'daily', 'weekly']);

// A/B Tests - test configurations
export const abTests = pgTable("ab_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  youtubeVideoId: varchar("youtube_video_id"),
  status: testStatusEnum("status").default('draft').notNull(),
  targetImpressions: integer("target_impressions").default(1000),
  confidenceThreshold: real("confidence_threshold").default(0.95),
  winnerId: varchar("winner_id"),
  rotationInterval: rotationIntervalEnum("rotation_interval").default('none'),
  nextRotationAt: timestamp("next_rotation_at"),
  currentVariantIndex: integer("current_variant_index").default(0),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Test Variants - thumbnails participating in a test
export const testVariants = pgTable("test_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").references(() => abTests.id, { onDelete: 'cascade' }).notNull(),
  thumbnailId: varchar("thumbnail_id").references(() => thumbnails.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name"),
  title: varchar("title"), // Video title to test alongside thumbnail
  weight: real("weight").default(1.0),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  ctr: real("ctr").default(0),
  isWinner: boolean("is_winner").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Test Runs - snapshots of test performance over time
export const testRuns = pgTable("test_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").references(() => abTests.id, { onDelete: 'cascade' }).notNull(),
  variantId: varchar("variant_id").references(() => testVariants.id, { onDelete: 'cascade' }).notNull(),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  ctr: real("ctr").default(0),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// User Activity - analytics and audit log
export const userActivity = pgTable("user_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: varchar("action").notNull(),
  resourceType: varchar("resource_type"),
  resourceId: varchar("resource_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payments - Stripe payment records
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  stripePaymentId: varchar("stripe_payment_id").unique(),
  amount: integer("amount").notNull(),
  currency: varchar("currency").default('usd'),
  status: varchar("status").notNull(),
  description: varchar("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// YouTube Credentials - OAuth tokens for channel access
export const youtubeCredentials = pgTable("youtube_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiry: timestamp("token_expiry").notNull(),
  channelId: varchar("channel_id"),
  channelTitle: varchar("channel_title"),
  scopes: text("scopes").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaigns - $200/video autonomous optimization jobs
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  youtubeVideoId: varchar("youtube_video_id").notNull(),
  youtubeVideoUrl: text("youtube_video_url").notNull(),
  videoTitle: varchar("video_title"),
  originalThumbnailUrl: text("original_thumbnail_url"),
  status: campaignStatusEnum("status").default('pending_payment').notNull(),
  paymentId: varchar("payment_id").references(() => payments.id),
  priceAmount: integer("price_amount").default(20000).notNull(), // $200.00 in cents
  currentIteration: integer("current_iteration").default(0),
  maxIterations: integer("max_iterations").default(20), // Max iterations before settling
  iterationsPerDay: integer("iterations_per_day").default(5),
  nextScheduledRun: timestamp("next_scheduled_run"),
  settledAt: timestamp("settled_at"),
  winningThumbnailId: varchar("winning_thumbnail_id"),
  winningTitle: varchar("winning_title"),
  finalCtr: real("final_ctr"),
  ctrImprovement: real("ctr_improvement"), // % improvement from original
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Video Assets - Extracted transcript, frames, and reference elements
export const videoAssets = pgTable("video_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  assetType: assetTypeEnum("asset_type").notNull(),
  name: varchar("name"),
  description: text("description"),
  url: text("url"), // S3/storage URL for images
  content: text("content"), // For transcript text
  timestamp: real("timestamp"), // Video timestamp in seconds (for frames)
  confidence: real("confidence"), // AI confidence score for detected elements
  metadata: jsonb("metadata"), // Additional data (colors, objects detected, etc.)
  isKeyElement: boolean("is_key_element").default(false), // Marked as key reference for generation
  createdAt: timestamp("created_at").defaultNow(),
});

// Optimization Runs - History of scheduled iterations
export const optimizationRuns = pgTable("optimization_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  iteration: integer("iteration").notNull(),
  status: jobStatusEnum("status").default('pending').notNull(),
  thumbnailsGenerated: integer("thumbnails_generated").default(0),
  variantsSelected: integer("variants_selected").default(0),
  previousBestCtr: real("previous_best_ctr"),
  currentBestCtr: real("current_best_ctr"),
  ctrDelta: real("ctr_delta"),
  impressionsCollected: integer("impressions_collected").default(0),
  actionTaken: varchar("action_taken"), // 'generated_variations', 'swapped_thumbnails', 'settled', etc.
  notes: text("notes"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Performance Snapshots - Detailed analytics history
export const performanceSnapshots = pgTable("performance_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  thumbnailId: varchar("thumbnail_id").references(() => thumbnails.id, { onDelete: 'cascade' }),
  title: varchar("title"),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  ctr: real("ctr").default(0),
  averageViewDuration: real("average_view_duration"),
  isCurrentlyActive: boolean("is_currently_active").default(false),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// Thumbnail Rotations - Track discrete rotation windows for accurate performance comparison
// Each rotation represents a single thumbnail being active for a measured time period
export const thumbnailRotations = pgTable("thumbnail_rotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  optimizationRunId: varchar("optimization_run_id").references(() => optimizationRuns.id, { onDelete: 'cascade' }),
  thumbnailId: varchar("thumbnail_id").references(() => thumbnails.id, { onDelete: 'cascade' }),
  // Timing
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  exposureSeconds: integer("exposure_seconds").default(0),
  // Baseline metrics at rotation start
  baselineViews: integer("baseline_views").default(0),
  baselineWatchMinutes: real("baseline_watch_minutes").default(0),
  // Final metrics at rotation end  
  finalViews: integer("final_views"),
  finalWatchMinutes: real("final_watch_minutes"),
  // Calculated deltas
  viewsDelta: integer("views_delta"),
  watchMinutesDelta: real("watch_minutes_delta"),
  // Velocity metrics (views/hour, watch minutes/hour)
  viewVelocity: real("view_velocity"),
  watchVelocity: real("watch_velocity"),
  // Status
  isActive: boolean("is_active").default(true),
});

// Hook Insights - Viral moment analysis from videos
export const hookInsights = pgTable("hook_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  youtubeVideoId: varchar("youtube_video_id").notNull(),
  youtubeVideoUrl: text("youtube_video_url").notNull(),
  videoTitle: varchar("video_title"),
  timestampSeconds: real("timestamp_seconds").notNull(),
  hookTitle: text("hook_title").notNull(),
  thumbnailText: text("thumbnail_text").notNull(),
  strategy: text("strategy").notNull(),
  confidenceScore: real("confidence_score"),
  frameUrl: text("frame_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Video Analysis Jobs - Track analysis processing
export const analysisJobs = pgTable("analysis_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  youtubeVideoId: varchar("youtube_video_id").notNull(),
  youtubeVideoUrl: text("youtube_video_url").notNull(),
  videoTitle: varchar("video_title"),
  hookCount: integer("hook_count").default(3).notNull(),
  status: jobStatusEnum("status").default('pending').notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// API Keys - For programmatic access
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name").notNull(),
  keyHash: varchar("key_hash").notNull(),
  keyPrefix: varchar("key_prefix").notNull(),
  permissions: text("permissions").array().default([]),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Webhooks - External integrations
export const webhooks = pgTable("webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name").notNull(),
  url: text("url").notNull(),
  secret: varchar("secret"),
  events: text("events").array().default([]),
  isActive: boolean("is_active").default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  failureCount: integer("failure_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Webhook Deliveries - Log of webhook calls
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookId: varchar("webhook_id").references(() => webhooks.id, { onDelete: 'cascade' }).notNull(),
  event: varchar("event").notNull(),
  payload: jsonb("payload"),
  statusCode: integer("status_code"),
  response: text("response"),
  success: boolean("success").default(false),
  deliveredAt: timestamp("delivered_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  templates: many(templates),
  generationJobs: many(generationJobs),
  thumbnails: many(thumbnails),
  abTests: many(abTests),
  userActivity: many(userActivity),
  payments: many(payments),
  campaigns: many(campaigns),
  youtubeCredentials: one(youtubeCredentials),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  user: one(users, { fields: [templates.userId], references: [users.id] }),
  generationJobs: many(generationJobs),
}));

export const generationJobsRelations = relations(generationJobs, ({ one, many }) => ({
  user: one(users, { fields: [generationJobs.userId], references: [users.id] }),
  template: one(templates, { fields: [generationJobs.templateId], references: [templates.id] }),
  thumbnails: many(thumbnails),
}));

export const thumbnailsRelations = relations(thumbnails, ({ one, many }) => ({
  user: one(users, { fields: [thumbnails.userId], references: [users.id] }),
  job: one(generationJobs, { fields: [thumbnails.jobId], references: [generationJobs.id] }),
  testVariants: many(testVariants),
}));

export const abTestsRelations = relations(abTests, ({ one, many }) => ({
  user: one(users, { fields: [abTests.userId], references: [users.id] }),
  variants: many(testVariants),
  runs: many(testRuns),
}));

export const testVariantsRelations = relations(testVariants, ({ one, many }) => ({
  test: one(abTests, { fields: [testVariants.testId], references: [abTests.id] }),
  thumbnail: one(thumbnails, { fields: [testVariants.thumbnailId], references: [thumbnails.id] }),
  runs: many(testRuns),
}));

export const testRunsRelations = relations(testRuns, ({ one }) => ({
  test: one(abTests, { fields: [testRuns.testId], references: [abTests.id] }),
  variant: one(testVariants, { fields: [testRuns.variantId], references: [testVariants.id] }),
}));

export const youtubeCredentialsRelations = relations(youtubeCredentials, ({ one }) => ({
  user: one(users, { fields: [youtubeCredentials.userId], references: [users.id] }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, { fields: [campaigns.userId], references: [users.id] }),
  payment: one(payments, { fields: [campaigns.paymentId], references: [payments.id] }),
  videoAssets: many(videoAssets),
  optimizationRuns: many(optimizationRuns),
  performanceSnapshots: many(performanceSnapshots),
  thumbnailRotations: many(thumbnailRotations),
}));

export const videoAssetsRelations = relations(videoAssets, ({ one }) => ({
  campaign: one(campaigns, { fields: [videoAssets.campaignId], references: [campaigns.id] }),
}));

export const optimizationRunsRelations = relations(optimizationRuns, ({ one }) => ({
  campaign: one(campaigns, { fields: [optimizationRuns.campaignId], references: [campaigns.id] }),
}));

export const performanceSnapshotsRelations = relations(performanceSnapshots, ({ one }) => ({
  campaign: one(campaigns, { fields: [performanceSnapshots.campaignId], references: [campaigns.id] }),
  thumbnail: one(thumbnails, { fields: [performanceSnapshots.thumbnailId], references: [thumbnails.id] }),
}));

export const thumbnailRotationsRelations = relations(thumbnailRotations, ({ one }) => ({
  campaign: one(campaigns, { fields: [thumbnailRotations.campaignId], references: [campaigns.id] }),
  optimizationRun: one(optimizationRuns, { fields: [thumbnailRotations.optimizationRunId], references: [optimizationRuns.id] }),
  thumbnail: one(thumbnails, { fields: [thumbnailRotations.thumbnailId], references: [thumbnails.id] }),
}));

// Insert Schemas
export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
  usageCount: true,
});

export const insertGenerationJobSchema = createInsertSchema(generationJobs).omit({
  id: true,
  status: true,
  createdAt: true,
  completedAt: true,
  errorMessage: true,
});

export const insertThumbnailSchema = createInsertSchema(thumbnails).omit({
  id: true,
  createdAt: true,
});

export const insertAbTestSchema = createInsertSchema(abTests).omit({
  id: true,
  status: true,
  winnerId: true,
  nextRotationAt: true,
  currentVariantIndex: true,
  startedAt: true,
  endedAt: true,
  createdAt: true,
});

export const insertTestVariantSchema = createInsertSchema(testVariants).omit({
  id: true,
  impressions: true,
  clicks: true,
  ctr: true,
  isWinner: true,
  createdAt: true,
}); // title field is now included for Title A/B testing

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  status: true,
  currentIteration: true,
  nextScheduledRun: true,
  settledAt: true,
  winningThumbnailId: true,
  winningTitle: true,
  finalCtr: true,
  ctrImprovement: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVideoAssetSchema = createInsertSchema(videoAssets).omit({
  id: true,
  createdAt: true,
});

export const insertOptimizationRunSchema = createInsertSchema(optimizationRuns).omit({
  id: true,
  status: true,
  thumbnailsGenerated: true,
  variantsSelected: true,
  previousBestCtr: true,
  currentBestCtr: true,
  ctrDelta: true,
  impressionsCollected: true,
  actionTaken: true,
  notes: true,
  startedAt: true,
  completedAt: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  lastUsedAt: true,
  createdAt: true,
});

export const insertWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  lastTriggeredAt: true,
  failureCount: true,
  createdAt: true,
});

export const insertHookInsightSchema = createInsertSchema(hookInsights).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisJobSchema = createInsertSchema(analysisJobs).omit({
  id: true,
  status: true,
  errorMessage: true,
  createdAt: true,
  completedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;
export type GenerationJob = typeof generationJobs.$inferSelect;

export type InsertThumbnail = z.infer<typeof insertThumbnailSchema>;
export type Thumbnail = typeof thumbnails.$inferSelect;

export type InsertAbTest = z.infer<typeof insertAbTestSchema>;
export type AbTest = typeof abTests.$inferSelect;

export type InsertTestVariant = z.infer<typeof insertTestVariantSchema>;
export type TestVariant = typeof testVariants.$inferSelect;

export type TestRun = typeof testRuns.$inferSelect;
export type UserActivity = typeof userActivity.$inferSelect;
export type Payment = typeof payments.$inferSelect;

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

export type InsertVideoAsset = z.infer<typeof insertVideoAssetSchema>;
export type VideoAsset = typeof videoAssets.$inferSelect;

export type InsertOptimizationRun = z.infer<typeof insertOptimizationRunSchema>;
export type OptimizationRun = typeof optimizationRuns.$inferSelect;

export type YoutubeCredentials = typeof youtubeCredentials.$inferSelect;
export type PerformanceSnapshot = typeof performanceSnapshots.$inferSelect;

export type InsertThumbnailRotation = typeof thumbnailRotations.$inferInsert;
export type ThumbnailRotation = typeof thumbnailRotations.$inferSelect;

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type Webhook = typeof webhooks.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

export type InsertHookInsight = z.infer<typeof insertHookInsightSchema>;
export type HookInsight = typeof hookInsights.$inferSelect;

export type InsertAnalysisJob = z.infer<typeof insertAnalysisJobSchema>;
export type AnalysisJob = typeof analysisJobs.$inferSelect;

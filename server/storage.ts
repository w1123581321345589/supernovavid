import {
  users,
  templates,
  generationJobs,
  thumbnails,
  abTests,
  testVariants,
  testRuns,
  userActivity,
  payments,
  youtubeCredentials,
  campaigns,
  videoAssets,
  optimizationRuns,
  performanceSnapshots,
  thumbnailRotations,
  apiKeys,
  webhooks,
  webhookDeliveries,
  hookInsights,
  analysisJobs,
  type User,
  type UpsertUser,
  type Template,
  type InsertTemplate,
  type GenerationJob,
  type InsertGenerationJob,
  type Thumbnail,
  type InsertThumbnail,
  type AbTest,
  type InsertAbTest,
  type TestVariant,
  type InsertTestVariant,
  type TestRun,
  type UserActivity,
  type Payment,
  type YoutubeCredentials,
  type Campaign,
  type InsertCampaign,
  type VideoAsset,
  type InsertVideoAsset,
  type OptimizationRun,
  type InsertOptimizationRun,
  type PerformanceSnapshot,
  type ThumbnailRotation,
  type InsertThumbnailRotation,
  type ApiKey,
  type InsertApiKey,
  type Webhook,
  type InsertWebhook,
  type WebhookDelivery,
  type HookInsight,
  type InsertHookInsight,
  type AnalysisJob,
  type InsertAnalysisJob,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserCredits(id: string, credits: number): Promise<User | undefined>;
  
  // Template operations
  getTemplates(userId?: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, data: Partial<Template>): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<void>;
  
  // Generation job operations
  getGenerationJobs(userId: string): Promise<GenerationJob[]>;
  getGenerationJob(id: string): Promise<GenerationJob | undefined>;
  createGenerationJob(job: InsertGenerationJob): Promise<GenerationJob>;
  updateGenerationJob(id: string, data: Partial<GenerationJob>): Promise<GenerationJob | undefined>;
  
  // Thumbnail operations
  getThumbnails(userId: string): Promise<Thumbnail[]>;
  getThumbnail(id: string): Promise<Thumbnail | undefined>;
  getThumbnailsByJobId(jobId: string): Promise<Thumbnail[]>;
  createThumbnail(thumbnail: InsertThumbnail): Promise<Thumbnail>;
  updateThumbnail(id: string, data: Partial<Thumbnail>): Promise<Thumbnail | undefined>;
  deleteThumbnail(id: string): Promise<void>;
  
  // A/B Test operations
  getAbTests(userId: string): Promise<AbTest[]>;
  getAbTest(id: string): Promise<AbTest | undefined>;
  createAbTest(test: InsertAbTest): Promise<AbTest>;
  updateAbTest(id: string, data: Partial<AbTest>): Promise<AbTest | undefined>;
  deleteAbTest(id: string): Promise<void>;
  
  // Test Variant operations
  getTestVariants(testId: string): Promise<TestVariant[]>;
  getTestVariant(id: string): Promise<TestVariant | undefined>;
  createTestVariant(variant: InsertTestVariant): Promise<TestVariant>;
  updateTestVariant(id: string, data: Partial<TestVariant>): Promise<TestVariant | undefined>;
  deleteTestVariant(id: string): Promise<void>;
  
  // Test Run operations
  getTestRuns(testId: string): Promise<TestRun[]>;
  createTestRun(run: Partial<TestRun>): Promise<TestRun>;
  
  // Activity operations
  logActivity(userId: string, action: string, resourceType?: string, resourceId?: string, metadata?: any): Promise<void>;
  getUserActivity(userId: string, limit?: number): Promise<UserActivity[]>;
  
  // Payment operations
  createPayment(payment: Partial<Payment>): Promise<Payment>;
  getPayments(userId: string): Promise<Payment[]>;
  
  // Analytics
  getUserStats(userId: string): Promise<{
    totalThumbnails: number;
    activeTests: number;
    avgCtr: number;
    creditsRemaining: number;
  }>;

  // Analysis Job operations
  getAnalysisJobs(userId: string): Promise<AnalysisJob[]>;
  getAnalysisJob(id: string): Promise<AnalysisJob | undefined>;
  createAnalysisJob(data: InsertAnalysisJob): Promise<AnalysisJob>;
  updateAnalysisJob(id: string, data: Partial<AnalysisJob>): Promise<AnalysisJob | undefined>;

  // Hook Insight operations
  getHookInsights(userId: string, youtubeVideoId?: string): Promise<HookInsight[]>;
  getHookInsightsByJobId(jobId: string): Promise<HookInsight[]>;
  createHookInsight(data: InsertHookInsight): Promise<HookInsight>;
  createHookInsights(data: InsertHookInsight[]): Promise<HookInsight[]>;
  deleteHookInsightsForVideo(userId: string, youtubeVideoId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserCredits(id: string, credits: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ credits, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Template operations
  async getTemplates(userId?: string): Promise<Template[]> {
    if (userId) {
      return db.select().from(templates)
        .where(eq(templates.userId, userId))
        .orderBy(desc(templates.createdAt));
    }
    return db.select().from(templates)
      .where(eq(templates.isPublic, true))
      .orderBy(desc(templates.usageCount));
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const [template] = await db.select().from(templates).where(eq(templates.id, id));
    return template;
  }

  async createTemplate(template: InsertTemplate): Promise<Template> {
    const [created] = await db.insert(templates).values(template).returning();
    return created;
  }

  async updateTemplate(id: string, data: Partial<Template>): Promise<Template | undefined> {
    const [updated] = await db
      .update(templates)
      .set(data)
      .where(eq(templates.id, id))
      .returning();
    return updated;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }

  // Generation job operations
  async getGenerationJobs(userId: string): Promise<GenerationJob[]> {
    return db.select().from(generationJobs)
      .where(eq(generationJobs.userId, userId))
      .orderBy(desc(generationJobs.createdAt));
  }

  async getGenerationJob(id: string): Promise<GenerationJob | undefined> {
    const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, id));
    return job;
  }

  async createGenerationJob(job: InsertGenerationJob): Promise<GenerationJob> {
    const [created] = await db.insert(generationJobs).values(job).returning();
    return created;
  }

  async updateGenerationJob(id: string, data: Partial<GenerationJob>): Promise<GenerationJob | undefined> {
    const [updated] = await db
      .update(generationJobs)
      .set(data)
      .where(eq(generationJobs.id, id))
      .returning();
    return updated;
  }

  // Thumbnail operations
  async getThumbnails(userId: string): Promise<Thumbnail[]> {
    return db.select().from(thumbnails)
      .where(eq(thumbnails.userId, userId))
      .orderBy(desc(thumbnails.createdAt));
  }

  async getThumbnail(id: string): Promise<Thumbnail | undefined> {
    const [thumbnail] = await db.select().from(thumbnails).where(eq(thumbnails.id, id));
    return thumbnail;
  }

  async getThumbnailsByJobId(jobId: string): Promise<Thumbnail[]> {
    return db.select().from(thumbnails)
      .where(eq(thumbnails.jobId, jobId))
      .orderBy(thumbnails.variationIndex);
  }

  async createThumbnail(thumbnail: InsertThumbnail): Promise<Thumbnail> {
    const [created] = await db.insert(thumbnails).values(thumbnail).returning();
    return created;
  }

  async updateThumbnail(id: string, data: Partial<Thumbnail>): Promise<Thumbnail | undefined> {
    const [updated] = await db
      .update(thumbnails)
      .set(data)
      .where(eq(thumbnails.id, id))
      .returning();
    return updated;
  }

  async deleteThumbnail(id: string): Promise<void> {
    await db.delete(thumbnails).where(eq(thumbnails.id, id));
  }

  // A/B Test operations
  async getAbTests(userId: string): Promise<AbTest[]> {
    return db.select().from(abTests)
      .where(eq(abTests.userId, userId))
      .orderBy(desc(abTests.createdAt));
  }

  async getAbTest(id: string): Promise<AbTest | undefined> {
    const [test] = await db.select().from(abTests).where(eq(abTests.id, id));
    return test;
  }

  async createAbTest(test: InsertAbTest): Promise<AbTest> {
    const [created] = await db.insert(abTests).values(test).returning();
    return created;
  }

  async updateAbTest(id: string, data: Partial<AbTest>): Promise<AbTest | undefined> {
    const [updated] = await db
      .update(abTests)
      .set(data)
      .where(eq(abTests.id, id))
      .returning();
    return updated;
  }

  async deleteAbTest(id: string): Promise<void> {
    await db.delete(abTests).where(eq(abTests.id, id));
  }

  // Test Variant operations
  async getTestVariants(testId: string): Promise<TestVariant[]> {
    return db.select().from(testVariants)
      .where(eq(testVariants.testId, testId))
      .orderBy(desc(testVariants.ctr));
  }

  async getTestVariant(id: string): Promise<TestVariant | undefined> {
    const [variant] = await db.select().from(testVariants).where(eq(testVariants.id, id));
    return variant;
  }

  async createTestVariant(variant: InsertTestVariant): Promise<TestVariant> {
    const [created] = await db.insert(testVariants).values(variant).returning();
    return created;
  }

  async updateTestVariant(id: string, data: Partial<TestVariant>): Promise<TestVariant | undefined> {
    const [updated] = await db
      .update(testVariants)
      .set(data)
      .where(eq(testVariants.id, id))
      .returning();
    return updated;
  }

  async deleteTestVariant(id: string): Promise<void> {
    await db.delete(testVariants).where(eq(testVariants.id, id));
  }

  // Test Run operations
  async getTestRuns(testId: string): Promise<TestRun[]> {
    return db.select().from(testRuns)
      .where(eq(testRuns.testId, testId))
      .orderBy(desc(testRuns.recordedAt));
  }

  async createTestRun(run: Partial<TestRun>): Promise<TestRun> {
    const [created] = await db.insert(testRuns).values(run as any).returning();
    return created;
  }

  // Activity operations
  async logActivity(userId: string, action: string, resourceType?: string, resourceId?: string, metadata?: any): Promise<void> {
    await db.insert(userActivity).values({
      userId,
      action,
      resourceType,
      resourceId,
      metadata,
    });
  }

  async getUserActivity(userId: string, limit = 50): Promise<UserActivity[]> {
    return db.select().from(userActivity)
      .where(eq(userActivity.userId, userId))
      .orderBy(desc(userActivity.createdAt))
      .limit(limit);
  }

  // Payment operations
  async createPayment(payment: Partial<Payment>): Promise<Payment> {
    const [created] = await db.insert(payments).values(payment as any).returning();
    return created;
  }

  async getPayments(userId: string): Promise<Payment[]> {
    return db.select().from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));
  }

  // Analytics
  async getUserStats(userId: string): Promise<{
    totalThumbnails: number;
    activeTests: number;
    avgCtr: number;
    creditsRemaining: number;
  }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    const thumbResult = await db.select({ count: sql<number>`count(*)` })
      .from(thumbnails)
      .where(eq(thumbnails.userId, userId));
    
    const testsResult = await db.select({ count: sql<number>`count(*)` })
      .from(abTests)
      .where(and(eq(abTests.userId, userId), eq(abTests.status, 'running')));
    
    const ctrResult = await db.select({ avg: sql<number>`avg(${testVariants.ctr})` })
      .from(testVariants)
      .innerJoin(abTests, eq(testVariants.testId, abTests.id))
      .where(eq(abTests.userId, userId));

    return {
      totalThumbnails: Number(thumbResult[0]?.count) || 0,
      activeTests: Number(testsResult[0]?.count) || 0,
      avgCtr: Number(ctrResult[0]?.avg) || 0,
      creditsRemaining: user?.credits || 0,
    };
  }

  // YouTube Credentials operations
  async getYoutubeCredentials(userId: string): Promise<YoutubeCredentials | undefined> {
    const [creds] = await db.select().from(youtubeCredentials)
      .where(eq(youtubeCredentials.userId, userId));
    return creds;
  }

  async upsertYoutubeCredentials(data: Partial<YoutubeCredentials> & { userId: string }): Promise<YoutubeCredentials> {
    const [creds] = await db
      .insert(youtubeCredentials)
      .values(data as any)
      .onConflictDoUpdate({
        target: youtubeCredentials.userId,
        set: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          tokenExpiry: data.tokenExpiry,
          channelId: data.channelId,
          channelTitle: data.channelTitle,
          scopes: data.scopes,
          updatedAt: new Date(),
        },
      })
      .returning();
    return creds;
  }

  async updateYoutubeCredentials(id: string, data: Partial<YoutubeCredentials>): Promise<YoutubeCredentials | undefined> {
    const [updated] = await db
      .update(youtubeCredentials)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(youtubeCredentials.id, id))
      .returning();
    return updated;
  }

  // Campaign operations
  async getCampaigns(userId: string): Promise<Campaign[]> {
    return db.select().from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const [created] = await db.insert(campaigns).values(data).returning();
    return created;
  }

  async updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign | undefined> {
    const [updated] = await db
      .update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  async getActiveCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns)
      .where(and(
        sql`${campaigns.status} IN ('testing', 'optimizing')`,
        sql`${campaigns.nextScheduledRun} <= NOW()`
      ))
      .orderBy(campaigns.nextScheduledRun);
  }

  // Video Assets operations
  async getVideoAssets(campaignId: string, assetType?: string): Promise<VideoAsset[]> {
    if (assetType) {
      return db.select().from(videoAssets)
        .where(and(
          eq(videoAssets.campaignId, campaignId),
          eq(videoAssets.assetType, assetType as any)
        ))
        .orderBy(desc(videoAssets.createdAt));
    }
    return db.select().from(videoAssets)
      .where(eq(videoAssets.campaignId, campaignId))
      .orderBy(desc(videoAssets.createdAt));
  }

  async createVideoAsset(data: InsertVideoAsset): Promise<VideoAsset> {
    const [created] = await db.insert(videoAssets).values(data).returning();
    return created;
  }

  // Optimization Run operations
  async getOptimizationRuns(campaignId: string): Promise<OptimizationRun[]> {
    return db.select().from(optimizationRuns)
      .where(eq(optimizationRuns.campaignId, campaignId))
      .orderBy(desc(optimizationRuns.startedAt));
  }

  async createOptimizationRun(data: InsertOptimizationRun): Promise<OptimizationRun> {
    const [created] = await db.insert(optimizationRuns).values(data).returning();
    return created;
  }

  async updateOptimizationRun(id: string, data: Partial<OptimizationRun>): Promise<OptimizationRun | undefined> {
    const [updated] = await db
      .update(optimizationRuns)
      .set(data)
      .where(eq(optimizationRuns.id, id))
      .returning();
    return updated;
  }

  // Performance Snapshot operations
  async getPerformanceSnapshots(campaignId: string): Promise<PerformanceSnapshot[]> {
    return db.select().from(performanceSnapshots)
      .where(eq(performanceSnapshots.campaignId, campaignId))
      .orderBy(desc(performanceSnapshots.recordedAt));
  }

  async createPerformanceSnapshot(data: Partial<PerformanceSnapshot>): Promise<PerformanceSnapshot> {
    const [created] = await db.insert(performanceSnapshots).values(data as any).returning();
    return created;
  }

  // Campaign Thumbnails (thumbnails linked to a campaign via metadata)
  async getCampaignThumbnails(campaignId: string): Promise<Thumbnail[]> {
    return db.select().from(thumbnails)
      .where(sql`${thumbnails.metadata}->>'campaignId' = ${campaignId}`)
      .orderBy(desc(thumbnails.createdAt));
  }

  // Thumbnail Rotation operations - track discrete rotation windows
  async getRotations(campaignId: string): Promise<ThumbnailRotation[]> {
    return db.select().from(thumbnailRotations)
      .where(eq(thumbnailRotations.campaignId, campaignId))
      .orderBy(desc(thumbnailRotations.startedAt));
  }

  async getActiveRotation(campaignId: string): Promise<ThumbnailRotation | undefined> {
    const [rotation] = await db.select().from(thumbnailRotations)
      .where(and(
        eq(thumbnailRotations.campaignId, campaignId),
        eq(thumbnailRotations.isActive, true)
      ))
      .limit(1);
    return rotation;
  }

  async createRotation(data: InsertThumbnailRotation): Promise<ThumbnailRotation> {
    const [created] = await db.insert(thumbnailRotations).values(data).returning();
    return created;
  }

  async closeRotation(id: string, finalData: {
    endedAt: Date;
    finalViews: number;
    finalWatchMinutes: number;
    viewsDelta: number;
    watchMinutesDelta: number;
    exposureSeconds: number;
    viewVelocity: number;
    watchVelocity: number;
  }): Promise<ThumbnailRotation | undefined> {
    const [updated] = await db
      .update(thumbnailRotations)
      .set({
        ...finalData,
        isActive: false,
      })
      .where(eq(thumbnailRotations.id, id))
      .returning();
    return updated;
  }

  async getRotationsForThumbnail(campaignId: string, thumbnailId: string): Promise<ThumbnailRotation[]> {
    return db.select().from(thumbnailRotations)
      .where(and(
        eq(thumbnailRotations.campaignId, campaignId),
        eq(thumbnailRotations.thumbnailId, thumbnailId)
      ))
      .orderBy(desc(thumbnailRotations.startedAt));
  }

  // Bulk campaign operations
  async deleteCampaigns(ids: string[], userId: string): Promise<number> {
    const result = await db.delete(campaigns)
      .where(and(
        sql`${campaigns.id} = ANY(${ids})`,
        eq(campaigns.userId, userId)
      ));
    return ids.length;
  }

  // API Key operations
  async getApiKeys(userId: string): Promise<ApiKey[]> {
    return db.select().from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return key;
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    return key;
  }

  async createApiKey(data: InsertApiKey): Promise<ApiKey> {
    const [created] = await db.insert(apiKeys).values(data).returning();
    return created;
  }

  async updateApiKey(id: string, data: Partial<ApiKey>): Promise<ApiKey | undefined> {
    const [updated] = await db.update(apiKeys).set(data).where(eq(apiKeys.id, id)).returning();
    return updated;
  }

  async deleteApiKey(id: string): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

  // Webhook operations
  async getWebhooks(userId: string): Promise<Webhook[]> {
    return db.select().from(webhooks)
      .where(eq(webhooks.userId, userId))
      .orderBy(desc(webhooks.createdAt));
  }

  async getWebhook(id: string): Promise<Webhook | undefined> {
    const [hook] = await db.select().from(webhooks).where(eq(webhooks.id, id));
    return hook;
  }

  async getActiveWebhooksForEvent(userId: string, event: string): Promise<Webhook[]> {
    return db.select().from(webhooks)
      .where(and(
        eq(webhooks.userId, userId),
        eq(webhooks.isActive, true),
        sql`${event} = ANY(${webhooks.events})`
      ));
  }

  async createWebhook(data: InsertWebhook): Promise<Webhook> {
    const [created] = await db.insert(webhooks).values(data).returning();
    return created;
  }

  async updateWebhook(id: string, data: Partial<Webhook>): Promise<Webhook | undefined> {
    const [updated] = await db.update(webhooks).set(data).where(eq(webhooks.id, id)).returning();
    return updated;
  }

  async deleteWebhook(id: string): Promise<void> {
    await db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async logWebhookDelivery(data: {
    webhookId: string;
    event: string;
    payload: any;
    statusCode: number;
    response: string;
    success: boolean;
  }): Promise<void> {
    await db.insert(webhookDeliveries).values(data);
  }

  async getWebhookDeliveries(webhookId: string, limit = 20): Promise<WebhookDelivery[]> {
    return db.select().from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.deliveredAt))
      .limit(limit);
  }

  // Stripe data operations - query from stripe.* schema (managed by stripe-replit-sync)
  async getStripeProduct(productId: string): Promise<any> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] || null;
  }

  async listStripeProducts(active = true, limit = 20, offset = 0): Promise<any[]> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return result.rows;
  }

  async listStripeProductsWithPrices(active = true, limit = 20, offset = 0): Promise<any[]> {
    const result = await db.execute(
      sql`
        WITH paginated_products AS (
          SELECT id, name, description, metadata, active
          FROM stripe.products
          WHERE active = ${active}
          ORDER BY id
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.active as product_active,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active,
          pr.metadata as price_metadata
        FROM paginated_products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        ORDER BY p.id, pr.unit_amount
      `
    );
    return result.rows;
  }

  async getStripePrice(priceId: string): Promise<any> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE id = ${priceId}`
    );
    return result.rows[0] || null;
  }

  async getStripePricesForProduct(productId: string): Promise<any[]> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE product = ${productId} AND active = true`
    );
    return result.rows;
  }

  async getStripeSubscription(subscriptionId: string): Promise<any> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] || null;
  }

  async getStripeCustomer(customerId: string): Promise<any> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.customers WHERE id = ${customerId}`
    );
    return result.rows[0] || null;
  }

  // User Stripe info updates
  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'trialing';
    subscriptionPlan?: string;
  }): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ ...stripeInfo, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Analysis Job operations
  async getAnalysisJobs(userId: string): Promise<AnalysisJob[]> {
    return db.select().from(analysisJobs)
      .where(eq(analysisJobs.userId, userId))
      .orderBy(desc(analysisJobs.createdAt));
  }

  async getAnalysisJob(id: string): Promise<AnalysisJob | undefined> {
    const [job] = await db.select().from(analysisJobs).where(eq(analysisJobs.id, id));
    return job;
  }

  async createAnalysisJob(data: InsertAnalysisJob): Promise<AnalysisJob> {
    const [created] = await db.insert(analysisJobs).values(data).returning();
    return created;
  }

  async updateAnalysisJob(id: string, data: Partial<AnalysisJob>): Promise<AnalysisJob | undefined> {
    const [updated] = await db.update(analysisJobs)
      .set(data)
      .where(eq(analysisJobs.id, id))
      .returning();
    return updated;
  }

  // Hook Insight operations
  async getHookInsights(userId: string, youtubeVideoId?: string): Promise<HookInsight[]> {
    if (youtubeVideoId) {
      return db.select().from(hookInsights)
        .where(and(
          eq(hookInsights.userId, userId),
          eq(hookInsights.youtubeVideoId, youtubeVideoId)
        ))
        .orderBy(hookInsights.timestampSeconds);
    }
    return db.select().from(hookInsights)
      .where(eq(hookInsights.userId, userId))
      .orderBy(desc(hookInsights.createdAt));
  }

  async getHookInsightsByJobId(jobId: string): Promise<HookInsight[]> {
    const job = await this.getAnalysisJob(jobId);
    if (!job) return [];
    return db.select().from(hookInsights)
      .where(and(
        eq(hookInsights.userId, job.userId),
        eq(hookInsights.youtubeVideoId, job.youtubeVideoId)
      ))
      .orderBy(hookInsights.timestampSeconds);
  }

  async createHookInsight(data: InsertHookInsight): Promise<HookInsight> {
    const [created] = await db.insert(hookInsights).values(data).returning();
    return created;
  }

  async createHookInsights(data: InsertHookInsight[]): Promise<HookInsight[]> {
    if (data.length === 0) return [];
    const created = await db.insert(hookInsights).values(data).returning();
    return created;
  }

  async deleteHookInsightsForVideo(userId: string, youtubeVideoId: string): Promise<void> {
    await db.delete(hookInsights)
      .where(and(
        eq(hookInsights.userId, userId),
        eq(hookInsights.youtubeVideoId, youtubeVideoId)
      ));
  }
}

export const storage = new DatabaseStorage();

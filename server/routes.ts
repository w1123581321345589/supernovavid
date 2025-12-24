import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { geminiService } from "./gemini";
import { youtubeService } from "./youtube";
import { campaignService } from "./campaign";
import { scheduler } from "./scheduler";
import { wsService } from "./websocket";
import { statisticsService } from "./statistics";
import { stripeService } from "./stripeService";
import { getStripePublishableKey, getUncachableStripeClient } from "./stripeClient";
import { 
  insertTemplateSchema, 
  insertAbTestSchema, 
  insertTestVariantSchema,
  insertGenerationJobSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User stats
  app.get("/api/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Templates
  app.get("/api/templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const includePublic = req.query.public === "true";
      const templates = includePublic 
        ? await storage.getTemplates() 
        : await storage.getTemplates(userId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.post("/api/templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertTemplateSchema.parse({ ...req.body, userId });
      const template = await storage.createTemplate(data);
      await storage.logActivity(userId, "create_template", "template", template.id);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(400).json({ message: "Failed to create template" });
    }
  });

  app.get("/api/templates/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templates = await storage.getTemplates(userId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching user templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.patch("/api/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const template = await storage.getTemplate(req.params.id);
      if (!template || template.userId !== userId) {
        return res.status(404).json({ message: "Template not found" });
      }
      const updated = await storage.updateTemplate(req.params.id, req.body);
      await storage.logActivity(userId, "update_template", "template", req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const template = await storage.getTemplate(req.params.id);
      if (!template || template.userId !== userId) {
        return res.status(404).json({ message: "Template not found" });
      }
      await storage.deleteTemplate(req.params.id);
      await storage.logActivity(userId, "delete_template", "template", req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Thumbnails
  app.get("/api/thumbnails", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const thumbnails = await storage.getThumbnails(userId);
      res.json(thumbnails);
    } catch (error) {
      console.error("Error fetching thumbnails:", error);
      res.status(500).json({ message: "Failed to fetch thumbnails" });
    }
  });

  app.delete("/api/thumbnails/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const thumbnail = await storage.getThumbnail(req.params.id);
      if (!thumbnail || thumbnail.userId !== userId) {
        return res.status(404).json({ message: "Thumbnail not found" });
      }
      await storage.deleteThumbnail(req.params.id);
      await storage.logActivity(userId, "delete_thumbnail", "thumbnail", req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting thumbnail:", error);
      res.status(500).json({ message: "Failed to delete thumbnail" });
    }
  });

  // Chat-to-Edit endpoint for thumbnail refinement
  app.post("/api/thumbnails/:id/edit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const thumbnail = await storage.getThumbnail(req.params.id);
      
      if (!thumbnail || thumbnail.userId !== userId) {
        return res.status(404).json({ message: "Thumbnail not found" });
      }

      const { editCommand } = req.body;
      if (!editCommand || typeof editCommand !== 'string' || editCommand.trim().length === 0) {
        return res.status(400).json({ message: "Edit command is required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.credits < 1) {
        return res.status(402).json({ message: "Insufficient credits" });
      }

      // Deduct 1 credit for the edit
      await storage.updateUserCredits(userId, user.credits - 1);

      const result = await geminiService.editThumbnail(
        thumbnail.id,
        userId,
        thumbnail.imageUrl,
        thumbnail.prompt || "YouTube thumbnail",
        editCommand.trim()
      );

      await storage.logActivity(userId, "edit_thumbnail", "thumbnail", result.thumbnailId, { 
        originalThumbnailId: thumbnail.id,
        editCommand,
      });

      // Fetch the newly created thumbnail
      const newThumbnail = await storage.getThumbnail(result.thumbnailId);

      res.json({
        success: true,
        thumbnail: newThumbnail,
        message: result.message,
      });
    } catch (error) {
      console.error("Error editing thumbnail:", error);
      res.status(500).json({ message: "Failed to edit thumbnail" });
    }
  });

  // Generation Jobs
  app.get("/api/generation-jobs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const jobs = await storage.getGenerationJobs(userId);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching generation jobs:", error);
      res.status(500).json({ message: "Failed to fetch generation jobs" });
    }
  });

  app.get("/api/generation-jobs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const job = await storage.getGenerationJob(req.params.id);
      if (!job || job.userId !== userId) {
        return res.status(404).json({ message: "Job not found" });
      }
      const thumbnails = await storage.getThumbnailsByJobId(job.id);
      res.json({ ...job, thumbnails });
    } catch (error) {
      console.error("Error fetching generation job:", error);
      res.status(500).json({ message: "Failed to fetch generation job" });
    }
  });

  app.post("/api/generation-jobs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.credits < 1) {
        return res.status(402).json({ message: "Insufficient credits" });
      }

      const data = insertGenerationJobSchema.parse({ ...req.body, userId });
      const job = await storage.createGenerationJob(data);
      await storage.logActivity(userId, "create_generation_job", "generation_job", job.id);
      
      // Deduct credits
      const variationCount = data.variationCount || 4;
      await storage.updateUserCredits(userId, user.credits - variationCount);

      // Start generation in background
      geminiService.generateThumbnails(job.id, data.prompt, variationCount, userId)
        .catch((err: Error) => console.error("Background generation error:", err));

      res.status(201).json(job);
    } catch (error) {
      console.error("Error creating generation job:", error);
      res.status(400).json({ message: "Failed to create generation job" });
    }
  });

  // A/B Tests
  app.get("/api/tests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tests = await storage.getAbTests(userId);
      
      // Fetch variants for each test including thumbnails
      const testsWithVariants = await Promise.all(
        tests.map(async (test) => {
          const variants = await storage.getTestVariants(test.id);
          const variantsWithThumbnails = await Promise.all(
            variants.map(async (variant) => {
              const thumbnail = await storage.getThumbnail(variant.thumbnailId);
              return { ...variant, thumbnail };
            })
          );
          return { ...test, variants: variantsWithThumbnails };
        })
      );
      
      res.json(testsWithVariants);
    } catch (error) {
      console.error("Error fetching tests:", error);
      res.status(500).json({ message: "Failed to fetch tests" });
    }
  });

  app.get("/api/tests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const test = await storage.getAbTest(req.params.id);
      if (!test || test.userId !== userId) {
        return res.status(404).json({ message: "Test not found" });
      }
      const variants = await storage.getTestVariants(test.id);
      const runs = await storage.getTestRuns(test.id);
      res.json({ ...test, variants, runs });
    } catch (error) {
      console.error("Error fetching test:", error);
      res.status(500).json({ message: "Failed to fetch test" });
    }
  });

  app.post("/api/tests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertAbTestSchema.parse({ ...req.body, userId });
      const test = await storage.createAbTest(data);
      await storage.logActivity(userId, "create_test", "ab_test", test.id);
      res.status(201).json(test);
    } catch (error) {
      console.error("Error creating test:", error);
      res.status(400).json({ message: "Failed to create test" });
    }
  });

  app.patch("/api/tests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const test = await storage.getAbTest(req.params.id);
      if (!test || test.userId !== userId) {
        return res.status(404).json({ message: "Test not found" });
      }
      const updated = await storage.updateAbTest(req.params.id, req.body);
      await storage.logActivity(userId, "update_test", "ab_test", req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error updating test:", error);
      res.status(500).json({ message: "Failed to update test" });
    }
  });

  app.post("/api/tests/:id/start", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const test = await storage.getAbTest(req.params.id);
      if (!test || test.userId !== userId) {
        return res.status(404).json({ message: "Test not found" });
      }
      const updated = await storage.updateAbTest(req.params.id, {
        status: "running",
        startedAt: new Date(),
      });
      await storage.logActivity(userId, "start_test", "ab_test", req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error starting test:", error);
      res.status(500).json({ message: "Failed to start test" });
    }
  });

  app.post("/api/tests/:id/stop", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const test = await storage.getAbTest(req.params.id);
      if (!test || test.userId !== userId) {
        return res.status(404).json({ message: "Test not found" });
      }
      const updated = await storage.updateAbTest(req.params.id, {
        status: "completed",
        endedAt: new Date(),
      });
      await storage.logActivity(userId, "stop_test", "ab_test", req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error stopping test:", error);
      res.status(500).json({ message: "Failed to stop test" });
    }
  });

  app.delete("/api/tests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const test = await storage.getAbTest(req.params.id);
      if (!test || test.userId !== userId) {
        return res.status(404).json({ message: "Test not found" });
      }
      await storage.deleteAbTest(req.params.id);
      await storage.logActivity(userId, "delete_test", "ab_test", req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting test:", error);
      res.status(500).json({ message: "Failed to delete test" });
    }
  });

  // Test Variants
  app.post("/api/tests/:testId/variants", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const test = await storage.getAbTest(req.params.testId);
      if (!test || test.userId !== userId) {
        return res.status(404).json({ message: "Test not found" });
      }
      const data = insertTestVariantSchema.parse({ ...req.body, testId: req.params.testId });
      const variant = await storage.createTestVariant(data);
      await storage.logActivity(userId, "add_variant", "test_variant", variant.id);
      res.status(201).json(variant);
    } catch (error) {
      console.error("Error creating variant:", error);
      res.status(400).json({ message: "Failed to create variant" });
    }
  });

  app.delete("/api/tests/:testId/variants/:variantId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const test = await storage.getAbTest(req.params.testId);
      if (!test || test.userId !== userId) {
        return res.status(404).json({ message: "Test not found" });
      }
      await storage.deleteTestVariant(req.params.variantId);
      await storage.logActivity(userId, "remove_variant", "test_variant", req.params.variantId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting variant:", error);
      res.status(500).json({ message: "Failed to delete variant" });
    }
  });

  // Simulate CTR update (in production this would come from YouTube API webhooks)
  app.post("/api/tests/:testId/simulate-ctr", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const test = await storage.getAbTest(req.params.testId);
      if (!test || test.userId !== userId) {
        return res.status(404).json({ message: "Test not found" });
      }
      
      const variants = await storage.getTestVariants(req.params.testId);
      
      for (const variant of variants) {
        const currentImpressions = variant.impressions || 0;
        const currentClicks = variant.clicks || 0;
        const newImpressions = currentImpressions + Math.floor(Math.random() * 100) + 10;
        const newClicks = currentClicks + Math.floor(Math.random() * 10) + 1;
        const newCtr = (newClicks / newImpressions) * 100;
        
        await storage.updateTestVariant(variant.id, {
          impressions: newImpressions,
          clicks: newClicks,
          ctr: newCtr,
        });
        
        await storage.createTestRun({
          testId: req.params.testId,
          variantId: variant.id,
          impressions: newImpressions,
          clicks: newClicks,
          ctr: newCtr,
        });
      }
      
      const updatedVariants = await storage.getTestVariants(req.params.testId);
      res.json(updatedVariants);
    } catch (error) {
      console.error("Error simulating CTR:", error);
      res.status(500).json({ message: "Failed to simulate CTR" });
    }
  });

  // Declare winner
  app.post("/api/tests/:id/declare-winner", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const test = await storage.getAbTest(req.params.id);
      if (!test || test.userId !== userId) {
        return res.status(404).json({ message: "Test not found" });
      }
      
      const { variantId } = req.body;
      await storage.updateTestVariant(variantId, { isWinner: true });
      const updated = await storage.updateAbTest(req.params.id, {
        status: "completed",
        winnerId: variantId,
        endedAt: new Date(),
      });
      
      await storage.logActivity(userId, "declare_winner", "ab_test", req.params.id, { winnerId: variantId });
      res.json(updated);
    } catch (error) {
      console.error("Error declaring winner:", error);
      res.status(500).json({ message: "Failed to declare winner" });
    }
  });

  // Activity log
  app.get("/api/activity", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const activity = await storage.getUserActivity(userId, limit);
      res.json(activity);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  // YouTube OAuth routes
  app.get("/api/youtube/auth-url", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const authUrl = youtubeService.getAuthUrl(userId);
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating YouTube auth URL:", error);
      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  app.get("/api/youtube/callback", async (req: any, res) => {
    try {
      const { code, state: userId } = req.query;
      if (!code || !userId) {
        return res.status(400).send("Missing code or user ID");
      }
      await youtubeService.handleCallback(code as string, userId as string);
      res.redirect("/dashboard?youtube=connected");
    } catch (error) {
      console.error("YouTube OAuth callback error:", error);
      res.redirect("/dashboard?youtube=error");
    }
  });

  app.get("/api/youtube/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const credentials = await storage.getYoutubeCredentials(userId);
      res.json({ 
        connected: !!credentials,
        channelTitle: credentials?.channelTitle,
        channelId: credentials?.channelId,
      });
    } catch (error) {
      console.error("Error checking YouTube status:", error);
      res.status(500).json({ message: "Failed to check YouTube status" });
    }
  });

  app.get("/api/youtube/videos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const credentials = await storage.getYoutubeCredentials(userId);
      
      if (!credentials || !credentials.channelId) {
        return res.status(400).json({ 
          message: "Please connect your YouTube channel first",
          requiresYoutubeAuth: true,
        });
      }
      
      const accessToken = await youtubeService.refreshAccessToken(credentials);
      const videos = await youtubeService.getChannelVideos(accessToken, credentials.channelId);
      
      res.json(videos);
    } catch (error) {
      console.error("Error fetching YouTube videos:", error);
      res.status(500).json({ message: "Failed to fetch YouTube videos" });
    }
  });

  // Campaign routes
  app.get("/api/campaigns", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const campaigns = await storage.getCampaigns(userId);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = await campaignService.getCampaignStatus(req.params.id);
      if (status.campaign.userId !== userId) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(status);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { youtubeVideoUrl } = req.body;
      
      // Validate URL is provided
      if (!youtubeVideoUrl || typeof youtubeVideoUrl !== 'string') {
        return res.status(400).json({ message: "YouTube video URL is required" });
      }

      // Trim and sanitize input
      const cleanUrl = youtubeVideoUrl.trim();
      
      // Validate URL format
      const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
      if (!youtubeUrlPattern.test(cleanUrl)) {
        return res.status(400).json({ 
          message: "Invalid YouTube URL format. Please use a valid YouTube video link.",
          field: "youtubeVideoUrl",
        });
      }

      // Extract video ID for duplicate check
      const videoId = youtubeService.extractVideoId(cleanUrl);
      if (!videoId) {
        return res.status(400).json({ message: "Could not extract video ID from URL" });
      }

      // Check for duplicate campaign for this video
      const existingCampaigns = await storage.getCampaigns(userId);
      const duplicate = existingCampaigns.find((c: any) => 
        c.youtubeVideoId === videoId && 
        ['analyzing', 'generating', 'testing', 'optimizing', 'pending_payment'].includes(c.status)
      );
      
      if (duplicate) {
        return res.status(409).json({ 
          message: "You already have an active campaign for this video",
          existingCampaignId: duplicate.id,
        });
      }

      // Check YouTube connection
      const credentials = await storage.getYoutubeCredentials(userId);
      if (!credentials) {
        return res.status(400).json({ 
          message: "Please connect your YouTube channel first",
          requiresYoutubeAuth: true,
        });
      }

      // Verify the video belongs to user's channel
      try {
        const accessToken = await youtubeService.refreshAccessToken(credentials);
        const videoInfo = await youtubeService.getVideoInfo(videoId, accessToken);
        
        if (videoInfo.channelId !== credentials.channelId) {
          return res.status(403).json({ 
            message: "This video does not belong to your connected YouTube channel",
            field: "youtubeVideoUrl",
          });
        }
      } catch (error: any) {
        console.error("Error verifying video ownership:", error);
        const errorMessage = error?.message || "Unknown error";
        
        // Provide more specific error messages
        if (errorMessage.includes("Video not found")) {
          return res.status(400).json({ 
            message: "Video not found. Check the URL and make sure the video is public.",
            field: "youtubeVideoUrl",
          });
        } else if (errorMessage.includes("quota")) {
          return res.status(429).json({ 
            message: "YouTube API quota exceeded. Please try again later.",
          });
        } else {
          return res.status(400).json({ 
            message: "Could not verify video. Make sure it exists and is accessible.",
            field: "youtubeVideoUrl",
          });
        }
      }

      const campaign = await campaignService.createCampaign(userId, cleanUrl);
      await storage.logActivity(userId, "create_campaign", "campaign", campaign.id);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create campaign" });
    }
  });

  app.post("/api/campaigns/:id/trigger-optimization", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.userId !== userId) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      await scheduler.manualTrigger(req.params.id);
      res.json({ message: "Optimization triggered" });
    } catch (error) {
      console.error("Error triggering optimization:", error);
      res.status(500).json({ message: "Failed to trigger optimization" });
    }
  });

  app.post("/api/campaigns/:id/duplicate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.userId !== userId) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      const newCampaign = await storage.createCampaign({
        userId,
        youtubeVideoId: campaign.youtubeVideoId,
        youtubeVideoUrl: `https://www.youtube.com/watch?v=${campaign.youtubeVideoId}`,
        videoTitle: `${campaign.videoTitle} (Copy)`,
        originalThumbnailUrl: campaign.originalThumbnailUrl,
        maxIterations: campaign.maxIterations,
      });
      
      await storage.logActivity(userId, "duplicate_campaign", "campaign", newCampaign.id, { originalId: req.params.id });
      res.status(201).json(newCampaign);
    } catch (error) {
      console.error("Error duplicating campaign:", error);
      res.status(500).json({ message: "Failed to duplicate campaign" });
    }
  });

  app.get("/api/tests/:id/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const test = await storage.getAbTest(req.params.id);
      if (!test || test.userId !== userId) {
        return res.status(404).json({ message: "Test not found" });
      }
      
      const variants = await storage.getTestVariants(req.params.id);
      const runs = await storage.getTestRuns(req.params.id);
      
      const exportData = {
        test: {
          id: test.id,
          name: test.name,
          description: test.description,
          status: test.status,
          createdAt: test.createdAt,
          startedAt: test.startedAt,
          endedAt: test.endedAt,
        },
        variants: variants.map(v => ({
          id: v.id,
          name: v.name,
          impressions: v.impressions,
          clicks: v.clicks,
          ctr: v.ctr,
          isWinner: v.isWinner,
        })),
        runs: runs.map(r => ({
          timestamp: r.recordedAt || new Date(),
          variantId: r.variantId,
          impressions: r.impressions,
          clicks: r.clicks,
          ctr: r.ctr,
        })),
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="test-${test.id}-results.json"`);
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting test results:", error);
      res.status(500).json({ message: "Failed to export test results" });
    }
  });

  // Analytics endpoint for campaign statistics
  app.get("/api/campaigns/:id/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.userId !== userId) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const [snapshots, runs, thumbnails] = await Promise.all([
        storage.getPerformanceSnapshots(req.params.id),
        storage.getOptimizationRuns(req.params.id),
        storage.getCampaignThumbnails(req.params.id),
      ]);

      // Calculate statistics
      const variantStats = thumbnails.map(thumb => {
        const thumbSnapshots = snapshots.filter(s => s.thumbnailId === thumb.id);
        const totalImpressions = thumbSnapshots.reduce((sum, s) => sum + (s.impressions || 0), 0);
        const totalClicks = thumbSnapshots.reduce((sum, s) => sum + (s.clicks || 0), 0);
        const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        
        return {
          id: thumb.id,
          name: thumb.name,
          imageUrl: thumb.imageUrl,
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr,
        };
      }).filter(v => v.impressions > 0);

      // Find winner with confidence
      let confidenceResult = null;
      if (variantStats.length >= 2) {
        confidenceResult = statisticsService.findWinner(variantStats, 0.95);
      }

      // Calculate improvement from baseline
      const sortedSnapshots = [...snapshots].sort((a, b) => 
        new Date(a.recordedAt || 0).getTime() - new Date(b.recordedAt || 0).getTime()
      );
      const baselineCtr = sortedSnapshots[0]?.ctr || 0;
      const currentBestCtr = Math.max(...variantStats.map(v => v.ctr), 0);
      const improvement = statisticsService.calculateImprovement(baselineCtr, currentBestCtr);

      // CTR timeline data
      const timeline = snapshots.map(s => ({
        date: s.recordedAt,
        ctr: s.ctr,
        impressions: s.impressions,
        thumbnailId: s.thumbnailId,
      })).sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

      res.json({
        campaign,
        variantStats,
        confidenceResult,
        improvement,
        baselineCtr,
        currentBestCtr,
        timeline,
        runs: runs.slice(0, 10), // Last 10 runs
        totalIterations: campaign.currentIteration || 0,
      });
    } catch (error) {
      console.error("Error fetching campaign analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Demo mode: Create a simulated campaign for testing without real YouTube
  app.post("/api/campaigns/demo", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Create demo campaign with fake data
      const demoVideoId = `demo_${Date.now()}`;
      const campaign = await storage.createCampaign({
        userId,
        youtubeVideoId: demoVideoId,
        youtubeVideoUrl: `https://youtube.com/watch?v=${demoVideoId}`,
        videoTitle: "Demo: How to Get 10x More Views on YouTube",
        originalThumbnailUrl: "https://placehold.co/1280x720/2563eb/ffffff?text=Demo+Thumbnail",
        priceAmount: 0,
      });

      // Immediately set to analyzing for demo flow
      await storage.updateCampaign(campaign.id, { status: 'analyzing' });
      wsService.notifyStatusChange(campaign.id, 'analyzing', { message: 'Demo: Analyzing video...' });

      // Start simulated pipeline in background
      simulateDemoCampaign(campaign.id, userId).catch(err => 
        console.error('Demo campaign error:', err)
      );

      await storage.logActivity(userId, "create_demo_campaign", "campaign", campaign.id);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating demo campaign:", error);
      res.status(400).json({ message: "Failed to create demo campaign" });
    }
  });

  // Helper to simulate demo campaign progression
  async function simulateDemoCampaign(campaignId: string, userId: string): Promise<void> {
    // Wait then transition through states
    await new Promise(r => setTimeout(r, 3000));
    
    // Simulate analysis complete
    await storage.updateCampaign(campaignId, { status: 'generating' });
    wsService.notifyStatusChange(campaignId, 'generating', { message: 'Demo: Generating thumbnails...' });

    // Create demo thumbnails (using placeholder images)
    const thumbnailVariants = [
      { name: 'Bold Text Style', url: 'https://placehold.co/1280x720/dc2626/ffffff?text=SHOCKING+RESULTS' },
      { name: 'Curiosity Gap', url: 'https://placehold.co/1280x720/7c3aed/ffffff?text=You+Wont+Believe+This' },
      { name: 'Minimal Clean', url: 'https://placehold.co/1280x720/0891b2/ffffff?text=Simple+%26+Clean' },
      { name: 'High Contrast', url: 'https://placehold.co/1280x720/ea580c/000000?text=HIGH+CONTRAST' },
    ];

    for (let i = 0; i < thumbnailVariants.length; i++) {
      await storage.createThumbnail({
        userId,
        name: thumbnailVariants[i].name,
        imageUrl: thumbnailVariants[i].url,
        variationIndex: i,
        prompt: 'Demo thumbnail',
        metadata: { campaignId, isDemo: true },
      });
    }

    await new Promise(r => setTimeout(r, 2000));
    
    // Move to testing
    await storage.updateCampaign(campaignId, { 
      status: 'testing',
      currentIteration: 1,
      nextScheduledRun: new Date(Date.now() + 4 * 60 * 60 * 1000),
    });
    wsService.notifyStatusChange(campaignId, 'testing', { message: 'Demo: A/B testing started!' });

    const run = await storage.createOptimizationRun({
      campaignId,
      iteration: 1,
    });
    wsService.notifyOptimizationRun(campaignId, run);
  }

  // Bulk campaign operations
  app.delete("/api/campaigns/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No campaign IDs provided" });
      }
      const deleted = await storage.deleteCampaigns(ids, userId);
      await storage.logActivity(userId, "bulk_delete_campaigns", "campaigns", undefined, { count: deleted });
      res.json({ deleted });
    } catch (error) {
      console.error("Error bulk deleting campaigns:", error);
      res.status(500).json({ message: "Failed to delete campaigns" });
    }
  });

  // API Key management
  app.get("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const keys = await storage.getApiKeys(userId);
      res.json(keys.map(k => ({ ...k, keyHash: undefined })));
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  app.post("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, permissions, expiresAt } = req.body;
      
      const crypto = await import('crypto');
      const rawKey = `tg_${crypto.randomBytes(32).toString('hex')}`;
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.substring(0, 10);
      
      const apiKey = await storage.createApiKey({
        userId,
        name,
        keyHash,
        keyPrefix,
        permissions: permissions || ['read'],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      });
      
      await storage.logActivity(userId, "create_api_key", "api_key", apiKey.id);
      res.status(201).json({ ...apiKey, key: rawKey, keyHash: undefined });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(400).json({ message: "Failed to create API key" });
    }
  });

  app.delete("/api/api-keys/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const key = await storage.getApiKey(req.params.id);
      if (!key || key.userId !== userId) {
        return res.status(404).json({ message: "API key not found" });
      }
      await storage.deleteApiKey(req.params.id);
      await storage.logActivity(userId, "delete_api_key", "api_key", req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  // Webhook management
  app.get("/api/webhooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const hooks = await storage.getWebhooks(userId);
      res.json(hooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ message: "Failed to fetch webhooks" });
    }
  });

  app.post("/api/webhooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, url, events } = req.body;
      
      const crypto = await import('crypto');
      const secret = crypto.randomBytes(32).toString('hex');
      
      const webhook = await storage.createWebhook({
        userId,
        name,
        url,
        secret,
        events: events || ['campaign.status_changed'],
        isActive: true,
      });
      
      await storage.logActivity(userId, "create_webhook", "webhook", webhook.id);
      res.status(201).json(webhook);
    } catch (error) {
      console.error("Error creating webhook:", error);
      res.status(400).json({ message: "Failed to create webhook" });
    }
  });

  app.patch("/api/webhooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const hook = await storage.getWebhook(req.params.id);
      if (!hook || hook.userId !== userId) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      const updated = await storage.updateWebhook(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating webhook:", error);
      res.status(500).json({ message: "Failed to update webhook" });
    }
  });

  app.delete("/api/webhooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const hook = await storage.getWebhook(req.params.id);
      if (!hook || hook.userId !== userId) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      await storage.deleteWebhook(req.params.id);
      await storage.logActivity(userId, "delete_webhook", "webhook", req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting webhook:", error);
      res.status(500).json({ message: "Failed to delete webhook" });
    }
  });

  app.get("/api/webhooks/:id/deliveries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const hook = await storage.getWebhook(req.params.id);
      if (!hook || hook.userId !== userId) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      const deliveries = await storage.getWebhookDeliveries(req.params.id);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching webhook deliveries:", error);
      res.status(500).json({ message: "Failed to fetch deliveries" });
    }
  });

  // Test webhook endpoint
  app.post("/api/webhooks/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const hook = await storage.getWebhook(req.params.id);
      if (!hook || hook.userId !== userId) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      
      const payload = { event: 'test', timestamp: new Date().toISOString(), message: 'This is a test webhook' };
      
      try {
        const response = await fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': hook.secret || '',
          },
          body: JSON.stringify(payload),
        });
        
        await storage.logWebhookDelivery({
          webhookId: hook.id,
          event: 'test',
          payload,
          statusCode: response.status,
          response: await response.text(),
          success: response.ok,
        });
        
        res.json({ success: response.ok, statusCode: response.status });
      } catch (err: any) {
        await storage.logWebhookDelivery({
          webhookId: hook.id,
          event: 'test',
          payload,
          statusCode: 0,
          response: err.message,
          success: false,
        });
        res.json({ success: false, error: err.message });
      }
    } catch (error) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ message: "Failed to test webhook" });
    }
  });

  // Stripe checkout routes
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting publishable key:", error);
      res.status(500).json({ message: "Failed to get Stripe configuration" });
    }
  });

  app.get("/api/stripe/products", async (req, res) => {
    try {
      const products = await stripeService.listProductsWithPrices();
      
      // Group prices by product
      const productsMap = new Map();
      for (const row of products) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
            metadata: row.price_metadata,
          });
        }
      }

      res.json({ data: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post("/api/stripe/create-checkout-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { priceId, mode = 'subscription' } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: "Price ID is required" });
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create or get customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email || '', userId);
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      // Get base URL for redirects
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const baseUrl = `${protocol}://${host}`;

      // Create checkout session with userId metadata
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/pricing?checkout=cancelled`,
        mode as 'subscription' | 'payment',
        userId
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/create-portal-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No billing account found" });
      }

      // Get base URL for redirect
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const returnUrl = `${protocol}://${host}/dashboard`;

      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        returnUrl
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });

  app.get("/api/stripe/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        hasSubscription: !!user.subscriptionStatus && user.subscriptionStatus === 'active',
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        stripeCustomerId: user.stripeCustomerId,
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // =====================
  // Video Analyzer Routes
  // =====================

  // Helper to extract YouTube video ID from various URL formats
  function parseYouTubeVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  // Create analysis job and start processing
  app.post("/api/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { youtubeVideoUrl, hookCount = 3 } = req.body;

      if (!youtubeVideoUrl) {
        return res.status(400).json({ message: "YouTube video URL is required" });
      }

      const videoId = parseYouTubeVideoId(youtubeVideoUrl);
      if (!videoId) {
        return res.status(400).json({ message: "Invalid YouTube video URL" });
      }

      // Create job
      const job = await storage.createAnalysisJob({
        userId,
        youtubeVideoId: videoId,
        youtubeVideoUrl,
        hookCount: Math.min(10, Math.max(1, hookCount)),
      });

      // Start processing in background (use sanitized hookCount from job)
      processAnalysisJob(job.id, userId, videoId, job.hookCount).catch(err => {
        console.error('Background analysis error:', err);
      });

      res.status(201).json({ jobId: job.id, status: 'pending' });
    } catch (error) {
      console.error("Error creating analysis job:", error);
      res.status(500).json({ message: "Failed to start analysis" });
    }
  });

  // Background processing function
  async function processAnalysisJob(
    jobId: string, 
    userId: string, 
    videoId: string, 
    hookCount: number
  ): Promise<void> {
    try {
      await storage.updateAnalysisJob(jobId, { status: 'processing' });

      // Get transcript
      const transcriptSegments = await youtubeService.getVideoTranscript(videoId);
      if (transcriptSegments.length === 0) {
        await storage.updateAnalysisJob(jobId, { 
          status: 'failed', 
          errorMessage: 'No transcript available for this video' 
        });
        return;
      }

      const transcript = transcriptSegments.map(s => s.text).join(' ');

      // Get video title from transcript page or use videoId as fallback
      let videoTitle = videoId;
      try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
        const html = await response.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          videoTitle = titleMatch[1].replace(' - YouTube', '').trim();
        }
      } catch (e) {
        console.log('Could not fetch video title, using ID');
      }

      // Update job with video title
      const job = await storage.updateAnalysisJob(jobId, { videoTitle });

      // Analyze with Gemini
      const analysis = await geminiService.analyzeVideoHooks(transcript, videoTitle, hookCount);

      if (analysis.hooks.length === 0) {
        await storage.updateAnalysisJob(jobId, { 
          status: 'failed', 
          errorMessage: 'Could not identify viral moments in this video' 
        });
        return;
      }

      // Delete any existing insights for this video and save new ones
      await storage.deleteHookInsightsForVideo(userId, videoId);
      
      const insights = analysis.hooks.map(hook => ({
        userId,
        youtubeVideoId: videoId,
        youtubeVideoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoTitle,
        timestampSeconds: hook.timestampSeconds,
        hookTitle: hook.hookTitle,
        thumbnailText: hook.thumbnailText,
        strategy: hook.strategy,
        confidenceScore: hook.confidenceScore,
      }));

      await storage.createHookInsights(insights);

      await storage.updateAnalysisJob(jobId, { 
        status: 'completed',
        completedAt: new Date(),
      });
    } catch (error) {
      console.error('Analysis job failed:', error);
      await storage.updateAnalysisJob(jobId, { 
        status: 'failed', 
        errorMessage: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Get analysis job status and results
  app.get("/api/analyze/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const job = await storage.getAnalysisJob(req.params.jobId);
      
      if (!job || job.userId !== userId) {
        return res.status(404).json({ message: "Analysis job not found" });
      }

      let insights: any[] = [];
      if (job.status === 'completed') {
        insights = await storage.getHookInsightsByJobId(job.id);
      }

      res.json({ job, insights });
    } catch (error) {
      console.error("Error fetching analysis job:", error);
      res.status(500).json({ message: "Failed to fetch analysis" });
    }
  });

  // List user's analysis history
  app.get("/api/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const jobs = await storage.getAnalysisJobs(userId);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching analysis jobs:", error);
      res.status(500).json({ message: "Failed to fetch analysis history" });
    }
  });

  // Start the scheduler for autonomous optimization
  scheduler.start(30); // Run every 30 minutes

  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  wsService.initialize(httpServer);

  return httpServer;
}

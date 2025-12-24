import { storage } from "./storage";
import { youtubeService } from "./youtube";
import { geminiService } from "./gemini";
import { statisticsService } from "./statistics";
import { wsService } from "./websocket";
import type { Campaign, VideoAsset } from "@shared/schema";

interface CampaignAnalysis {
  transcript: string;
  keyMoments: { timestamp: number; description: string }[];
  suggestedTitleVariations: string[];
  visualElements: string[];
  targetAudience: string;
  emotionalTone: string;
}

class CampaignService {
  async createCampaign(
    userId: string,
    youtubeVideoUrl: string,
    paymentId?: string
  ): Promise<Campaign> {
    const videoId = youtubeService.extractVideoId(youtubeVideoUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube video URL');
    }

    const credentials = await storage.getYoutubeCredentials(userId);
    let videoTitle = '';
    let originalThumbnailUrl = '';

    if (credentials) {
      try {
        const accessToken = await youtubeService.refreshAccessToken(credentials);
        const videoInfo = await youtubeService.getVideoInfo(videoId, accessToken);
        videoTitle = videoInfo.title;
        originalThumbnailUrl = videoInfo.thumbnailUrl;
      } catch (error) {
        console.error('Error fetching video info:', error);
      }
    }

    const campaign = await storage.createCampaign({
      userId,
      youtubeVideoId: videoId,
      youtubeVideoUrl,
      videoTitle,
      originalThumbnailUrl,
      paymentId,
      priceAmount: 20000, // $200
    });

    this.startCampaignPipeline(campaign.id).catch(err => 
      console.error('Campaign pipeline error:', err)
    );

    return campaign;
  }

  async startCampaignPipeline(campaignId: string): Promise<void> {
    try {
      await storage.updateCampaign(campaignId, { status: 'analyzing' });
      wsService.notifyStatusChange(campaignId, 'analyzing', { message: 'Analyzing video content...' });
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) throw new Error('Campaign not found');

      // Extract reference frames from video
      const frameUrls = await youtubeService.extractReferenceFrames(campaign.youtubeVideoId, campaignId);
      for (const url of frameUrls) {
        await storage.createVideoAsset({
          campaignId,
          assetType: 'frame',
          name: 'Reference Frame',
          url,
          isKeyElement: true,
        });
      }

      const analysis = await this.analyzeVideo(campaign);
      
      await storage.createVideoAsset({
        campaignId,
        assetType: 'transcript',
        name: 'Video Transcript',
        content: analysis.transcript,
        metadata: {
          keyMoments: analysis.keyMoments,
          suggestedTitles: analysis.suggestedTitleVariations,
          targetAudience: analysis.targetAudience,
          emotionalTone: analysis.emotionalTone,
        },
      });

      for (const element of analysis.visualElements) {
        await storage.createVideoAsset({
          campaignId,
          assetType: 'element',
          name: element,
          description: `Key visual element: ${element}`,
          isKeyElement: true,
        });
      }

      await storage.updateCampaign(campaignId, { status: 'generating' });
      wsService.notifyStatusChange(campaignId, 'generating', { message: 'Generating thumbnail variations...' });
      
      await this.generateInitialThumbnails(campaignId, analysis);

      // Create initial rotation for the original thumbnail (baseline control window)
      try {
        const credentials = await storage.getYoutubeCredentials(campaign.userId);
        if (credentials) {
          const accessToken = await youtubeService.refreshAccessToken(credentials);
          const endDate = new Date().toISOString().split('T')[0];
          const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const analytics = await youtubeService.getVideoAnalytics(
            campaign.youtubeVideoId,
            accessToken,
            startDate,
            endDate
          );
          
          // Start initial rotation with original thumbnail (null = original)
          await this.startInitialRotation(campaignId, null, {
            views: analytics.views,
            watchTimeMinutes: analytics.watchTimeMinutes,
          });
        } else {
          // No credentials yet - create placeholder rotation with zero baseline
          // Will be updated when credentials are added and analytics become available
          await this.startInitialRotation(campaignId, null, {
            views: 0,
            watchTimeMinutes: 0,
          });
          console.log(`Created placeholder rotation for campaign ${campaignId} (no credentials)`);
        }
      } catch (error) {
        console.error('Error creating initial rotation:', error);
        // Still create a placeholder rotation so the system has a baseline
        await this.startInitialRotation(campaignId, null, {
          views: 0,
          watchTimeMinutes: 0,
        });
      }

      // Collect initial performance baseline snapshot
      await this.collectPerformanceSnapshot(campaignId, campaign, null);

      await storage.updateCampaign(campaignId, { 
        status: 'testing',
        currentIteration: 1,
        nextScheduledRun: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
      });

      const run = await storage.createOptimizationRun({
        campaignId,
        iteration: 1,
      });

      wsService.notifyStatusChange(campaignId, 'testing', { 
        message: 'Starting A/B testing cycle...',
        iteration: 1,
      });
      wsService.notifyOptimizationRun(campaignId, run);

    } catch (error) {
      console.error('Campaign pipeline error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await storage.updateCampaign(campaignId, { 
        status: 'failed',
        errorMessage,
      });
      wsService.notifyStatusChange(campaignId, 'failed', { error: errorMessage });
    }
  }

  private async collectPerformanceSnapshot(
    campaignId: string, 
    campaign: Campaign,
    activeThumbnailId: string | null
  ): Promise<void> {
    try {
      const credentials = await storage.getYoutubeCredentials(campaign.userId);
      if (!credentials) return;

      const accessToken = await youtubeService.refreshAccessToken(credentials);
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const analytics = await youtubeService.getVideoAnalytics(
        campaign.youtubeVideoId,
        accessToken,
        startDate,
        endDate
      );

      // Use rotation tracking for accurate window-based measurement
      const activeRotation = await storage.getActiveRotation(campaignId);
      
      // Calculate metrics from active rotation if exists
      let viewVelocity = 0;
      let viewsInRotation = 0;
      
      if (activeRotation) {
        const exposureSeconds = Math.max(1, (Date.now() - new Date(activeRotation.startedAt).getTime()) / 1000);
        const exposureHours = exposureSeconds / 3600;
        viewsInRotation = Math.max(0, analytics.views - (activeRotation.baselineViews || 0));
        viewVelocity = viewsInRotation / Math.max(0.1, exposureHours);
      }

      // Store snapshot for timeline visualization (simpler historical record)
      const snapshot = await storage.createPerformanceSnapshot({
        campaignId,
        thumbnailId: activeThumbnailId,
        impressions: analytics.views,
        clicks: viewsInRotation,
        ctr: viewVelocity,
        averageViewDuration: analytics.averageViewDuration,
        isCurrentlyActive: true,
      });

      wsService.notifyPerformanceSnapshot(campaignId, snapshot);
    } catch (error) {
      console.error('Error collecting performance snapshot:', error);
    }
  }

  // Create a new rotation window - only called after closeActiveRotation
  private async createNewRotation(
    campaignId: string, 
    thumbnailId: string | null,
    optimizationRunId: string | null,
    currentAnalytics: { views: number; watchTimeMinutes: number }
  ): Promise<void> {
    // Create new rotation with current metrics as baseline
    await storage.createRotation({
      campaignId,
      optimizationRunId,
      thumbnailId,
      startedAt: new Date(),
      baselineViews: currentAnalytics.views,
      baselineWatchMinutes: currentAnalytics.watchTimeMinutes,
      isActive: true,
    });
  }
  
  // Start initial rotation for a campaign (no previous rotation to close)
  private async startInitialRotation(
    campaignId: string, 
    thumbnailId: string | null,
    currentAnalytics: { views: number; watchTimeMinutes: number }
  ): Promise<void> {
    // Check if there's already an active rotation
    const activeRotation = await storage.getActiveRotation(campaignId);
    if (activeRotation) {
      console.log(`Campaign ${campaignId} already has active rotation, skipping initial creation`);
      return;
    }

    // Create initial rotation with current metrics as baseline
    await storage.createRotation({
      campaignId,
      optimizationRunId: null,
      thumbnailId,
      startedAt: new Date(),
      baselineViews: currentAnalytics.views,
      baselineWatchMinutes: currentAnalytics.watchTimeMinutes,
      isActive: true,
    });
    console.log(`Created initial rotation for campaign ${campaignId}`);
  }

  // Close the active rotation with final metrics
  private async closeActiveRotation(
    campaignId: string,
    currentAnalytics: { views: number; watchTimeMinutes: number }
  ): Promise<void> {
    const activeRotation = await storage.getActiveRotation(campaignId);
    if (!activeRotation) {
      console.log(`No active rotation to close for campaign ${campaignId}`);
      return;
    }

    const endedAt = new Date();
    const exposureSeconds = Math.max(1, (endedAt.getTime() - new Date(activeRotation.startedAt).getTime()) / 1000);
    const exposureHours = exposureSeconds / 3600;
    const exposureMinutes = exposureSeconds / 60;

    // Calculate deltas - guard against negative values from analytics lag
    const viewsDelta = Math.max(0, currentAnalytics.views - (activeRotation.baselineViews || 0));
    const watchMinutesDelta = Math.max(0, currentAnalytics.watchTimeMinutes - (activeRotation.baselineWatchMinutes || 0));
    
    // Only calculate velocity if we have meaningful exposure (at least 10 minutes)
    const viewVelocity = exposureHours >= 0.17 ? viewsDelta / exposureHours : 0;
    const watchVelocity = exposureMinutes >= 10 ? watchMinutesDelta / exposureMinutes : 0;

    console.log(`Closing rotation ${activeRotation.id}: ${viewsDelta} views in ${exposureHours.toFixed(2)}h = ${viewVelocity.toFixed(2)} views/hr`);

    await storage.closeRotation(activeRotation.id, {
      endedAt,
      finalViews: currentAnalytics.views,
      finalWatchMinutes: currentAnalytics.watchTimeMinutes,
      viewsDelta,
      watchMinutesDelta,
      exposureSeconds: Math.round(exposureSeconds),
      viewVelocity,
      watchVelocity,
    });
  }

  private async analyzeVideo(campaign: Campaign): Promise<CampaignAnalysis> {
    const transcriptSegments = await youtubeService.getVideoTranscript(campaign.youtubeVideoId);
    const fullTranscript = transcriptSegments.map(s => s.text).join(' ');

    const analysis = await geminiService.analyzeVideoContent(
      fullTranscript || campaign.videoTitle || 'YouTube video',
      campaign.videoTitle || '',
      campaign.originalThumbnailUrl
    );

    return {
      transcript: fullTranscript,
      keyMoments: analysis.keyMoments || [],
      suggestedTitleVariations: analysis.titleVariations || [],
      visualElements: analysis.visualElements || [],
      targetAudience: analysis.targetAudience || 'general',
      emotionalTone: analysis.emotionalTone || 'engaging',
    };
  }

  private async generateInitialThumbnails(campaignId: string, analysis: CampaignAnalysis): Promise<void> {
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const referenceAssets = await storage.getVideoAssets(campaignId, 'element');
    const referenceElements = referenceAssets
      .filter(a => a.isKeyElement)
      .map(a => a.name || a.description || '')
      .filter(Boolean);

    const promptBase = `Create a YouTube thumbnail for: "${campaign.videoTitle || 'YouTube video'}". 
Key elements to include: ${referenceElements.join(', ') || 'engaging visuals'}.
Target audience: ${analysis.targetAudience}.
Emotional tone: ${analysis.emotionalTone}.`;

    const thumbnailIds = await geminiService.generateCampaignThumbnails(
      campaignId,
      campaign.userId,
      promptBase,
      6, // Generate 6 initial variations
      referenceElements
    );

    await storage.logActivity(
      campaign.userId, 
      'generate_campaign_thumbnails', 
      'campaign', 
      campaignId,
      { thumbnailCount: thumbnailIds.length }
    );
  }

  async runOptimizationIteration(campaignId: string): Promise<void> {
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status !== 'testing' && campaign.status !== 'optimizing') {
      console.log(`Campaign ${campaignId} is not in testing/optimizing state`);
      return;
    }

    const iteration = (campaign.currentIteration || 0) + 1;
    
    const run = await storage.createOptimizationRun({
      campaignId,
      iteration,
    });

    wsService.notifyOptimizationRun(campaignId, { ...run, status: 'processing' });

    try {
      await storage.updateOptimizationRun(run.id, { status: 'processing' });
      
      // Collect fresh performance data
      await this.collectPerformanceSnapshot(campaignId, campaign, null);
      
      const snapshots = await storage.getPerformanceSnapshots(campaignId);
      const bestSnapshot = snapshots
        .filter(s => s.ctr !== null && s.ctr !== undefined)
        .sort((a, b) => (b.ctr || 0) - (a.ctr || 0))[0];

      const previousBestCtr = bestSnapshot?.ctr || 0;
      
      const currentSnapshots = snapshots.filter(s => s.isCurrentlyActive);
      const currentBestCtr = Math.max(...currentSnapshots.map(s => s.ctr || 0), 0);

      const ctrDelta = currentBestCtr - previousBestCtr;
      
      // Evaluate settle criteria with statistics
      const settleResult = await this.evaluateSettleCriteria(campaign, campaignId, iteration);

      if (settleResult.shouldSettle) {
        await this.settleCampaign(campaignId, settleResult.winnerId, currentBestCtr, settleResult.confidence);
        await storage.updateOptimizationRun(run.id, {
          status: 'completed',
          previousBestCtr,
          currentBestCtr,
          ctrDelta,
          actionTaken: 'settled',
          notes: `Settled with ${(settleResult.confidence * 100).toFixed(1)}% confidence`,
          completedAt: new Date(),
        });
        
        wsService.notifyStatusChange(campaignId, 'settled', { 
          winnerId: settleResult.winnerId,
          confidence: settleResult.confidence,
          finalCtr: currentBestCtr,
        });
        return;
      }

      // Select best performing thumbnail and apply to video
      const thumbnails = await storage.getCampaignThumbnails(campaignId);
      if (thumbnails.length > 0) {
        const bestThumb = thumbnails[0]; // Already sorted by performance
        await this.applyThumbnailToVideo(campaignId, campaign, bestThumb);
      }

      const videoAssets = await storage.getVideoAssets(campaignId);
      const referenceElements = videoAssets
        .filter(a => a.assetType === 'element' && a.isKeyElement)
        .map(a => a.name || '')
        .filter(Boolean);

      const frameAssets = videoAssets.filter(a => a.assetType === 'frame');
      const referenceFrameUrls = frameAssets.map(a => a.url).filter(Boolean);

      const promptBase = `Create an optimized YouTube thumbnail for: "${campaign.videoTitle}".
Include these key elements: ${referenceElements.join(', ')}.
Reference style from existing video frames.
Iteration ${iteration}: Focus on higher CTR with more compelling visuals, brighter colors, and clearer focal points.`;

      const newThumbnails = await geminiService.generateCampaignThumbnails(
        campaignId,
        campaign.userId,
        promptBase,
        3,
        referenceElements
      );

      const nextRunTime = new Date(Date.now() + (24 / (campaign.iterationsPerDay || 5)) * 60 * 60 * 1000);
      
      await storage.updateCampaign(campaignId, {
        status: 'optimizing',
        currentIteration: iteration,
        nextScheduledRun: nextRunTime,
      });

      await storage.updateOptimizationRun(run.id, {
        status: 'completed',
        thumbnailsGenerated: newThumbnails.length,
        previousBestCtr,
        currentBestCtr,
        ctrDelta,
        actionTaken: 'generated_variations',
        notes: `Confidence: ${(settleResult.confidence * 100).toFixed(1)}%`,
        completedAt: new Date(),
      });

      wsService.notifyCampaignUpdate(campaignId, {
        iteration,
        currentBestCtr,
        confidence: settleResult.confidence,
        nextScheduledRun: nextRunTime,
        thumbnailsGenerated: newThumbnails.length,
      });

    } catch (error) {
      console.error('Optimization iteration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await storage.updateOptimizationRun(run.id, {
        status: 'failed',
        notes: errorMessage,
        completedAt: new Date(),
      });
      wsService.notifyOptimizationRun(campaignId, { id: run.id, status: 'failed', error: errorMessage });
    }
  }

  private async applyThumbnailToVideo(
    campaignId: string,
    campaign: Campaign,
    thumbnail: any
  ): Promise<boolean> {
    try {
      const credentials = await storage.getYoutubeCredentials(campaign.userId);
      if (!credentials) {
        console.log('No YouTube credentials, skipping thumbnail application');
        return false;
      }

      const accessToken = await youtubeService.refreshAccessToken(credentials);
      let imageBuffer: Buffer | null = null;
      
      // Handle different image URL formats
      if (thumbnail.imageUrl.startsWith('/uploads/')) {
        // Local file
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.join(process.cwd(), thumbnail.imageUrl);
        
        if (fs.existsSync(filePath)) {
          imageBuffer = fs.readFileSync(filePath);
        }
      } else if (thumbnail.imageUrl.startsWith('http://') || thumbnail.imageUrl.startsWith('https://')) {
        // Remote URL - fetch the image
        try {
          const response = await fetch(thumbnail.imageUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
          }
        } catch (fetchError) {
          console.error('Error fetching remote thumbnail:', fetchError);
        }
      } else if (thumbnail.imageUrl.startsWith('data:image')) {
        // Base64 data URL
        const base64Data = thumbnail.imageUrl.split(',')[1];
        if (base64Data) {
          imageBuffer = Buffer.from(base64Data, 'base64');
        }
      }

      if (imageBuffer && imageBuffer.length > 0) {
        // Get current analytics BEFORE the swap
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const preSwapAnalytics = await youtubeService.getVideoAnalytics(
          campaign.youtubeVideoId,
          accessToken,
          startDate,
          endDate
        );
        
        // Try to apply the new thumbnail FIRST - only close/create rotation if successful
        try {
          await youtubeService.updateVideoThumbnail(campaign.youtubeVideoId, imageBuffer, accessToken);
          console.log(`Applied thumbnail ${thumbnail.id} to video ${campaign.youtubeVideoId}`);
        } catch (uploadError) {
          // Thumbnail upload failed - keep current rotation active, don't create new one
          console.error('Thumbnail upload failed, keeping current rotation:', uploadError);
          return false;
        }
        
        // Thumbnail successfully applied - now close old rotation and create new one
        await this.closeActiveRotation(campaignId, {
          views: preSwapAnalytics.views,
          watchTimeMinutes: preSwapAnalytics.watchTimeMinutes,
        });
        
        // Create new rotation for the newly applied thumbnail
        await this.createNewRotation(campaignId, thumbnail.id, null, {
          views: preSwapAnalytics.views,
          watchTimeMinutes: preSwapAnalytics.watchTimeMinutes,
        });
        
        wsService.notifyCampaignUpdate(campaignId, {
          event: 'thumbnail_applied',
          thumbnailId: thumbnail.id,
          videoId: campaign.youtubeVideoId,
        });
        
        return true;
      } else {
        console.log(`Could not load thumbnail image for ${thumbnail.id}`);
        return false;
      }
    } catch (error) {
      console.error('Error applying thumbnail to video:', error);
      // Don't throw - this is not critical for the optimization loop
      return false;
    }
  }

  private async evaluateSettleCriteria(
    campaign: Campaign, 
    campaignId: string,
    iteration: number
  ): Promise<{ shouldSettle: boolean; winnerId: string | null; confidence: number }> {
    // Get all completed rotations for this campaign
    // Filter: must be closed, have valid velocity, and meet minimum exposure (2+ hours)
    const rotations = await storage.getRotations(campaignId);
    const MIN_EXPOSURE_SECONDS = 2 * 60 * 60; // 2 hours minimum
    const completedRotations = rotations.filter(r => 
      !r.isActive && 
      r.viewVelocity !== null && 
      r.viewVelocity >= 0 &&
      (r.exposureSeconds || 0) >= MIN_EXPOSURE_SECONDS
    );
    
    // Max iterations reached
    if (iteration >= (campaign.maxIterations || 20)) {
      // Find best performer from completed rotations
      const best = completedRotations.sort((a, b) => (b.viewVelocity || 0) - (a.viewVelocity || 0))[0];
      return { shouldSettle: true, winnerId: best?.thumbnailId || null, confidence: 0 };
    }

    // Need at least 2 completed rotations to compare
    if (completedRotations.length < 2) {
      return { shouldSettle: false, winnerId: null, confidence: 0 };
    }

    // Aggregate performance by thumbnail
    // Calculate average view velocity across all rotations for each thumbnail
    const thumbnails = await storage.getCampaignThumbnails(campaignId);
    const thumbnailPerformance = thumbnails.map(thumb => {
      const thumbRotations = completedRotations.filter(r => r.thumbnailId === thumb.id);
      
      if (thumbRotations.length === 0) {
        return { id: thumb.id, avgVelocity: 0, totalViews: 0, rotationCount: 0, totalExposure: 0 };
      }
      
      const totalViews = thumbRotations.reduce((sum, r) => sum + (r.viewsDelta || 0), 0);
      const totalExposure = thumbRotations.reduce((sum, r) => sum + (r.exposureSeconds || 0), 0);
      const avgVelocity = totalExposure > 0 ? (totalViews / (totalExposure / 3600)) : 0;
      
      return {
        id: thumb.id,
        avgVelocity,
        totalViews,
        rotationCount: thumbRotations.length,
        totalExposure,
      };
    }).filter(t => t.rotationCount > 0);

    if (thumbnailPerformance.length < 2) {
      return { shouldSettle: false, winnerId: null, confidence: 0 };
    }

    // Sort by average velocity to find best and second best
    const sorted = [...thumbnailPerformance].sort((a, b) => b.avgVelocity - a.avgVelocity);
    const best = sorted[0];
    const secondBest = sorted[1];

    // Statistical confidence calculation using Welch's t-test approximation
    // Based on: difference magnitude, sample size (rotations), and total exposure
    const velocityDiff = best.avgVelocity - secondBest.avgVelocity;
    const relativeImprovement = secondBest.avgVelocity > 0 ? velocityDiff / secondBest.avgVelocity : 1;
    const minRotations = Math.min(best.rotationCount, secondBest.rotationCount);
    const minExposureHours = Math.min(best.totalExposure, secondBest.totalExposure) / 3600;
    
    // Confidence calculation:
    // - Need minimum 2 rotations per thumbnail for reliability
    // - Need minimum 2 hours total exposure per thumbnail
    // - Higher confidence with larger relative improvement
    let confidence = 0;
    
    if (minRotations >= 2 && minExposureHours >= 2) {
      // Base confidence from relative improvement
      if (relativeImprovement >= 0.3) {
        confidence = 0.85 + Math.min(0.14, relativeImprovement * 0.2);
      } else if (relativeImprovement >= 0.15) {
        confidence = 0.70 + Math.min(0.14, relativeImprovement * 0.5);
      } else if (relativeImprovement >= 0.05) {
        confidence = 0.50 + relativeImprovement * 2;
      } else {
        confidence = 0.30 + relativeImprovement * 4;
      }
      
      // Boost confidence with more data
      const exposureBonus = Math.min(0.05, (minExposureHours - 2) * 0.01);
      const rotationBonus = Math.min(0.05, (minRotations - 2) * 0.02);
      confidence = Math.min(0.99, confidence + exposureBonus + rotationBonus);
    } else {
      // Insufficient data
      confidence = 0.3 * Math.min(1, minRotations / 2) * Math.min(1, minExposureHours / 2);
    }

    // Settle if confidence is above 95% threshold
    const isSignificant = confidence >= 0.95;
    
    if (isSignificant) {
      return { 
        shouldSettle: true, 
        winnerId: best.id, 
        confidence 
      };
    }

    // Early settling if minimal improvement after many iterations
    if (iteration >= 5 && minRotations >= 3) {
      // If no significant improvement trend, settle with best available
      if (relativeImprovement < 0.05 && confidence > 0.7) {
        return { shouldSettle: true, winnerId: best.id, confidence };
      }
    }

    return { shouldSettle: false, winnerId: null, confidence };
  }

  private async settleCampaign(
    campaignId: string, 
    winningThumbnailId: string | null,
    finalCtr: number,
    confidence: number = 0
  ): Promise<void> {
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) return;

    // Get baseline CTR from first snapshot
    const snapshots = await storage.getPerformanceSnapshots(campaignId);
    const baselineSnapshot = snapshots.sort((a, b) => 
      new Date(a.recordedAt || 0).getTime() - new Date(b.recordedAt || 0).getTime()
    )[0];
    const originalCtr = baselineSnapshot?.ctr || 0;
    const improvement = statisticsService.calculateImprovement(originalCtr, finalCtr);

    // Apply winning thumbnail to video permanently
    if (winningThumbnailId) {
      const thumbnail = await storage.getThumbnail(winningThumbnailId);
      if (thumbnail) {
        await this.applyThumbnailToVideo(campaignId, campaign, thumbnail);
      }
    }

    await storage.updateCampaign(campaignId, {
      status: 'settled',
      settledAt: new Date(),
      winningThumbnailId,
      finalCtr,
      ctrImprovement: improvement,
    });

    await storage.logActivity(
      campaign.userId,
      'campaign_settled',
      'campaign',
      campaignId,
      { finalCtr, improvement, winningThumbnailId, confidence }
    );

    wsService.notifyStatusChange(campaignId, 'settled', {
      winningThumbnailId,
      finalCtr,
      improvement,
      confidence,
    });
  }

  async getCampaignStatus(campaignId: string): Promise<{
    campaign: Campaign;
    assets: VideoAsset[];
    runs: any[];
    snapshots: any[];
    thumbnails: any[];
  }> {
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const [assets, runs, snapshots, thumbnails] = await Promise.all([
      storage.getVideoAssets(campaignId),
      storage.getOptimizationRuns(campaignId),
      storage.getPerformanceSnapshots(campaignId),
      storage.getCampaignThumbnails(campaignId),
    ]);

    return { campaign, assets, runs, snapshots, thumbnails };
  }
}

export const campaignService = new CampaignService();

import { storage } from "./storage";
import { campaignService } from "./campaign";

class OptimizationScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(intervalMinutes: number = 30): void {
    if (this.intervalId) {
      console.log('Scheduler already running');
      return;
    }

    console.log(`Starting optimization scheduler (every ${intervalMinutes} minutes)`);
    
    this.runPendingOptimizations();

    this.intervalId = setInterval(() => {
      this.runPendingOptimizations();
    }, intervalMinutes * 60 * 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Optimization scheduler stopped');
    }
  }

  async runPendingOptimizations(): Promise<void> {
    if (this.isRunning) {
      console.log('Optimization already in progress, skipping');
      return;
    }

    this.isRunning = true;
    try {
      const campaigns = await storage.getActiveCampaigns();
      console.log(`Found ${campaigns.length} campaigns due for optimization`);

      for (const campaign of campaigns) {
        try {
          console.log(`Running optimization for campaign ${campaign.id}`);
          await campaignService.runOptimizationIteration(campaign.id);
        } catch (error) {
          console.error(`Failed to optimize campaign ${campaign.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async manualTrigger(campaignId: string): Promise<void> {
    console.log(`Manual optimization trigger for campaign ${campaignId}`);
    await campaignService.runOptimizationIteration(campaignId);
  }
}

export const scheduler = new OptimizationScheduler();

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

interface CampaignUpdate {
  type: 'campaign_update' | 'optimization_run' | 'performance_snapshot' | 'status_change';
  campaignId: string;
  data: any;
  timestamp: Date;
}

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  subscribedCampaigns: Set<string>;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientConnection> = new Map();

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => {
      console.log('WebSocket client connected');
      
      // Initialize client connection
      const client: ClientConnection = {
        ws,
        userId: '',
        subscribedCampaigns: new Set(),
      };
      this.clients.set(ws, client);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send connection confirmation
      ws.send(JSON.stringify({ type: 'connected', timestamp: new Date() }));
    });

    console.log('WebSocket server initialized on /ws');
  }

  private handleMessage(ws: WebSocket, data: any): void {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (data.type) {
      case 'authenticate':
        client.userId = data.userId;
        ws.send(JSON.stringify({ type: 'authenticated', userId: data.userId }));
        break;

      case 'subscribe':
      case 'subscribe_campaign':
        if (data.campaignId) {
          client.subscribedCampaigns.add(data.campaignId);
          ws.send(JSON.stringify({ 
            type: 'subscribed', 
            campaignId: data.campaignId 
          }));
          // Send initial state - client should fetch via REST for full data
          this.sendInitialState(ws, data.campaignId);
        }
        break;

      case 'unsubscribe_campaign':
        if (data.campaignId) {
          client.subscribedCampaigns.delete(data.campaignId);
          ws.send(JSON.stringify({ 
            type: 'unsubscribed', 
            campaignId: data.campaignId 
          }));
        }
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
        break;
    }
  }

  private async sendInitialState(ws: WebSocket, campaignId: string): Promise<void> {
    try {
      // Import storage dynamically to avoid circular dependencies
      const { storage } = await import('./storage');
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return;

      const [snapshots, runs] = await Promise.all([
        storage.getPerformanceSnapshots(campaignId),
        storage.getOptimizationRuns(campaignId),
      ]);

      // Sort by most recent first (descending by recordedAt/startedAt)
      const sortedSnapshots = snapshots.sort((a, b) => 
        new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime()
      );
      const sortedRuns = runs.sort((a, b) => 
        new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
      );

      const latestSnapshot = sortedSnapshots[0];
      const latestRun = sortedRuns[0];

      // Send current campaign state
      ws.send(JSON.stringify({
        type: 'campaign_sync',
        campaignId,
        timestamp: new Date(),
        data: {
          status: campaign.status,
          currentIteration: campaign.currentIteration,
          nextScheduledRun: campaign.nextScheduledRun,
          latestSnapshot: latestSnapshot ? {
            ctr: latestSnapshot.ctr,
            impressions: latestSnapshot.impressions,
            clicks: latestSnapshot.clicks,
            recordedAt: latestSnapshot.recordedAt,
          } : null,
          latestRun: latestRun ? {
            id: latestRun.id,
            iteration: latestRun.iteration,
            status: latestRun.status,
            ctrDelta: latestRun.ctrDelta,
          } : null,
        },
      }));
    } catch (error) {
      console.error('Error sending initial state:', error);
    }
  }

  // Broadcast update to all clients subscribed to a campaign
  broadcastCampaignUpdate(update: CampaignUpdate): void {
    if (!this.wss) return;

    const message = JSON.stringify({
      ...update,
      timestamp: update.timestamp || new Date(),
    });

    this.clients.forEach((client, ws) => {
      if (client.subscribedCampaigns.has(update.campaignId)) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        } catch (error) {
          console.error('Error sending to client:', error);
        }
      }
    });
  }

  // Broadcast to a specific user
  broadcastToUser(userId: string, data: any): void {
    if (!this.wss) return;

    const message = JSON.stringify({
      ...data,
      timestamp: new Date(),
    });

    this.clients.forEach((client, ws) => {
      if (client.userId === userId) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        } catch (error) {
          console.error('Error sending to user:', error);
        }
      }
    });
  }

  // Notify campaign status change
  notifyStatusChange(campaignId: string, status: string, details?: any): void {
    this.broadcastCampaignUpdate({
      type: 'status_change',
      campaignId,
      data: { status, ...details },
      timestamp: new Date(),
    });
  }

  // Notify new optimization run
  notifyOptimizationRun(campaignId: string, run: any): void {
    this.broadcastCampaignUpdate({
      type: 'optimization_run',
      campaignId,
      data: run,
      timestamp: new Date(),
    });
  }

  // Notify performance snapshot
  notifyPerformanceSnapshot(campaignId: string, snapshot: any): void {
    this.broadcastCampaignUpdate({
      type: 'performance_snapshot',
      campaignId,
      data: snapshot,
      timestamp: new Date(),
    });
  }

  // General campaign update
  notifyCampaignUpdate(campaignId: string, updates: any): void {
    this.broadcastCampaignUpdate({
      type: 'campaign_update',
      campaignId,
      data: updates,
      timestamp: new Date(),
    });
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  getCampaignSubscribersCount(campaignId: string): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.subscribedCampaigns.has(campaignId)) {
        count++;
      }
    });
    return count;
  }
}

export const wsService = new WebSocketService();

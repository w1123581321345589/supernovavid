import { storage } from "./storage";
import { withRetry, youtubeRateLimiter, youtubeCircuitBreaker } from "./retry";
import type { Campaign, YoutubeCredentials } from "@shared/schema";

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REPLIT_DOMAINS 
  ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/api/youtube/callback`
  : 'http://localhost:5000/api/youtube/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

interface VideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  channelId: string;
  viewCount?: number;
  likeCount?: number;
  duration?: string;
}

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

interface AnalyticsData {
  impressions: number;
  clicks: number;
  ctr: number;
  views: number;
  averageViewDuration: number;
  watchTimeMinutes: number;
}

interface FrameInfo {
  timestamp: number;
  url: string;
  quality: string;
}

class YouTubeService {
  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: YOUTUBE_CLIENT_ID || '',
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: userId,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(code: string, userId: string): Promise<YoutubeCredentials> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: YOUTUBE_CLIENT_ID || '',
        client_secret: YOUTUBE_CLIENT_SECRET || '',
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();
    if (tokens.error) {
      throw new Error(`Token exchange failed: ${tokens.error_description || tokens.error}`);
    }

    const channelInfo = await this.getChannelInfo(tokens.access_token);
    
    const credentials = await storage.upsertYoutubeCredentials({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      channelId: channelInfo.id,
      channelTitle: channelInfo.title,
      scopes: SCOPES,
    });

    return credentials;
  }

  async refreshAccessToken(credentials: YoutubeCredentials): Promise<string> {
    if (new Date() < new Date(credentials.tokenExpiry)) {
      return credentials.accessToken;
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: credentials.refreshToken,
        client_id: YOUTUBE_CLIENT_ID || '',
        client_secret: YOUTUBE_CLIENT_SECRET || '',
        grant_type: 'refresh_token',
      }),
    });

    const tokens = await tokenResponse.json();
    if (tokens.error) {
      throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error}`);
    }

    await storage.updateYoutubeCredentials(credentials.id, {
      accessToken: tokens.access_token,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    });

    return tokens.access_token;
  }

  private async getChannelInfo(accessToken: string): Promise<{ id: string; title: string }> {
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await response.json();
    if (!data.items?.[0]) {
      throw new Error('No YouTube channel found');
    }
    return {
      id: data.items[0].id,
      title: data.items[0].snippet.title,
    };
  }

  async getVideoInfo(videoId: string, accessToken: string): Promise<VideoInfo> {
    return withRetry(async () => {
      return youtubeCircuitBreaker.execute(async () => {
        return youtubeRateLimiter.execute(async () => {
          const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          
          if (!response.ok) {
            throw new Error(`YouTube API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (!data.items?.[0]) {
            throw new Error('Video not found');
          }

          const video = data.items[0];
          return {
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnailUrl: video.snippet.thumbnails?.maxres?.url || 
                          video.snippet.thumbnails?.high?.url ||
                          video.snippet.thumbnails?.default?.url,
            publishedAt: video.snippet.publishedAt,
            channelId: video.snippet.channelId,
            viewCount: parseInt(video.statistics?.viewCount || '0'),
            likeCount: parseInt(video.statistics?.likeCount || '0'),
          };
        });
      });
    }, { maxRetries: 3, initialDelay: 1000 });
  }

  async getVideoTranscript(videoId: string): Promise<TranscriptSegment[]> {
    try {
      const response = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`
      );
      const html = await response.text();
      
      const captionsMatch = html.match(/"captions":\s*({.*?"playerCaptionsTracklistRenderer".*?})/);
      if (!captionsMatch) {
        console.log('No captions found for video, using video metadata instead');
        return [];
      }

      const captionsData = JSON.parse(captionsMatch[1]);
      const tracks = captionsData?.playerCaptionsTracklistRenderer?.captionTracks;
      
      if (!tracks?.length) {
        return [];
      }

      const englishTrack = tracks.find((t: any) => t.languageCode === 'en') || tracks[0];
      const transcriptResponse = await fetch(englishTrack.baseUrl);
      const transcriptXml = await transcriptResponse.text();

      const segments: TranscriptSegment[] = [];
      const textMatches = Array.from(transcriptXml.matchAll(/<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]*)<\/text>/g));
      
      for (const match of textMatches) {
        segments.push({
          start: parseFloat(match[1]),
          duration: parseFloat(match[2]),
          text: this.decodeHtmlEntities(match[3]),
        });
      }

      return segments;
    } catch (error) {
      console.error('Error fetching transcript:', error);
      return [];
    }
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ');
  }

  async updateVideoThumbnail(videoId: string, imageBuffer: Buffer, accessToken: string): Promise<void> {
    return withRetry(async () => {
      return youtubeCircuitBreaker.execute(async () => {
        return youtubeRateLimiter.execute(async () => {
          const response = await fetch(
            `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'image/png',
              },
              body: imageBuffer,
            }
          );

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Failed to update thumbnail: ${error.error?.message || response.status}`);
          }
        });
      });
    }, { maxRetries: 3, initialDelay: 2000 });
  }

  async getVideoAnalytics(videoId: string, accessToken: string, startDate: string, endDate: string): Promise<AnalyticsData> {
    try {
      return await withRetry(async () => {
        return youtubeRateLimiter.execute(async () => {
          // YouTube Analytics API - request real traffic source metrics
          // cardImpressions and cardClicks track end screen/card performance
          // For thumbnail performance, we need to use views and external traffic
          const params = new URLSearchParams({
            ids: 'channel==MINE',
            startDate,
            endDate,
            metrics: 'views,estimatedMinutesWatched,averageViewDuration,shares',
            dimensions: 'video',
            filters: `video==${videoId}`,
          });

          const response = await fetch(
            `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          const data = await response.json();
          
          if (data.error) {
            console.error('Analytics API error:', data.error);
            return this.getBasicVideoStats(videoId, accessToken);
          }

          const row = data.rows?.[0] || [];
          const views = row[0] || 0;
          const watchTimeMinutes = row[1] || 0;
          const averageViewDuration = row[2] || 0;
          
          // YouTube Analytics API doesn't provide direct thumbnail impressions/clicks
          // We return available metrics and set impression-related fields to 0
          // The A/B testing system will track relative performance between thumbnails
          // by monitoring view count changes during each thumbnail rotation period
          return {
            views,
            watchTimeMinutes,
            averageViewDuration,
            impressions: 0, // Not available via API - will be tracked via view deltas
            clicks: 0,      // Not available via API - will be tracked via view deltas
            ctr: 0,         // Will be calculated from relative view performance
          };
        });
      }, { maxRetries: 2, initialDelay: 1000 });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return this.getBasicVideoStats(videoId, accessToken);
    }
  }

  private async getBasicVideoStats(videoId: string, accessToken: string): Promise<AnalyticsData> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await response.json();
      const stats = data.items?.[0]?.statistics || {};
      
      return {
        views: parseInt(stats.viewCount || '0'),
        impressions: 0,
        clicks: 0,
        ctr: 0,
        averageViewDuration: 0,
        watchTimeMinutes: 0,
      };
    } catch {
      return { views: 0, impressions: 0, clicks: 0, ctr: 0, averageViewDuration: 0, watchTimeMinutes: 0 };
    }
  }

  // Get video frame URLs at different timestamps (using YouTube's storyboard/thumbnail system)
  async getVideoFrames(videoId: string): Promise<FrameInfo[]> {
    const frames: FrameInfo[] = [];
    
    // YouTube provides thumbnails at specific timestamps via special URLs
    const qualities = [
      { name: 'maxres', suffix: 'maxresdefault' },
      { name: 'hq', suffix: 'hqdefault' },
      { name: 'mq', suffix: 'mqdefault' },
    ];
    
    // Standard thumbnail positions YouTube auto-generates
    const positions = [
      { timestamp: 0, suffix: 'default' },
      { timestamp: 0, suffix: '0' },
      { timestamp: 25, suffix: '1' },
      { timestamp: 50, suffix: '2' },
      { timestamp: 75, suffix: '3' },
    ];

    for (const pos of positions) {
      for (const quality of qualities) {
        const url = `https://img.youtube.com/vi/${videoId}/${pos.suffix === 'default' ? quality.suffix : pos.suffix}.jpg`;
        frames.push({
          timestamp: pos.timestamp,
          url,
          quality: quality.name,
        });
      }
    }

    // Also add max resolution variants
    frames.push({
      timestamp: 0,
      url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      quality: 'maxres',
    });

    return frames;
  }

  // Fetch and store reference frames for a campaign
  async extractReferenceFrames(videoId: string, campaignId: string): Promise<string[]> {
    const frames = await this.getVideoFrames(videoId);
    const validFrameUrls: string[] = [];

    // Test which frames are available (some qualities might not exist)
    for (const frame of frames.slice(0, 5)) { // Limit to 5 reference frames
      try {
        const response = await fetch(frame.url, { method: 'HEAD' });
        if (response.ok) {
          validFrameUrls.push(frame.url);
        }
      } catch {
        // Frame not available
      }
    }

    return validFrameUrls;
  }

  async getChannelVideos(accessToken: string, channelId: string, maxResults: number = 50): Promise<VideoInfo[]> {
    return withRetry(async () => {
      return youtubeCircuitBreaker.execute(async () => {
        return youtubeRateLimiter.execute(async () => {
          // First get the uploads playlist ID
          const channelResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          
          if (!channelResponse.ok) {
            throw new Error(`YouTube API error: ${channelResponse.status}`);
          }
          
          const channelData = await channelResponse.json();
          const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
          
          if (!uploadsPlaylistId) {
            throw new Error('Could not find uploads playlist');
          }
          
          // Get videos from uploads playlist
          const videosResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          
          if (!videosResponse.ok) {
            throw new Error(`YouTube API error: ${videosResponse.status}`);
          }
          
          const videosData = await videosResponse.json();
          const videoIds = videosData.items?.map((item: any) => item.contentDetails.videoId).join(',');
          
          if (!videoIds) {
            return [];
          }
          
          // Get video statistics
          const statsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          
          if (!statsResponse.ok) {
            throw new Error(`YouTube API error: ${statsResponse.status}`);
          }
          
          const statsData = await statsResponse.json();
          
          return statsData.items?.map((video: any) => ({
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnailUrl: video.snippet.thumbnails?.maxres?.url || 
                          video.snippet.thumbnails?.high?.url ||
                          video.snippet.thumbnails?.medium?.url ||
                          video.snippet.thumbnails?.default?.url,
            publishedAt: video.snippet.publishedAt,
            channelId: video.snippet.channelId,
            viewCount: parseInt(video.statistics?.viewCount || '0'),
            likeCount: parseInt(video.statistics?.likeCount || '0'),
            duration: video.contentDetails?.duration,
          })) || [];
        });
      });
    }, { maxRetries: 3, initialDelay: 1000 });
  }

  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }

    return null;
  }
}

export const youtubeService = new YouTubeService();

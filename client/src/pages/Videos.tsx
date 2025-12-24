import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw, Search, Sparkles, Eye, Calendar, Youtube, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount?: number;
  duration?: string;
}

interface YouTubeStatus {
  connected: boolean;
  channelTitle?: string;
  channelId?: string;
}

function formatDuration(isoDuration: string | undefined): string {
  if (!isoDuration) return "";
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  
  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatViews(views: number | undefined): string {
  if (!views) return "0 views";
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M views`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K views`;
  }
  return `${views} views`;
}

function VideoCard({ video, onGenerateThumbnails }: { video: YouTubeVideo; onGenerateThumbnails: (video: YouTubeVideo) => void }) {
  return (
    <Card className="overflow-hidden hover-elevate transition-all" data-testid={`card-video-${video.id}`}>
      <div className="relative aspect-video bg-muted">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
            data-testid={`img-video-thumbnail-${video.id}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Youtube className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-medium text-sm line-clamp-2 leading-snug" data-testid={`text-video-title-${video.id}`}>
          {video.title}
        </h3>
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            <span data-testid={`text-video-views-${video.id}`}>{formatViews(video.viewCount)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={() => onGenerateThumbnails(video)}
            data-testid={`button-generate-${video.id}`}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Generate Thumbnails
          </Button>
          <Button
            size="icon"
            variant="outline"
            asChild
            data-testid={`button-youtube-link-${video.id}`}
          >
            <a href={`https://youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VideoSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video" />
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-8" />
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectYouTubePrompt() {
  const { data: authData } = useQuery<{ authUrl: string }>({
    queryKey: ["/api/youtube/auth-url"],
  });

  return (
    <Card className="max-w-md mx-auto mt-12">
      <CardContent className="p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
          <Youtube className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold">Connect Your YouTube Channel</h2>
        <p className="text-muted-foreground">
          Connect your YouTube channel to sync your videos and generate optimized thumbnails.
        </p>
        <Button 
          size="lg" 
          className="mt-4"
          onClick={() => authData?.authUrl && (window.location.href = authData.authUrl)}
          disabled={!authData?.authUrl}
          data-testid="button-connect-youtube"
        >
          <Youtube className="w-4 h-4 mr-2" />
          Connect YouTube
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Videos() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: youtubeStatus, isLoading: statusLoading } = useQuery<YouTubeStatus>({
    queryKey: ["/api/youtube/status"],
  });

  const { data: videos, isLoading: videosLoading, refetch, isFetching } = useQuery<YouTubeVideo[]>({
    queryKey: ["/api/youtube/videos"],
    enabled: youtubeStatus?.connected === true,
  });

  const handleSync = async () => {
    await refetch();
    toast({
      title: "Videos synced",
      description: `Found ${videos?.length || 0} videos from your channel.`,
    });
  };

  const handleGenerateThumbnails = (video: YouTubeVideo) => {
    setLocation(`/campaigns/create?video=${video.id}&title=${encodeURIComponent(video.title)}`);
  };

  const filteredVideos = videos?.filter(video => 
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (statusLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <VideoSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!youtubeStatus?.connected) {
    return <ConnectYouTubePrompt />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Videos</h1>
          {youtubeStatus.channelTitle && (
            <p className="text-muted-foreground" data-testid="text-channel-name">
              {youtubeStatus.channelTitle}
            </p>
          )}
        </div>
        <Button 
          onClick={handleSync} 
          disabled={isFetching}
          data-testid="button-sync-videos"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Syncing...' : 'Sync Videos'}
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search videos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-videos"
        />
      </div>

      {videosLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <VideoSkeleton key={i} />
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card className="p-12 text-center">
          <Youtube className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {searchQuery ? "No videos found" : "No videos yet"}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery 
              ? "Try a different search term." 
              : "Upload videos to your YouTube channel to get started."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <VideoCard 
              key={video.id} 
              video={video} 
              onGenerateThumbnails={handleGenerateThumbnails}
            />
          ))}
        </div>
      )}
    </div>
  );
}

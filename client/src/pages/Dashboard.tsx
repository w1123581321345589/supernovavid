import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { 
  Play, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  BarChart3, 
  Youtube, 
  Plus,
  Zap,
  TrendingUp,
  Eye,
  MousePointerClick,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Campaign {
  id: string;
  userId: string;
  videoId: string;
  videoTitle: string;
  originalThumbnailUrl: string | null;
  status: string;
  iterationCount: number;
  maxIterations: number;
  currentWinnerThumbnailId: string | null;
  confidenceScore: number | null;
  bestCtr: number | null;
  originalCtr: number | null;
  nextScheduledRun: string | null;
  createdAt: string;
}

interface YouTubeStatus {
  connected: boolean;
  channelTitle?: string;
  channelId?: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { icon: typeof Play; className: string; label: string }> = {
    pending: { icon: Clock, className: "bg-muted text-muted-foreground", label: "Pending" },
    analyzing: { icon: Sparkles, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Analyzing" },
    generating: { icon: RefreshCw, className: "bg-purple-500/10 text-purple-600 dark:text-purple-400", label: "Generating" },
    testing: { icon: BarChart3, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "A/B Testing" },
    optimizing: { icon: TrendingUp, className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", label: "Optimizing" },
    completed: { icon: CheckCircle2, className: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Completed" },
    failed: { icon: AlertCircle, className: "bg-red-500/10 text-red-600 dark:text-red-400", label: "Failed" },
  };

  const variant = variants[status] || variants.pending;
  const Icon = variant.icon;

  return (
    <Badge className={`gap-1 ${variant.className}`}>
      <Icon className="w-3 h-3" />
      {variant.label}
    </Badge>
  );
}

interface CampaignCardProps {
  campaign: Campaign;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  selectionMode?: boolean;
}

function CampaignCard({ campaign, isSelected, onSelect, selectionMode }: CampaignCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const triggerMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/campaigns/${campaign.id}/trigger-optimization`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Optimization triggered", description: "Running optimization cycle now..." });
    },
  });

  const ctrImprovement = campaign.bestCtr && campaign.originalCtr
    ? ((campaign.bestCtr - campaign.originalCtr) / campaign.originalCtr * 100).toFixed(1)
    : null;

  const handleCardClick = () => {
    if (selectionMode && onSelect) {
      onSelect(campaign.id, !isSelected);
    } else {
      setLocation(`/campaign/${campaign.id}`);
    }
  };

  return (
    <Card 
      className={`hover-elevate cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={handleCardClick}
      data-testid={`card-campaign-${campaign.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {selectionMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect?.(campaign.id, !!checked)}
                onClick={(e) => e.stopPropagation()}
                data-testid={`checkbox-campaign-${campaign.id}`}
                className="mt-1"
              />
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-1" data-testid={`text-campaign-title-${campaign.id}`}>
                {campaign.videoTitle}
              </CardTitle>
              <CardDescription className="mt-1">
                Video ID: {campaign.videoId}
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={campaign.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {campaign.originalThumbnailUrl && (
          <div className="aspect-video rounded-md overflow-hidden bg-muted">
            <img 
              src={campaign.originalThumbnailUrl} 
              alt={campaign.videoTitle}
              className="w-full h-full object-cover"
              data-testid={`img-thumbnail-${campaign.id}`}
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Optimization Progress</span>
            <span className="font-medium">{campaign.iterationCount} / {campaign.maxIterations}</span>
          </div>
          <Progress 
            value={(campaign.iterationCount / campaign.maxIterations) * 100} 
            className="h-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Original:</span>
            <span className="font-medium">{campaign.originalCtr ? `${(campaign.originalCtr * 100).toFixed(2)}%` : 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MousePointerClick className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Best:</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {campaign.bestCtr ? `${(campaign.bestCtr * 100).toFixed(2)}%` : 'N/A'}
            </span>
          </div>
        </div>

        {ctrImprovement && parseFloat(ctrImprovement) > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10">
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              +{ctrImprovement}% CTR Improvement
            </span>
          </div>
        )}

        {campaign.confidenceScore && (
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-muted-foreground">Confidence:</span>
            <span className="font-medium">{(campaign.confidenceScore * 100).toFixed(0)}%</span>
          </div>
        )}

        {(campaign.status === 'testing' || campaign.status === 'optimizing') && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              triggerMutation.mutate();
            }}
            disabled={triggerMutation.isPending}
            data-testid={`button-trigger-${campaign.id}`}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${triggerMutation.isPending ? 'animate-spin' : ''}`} />
            {triggerMutation.isPending ? 'Running...' : 'Run Optimization Now'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function validateYouTubeUrl(url: string): { valid: boolean; error?: string } {
  if (!url.trim()) {
    return { valid: false, error: "Please enter a YouTube video URL" };
  }
  
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/,
    /^(https?:\/\/)?youtu\.be\/[a-zA-Z0-9_-]{11}/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[a-zA-Z0-9_-]{11}/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]{11}/,
  ];
  
  const isValid = patterns.some(pattern => pattern.test(url.trim()));
  
  if (!isValid) {
    return { valid: false, error: "Invalid YouTube URL. Use formats like youtube.com/watch?v=... or youtu.be/..." };
  }
  
  return { valid: true };
}

export default function Dashboard() {
  const [videoUrl, setVideoUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setVideoUrl(value);
    
    // Clear error when user starts typing
    if (urlError && value.trim()) {
      const validation = validateYouTubeUrl(value);
      if (validation.valid) {
        setUrlError(null);
      }
    }
  };

  const handleUrlBlur = () => {
    if (videoUrl.trim()) {
      const validation = validateYouTubeUrl(videoUrl);
      if (!validation.valid) {
        setUrlError(validation.error || null);
      } else {
        setUrlError(null);
      }
    }
  };

  const { data: youtubeStatus, isLoading: loadingYouTube } = useQuery<YouTubeStatus>({
    queryKey: ["/api/youtube/status"],
  });

  const { data: campaigns, isLoading: loadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const filteredCampaigns = campaigns?.filter(c =>
    c.videoTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.videoId.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const connectYouTubeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/youtube/auth-url");
      return res.json();
    },
    onSuccess: (data: { authUrl: string }) => {
      window.location.href = data.authUrl;
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to initiate YouTube connection", variant: "destructive" });
    },
  });

  const createDemoCampaignMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/campaigns/demo");
    },
    onSuccess: async (res) => {
      const campaign = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Demo Started", description: "Watch the optimization pipeline in action!" });
      setLocation(`/campaign/${campaign.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create demo campaign", variant: "destructive" });
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      // Client-side validation first
      const validation = validateYouTubeUrl(videoUrl);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      return apiRequest("POST", "/api/campaigns", { youtubeVideoUrl: videoUrl.trim() });
    },
    onSuccess: async (res) => {
      const campaign = await res.json();
      setVideoUrl("");
      setUrlError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Success", description: "Campaign created! Autonomous optimization starting." });
      setLocation(`/campaign/${campaign.id}`);
    },
    onError: async (error: any) => {
      const errorMessage = error?.message || "Failed to create campaign";
      
      if (error?.requiresYoutubeAuth || errorMessage.includes("connect your YouTube")) {
        connectYouTubeMutation.mutate();
        return;
      }
      
      // Handle specific error types
      if (error?.field === "youtubeVideoUrl") {
        setUrlError(errorMessage);
      } else if (error?.existingCampaignId) {
        toast({ 
          title: "Campaign Exists", 
          description: "You already have an active campaign for this video.",
          variant: "destructive",
        });
        setLocation(`/campaign/${error.existingCampaignId}`);
      } else {
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/campaigns/bulk", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ 
        title: "Campaigns Deleted", 
        description: `Successfully deleted ${selectedCampaigns.size} campaign(s)` 
      });
      setSelectedCampaigns(new Set());
      setSelectionMode(false);
      setShowDeleteDialog(false);
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to delete campaigns", 
        variant: "destructive" 
      });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("youtube") === "connected") {
      toast({ title: "YouTube Connected", description: "Your channel is now connected!" });
      window.history.replaceState({}, "", "/dashboard");
    } else if (params.get("youtube") === "error") {
      toast({ title: "Connection Failed", description: "Failed to connect YouTube channel", variant: "destructive" });
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [toast]);

  const handleSelectCampaign = (id: string, selected: boolean) => {
    const newSelection = new Set(selectedCampaigns);
    if (selected) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedCampaigns(newSelection);
  };

  const handleSelectAll = (campaigns: Campaign[]) => {
    const allSelected = campaigns.every(c => selectedCampaigns.has(c.id));
    const newSelection = new Set(selectedCampaigns);
    if (allSelected) {
      campaigns.forEach(c => newSelection.delete(c.id));
    } else {
      campaigns.forEach(c => newSelection.add(c.id));
    }
    setSelectedCampaigns(newSelection);
  };

  const cancelSelectionMode = () => {
    setSelectionMode(false);
    setSelectedCampaigns(new Set());
  };

  const activeCampaigns = filteredCampaigns.filter(c => ['testing', 'optimizing', 'analyzing', 'generating'].includes(c.status)) || [];
  const completedCampaigns = filteredCampaigns.filter(c => c.status === 'completed') || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">SupernovaVid Dashboard</h1>
          <p className="text-muted-foreground mt-1">Autonomous thumbnail optimization running 24/7</p>
        </div>
        
        {loadingYouTube ? (
          <div className="animate-pulse h-10 w-48 bg-muted rounded-md" />
        ) : youtubeStatus?.connected ? (
          <Badge className="gap-2 px-4 py-2 bg-green-500/10 text-green-600 dark:text-green-400">
            <Youtube className="w-4 h-4" />
            Connected: {youtubeStatus.channelTitle}
          </Badge>
        ) : (
          <Button 
            onClick={() => connectYouTubeMutation.mutate()}
            disabled={connectYouTubeMutation.isPending}
            className="gap-2"
            data-testid="button-connect-youtube"
          >
            <Youtube className="w-4 h-4" />
            {connectYouTubeMutation.isPending ? 'Connecting...' : 'Connect YouTube Channel'}
          </Button>
        )}
      </div>

      {(activeCampaigns.length > 0 || completedCampaigns.length > 0) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              placeholder="Search campaigns by title or video ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-campaigns"
              className="max-w-sm"
            />
            {!selectionMode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectionMode(true)}
                data-testid="button-select-mode"
              >
                Select
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelSelectionMode}
                  data-testid="button-cancel-selection"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
          
          {selectionMode && selectedCampaigns.size > 0 && (
            <div className="flex items-center gap-3 p-2 bg-muted rounded-md">
              <span className="text-sm font-medium" data-testid="text-selected-count">
                {selectedCampaigns.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Start New Campaign
          </CardTitle>
          <CardDescription>
            Paste a YouTube video URL to begin autonomous optimization ($20/video)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={handleUrlChange}
                onBlur={handleUrlBlur}
                className={urlError ? "border-red-500 focus-visible:ring-red-500" : ""}
                data-testid="input-video-url"
              />
              {urlError && (
                <p className="text-sm text-red-500" data-testid="text-url-error">
                  {urlError}
                </p>
              )}
            </div>
            <Button 
              onClick={() => {
                const validation = validateYouTubeUrl(videoUrl);
                if (!validation.valid) {
                  setUrlError(validation.error || null);
                  return;
                }
                createCampaignMutation.mutate();
              }}
              disabled={!videoUrl.trim() || createCampaignMutation.isPending || !youtubeStatus?.connected}
              className="gap-2"
              data-testid="button-create-campaign"
            >
              <Zap className="w-4 h-4" />
              {createCampaignMutation.isPending ? 'Creating...' : 'Start Optimization'}
            </Button>
          </div>
          {!youtubeStatus?.connected && !loadingYouTube && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Connect your YouTube channel first to start optimizing videos.
            </p>
          )}
        </CardContent>
      </Card>

      {activeCampaigns.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-cyan-500 animate-spin" />
              Active Campaigns ({activeCampaigns.length})
            </h2>
            {selectionMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSelectAll(activeCampaigns)}
                data-testid="button-select-all-active"
              >
                {activeCampaigns.every(c => selectedCampaigns.has(c.id)) ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCampaigns.map((campaign) => (
              <CampaignCard 
                key={campaign.id} 
                campaign={campaign}
                isSelected={selectedCampaigns.has(campaign.id)}
                onSelect={handleSelectCampaign}
                selectionMode={selectionMode}
              />
            ))}
          </div>
        </section>
      )}

      {completedCampaigns.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Completed Campaigns ({completedCampaigns.length})
            </h2>
            {selectionMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSelectAll(completedCampaigns)}
                data-testid="button-select-all-completed"
              >
                {completedCampaigns.every(c => selectedCampaigns.has(c.id)) ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedCampaigns.map((campaign) => (
              <CampaignCard 
                key={campaign.id} 
                campaign={campaign}
                isSelected={selectedCampaigns.has(campaign.id)}
                onSelect={handleSelectCampaign}
                selectionMode={selectionMode}
              />
            ))}
          </div>
        </section>
      )}

      {loadingCampaigns ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-muted rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : campaigns?.length === 0 && (
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">No campaigns yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Start your first autonomous optimization campaign by pasting a YouTube video URL above.
              Our AI will analyze, generate, and test thumbnails automatically.
            </p>
            <Button 
              variant="outline" 
              onClick={() => createDemoCampaignMutation.mutate()}
              disabled={createDemoCampaignMutation.isPending}
              data-testid="button-try-demo"
            >
              <Play className="w-4 h-4 mr-2" />
              {createDemoCampaignMutation.isPending ? 'Starting...' : 'Try Demo Mode'}
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCampaigns.size} Campaign(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected campaigns
              and all associated thumbnails and test data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedCampaigns))}
              className="bg-destructive text-destructive-foreground"
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Play, CheckCircle2, Clock, AlertCircle, BarChart3, TrendingUp, Eye, MousePointerClick, RefreshCw, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface Campaign {
  id: string;
  userId: string;
  youtubeVideoId: string;
  videoTitle: string;
  originalThumbnailUrl: string | null;
  status: string;
  currentIteration: number;
  maxIterations: number;
  winningThumbnailId: string | null;
  finalCtr?: number | null;
  ctrImprovement?: number | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { icon: typeof Play; className: string; label: string }> = {
    pending_payment: { icon: Clock, className: "bg-muted text-muted-foreground", label: "Pending" },
    analyzing: { icon: Sparkles, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Analyzing" },
    generating: { icon: RefreshCw, className: "bg-purple-500/10 text-purple-600 dark:text-purple-400", label: "Generating" },
    testing: { icon: BarChart3, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "A/B Testing" },
    optimizing: { icon: TrendingUp, className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", label: "Optimizing" },
    settled: { icon: CheckCircle2, className: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Settled" },
    failed: { icon: AlertCircle, className: "bg-red-500/10 text-red-600 dark:text-red-400", label: "Failed" },
  };

  const variant = variants[status] || variants.pending_payment;
  const Icon = variant.icon;

  return (
    <Badge className={`gap-1 ${variant.className}`}>
      <Icon className="w-3 h-3" />
      {variant.label}
    </Badge>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const triggerMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/campaigns/${campaign.id}/trigger-optimization`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Optimization triggered", description: "Running optimization cycle now..." });
    },
  });

  const ctrImprovement = campaign.ctrImprovement ? parseFloat(campaign.ctrImprovement as any).toFixed(1) : null;

  return (
    <Card 
      className="hover-elevate cursor-pointer transition-all" 
      onClick={() => setLocation(`/campaign/${campaign.id}`)}
      data-testid={`card-campaign-${campaign.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg line-clamp-1" data-testid={`text-campaign-title-${campaign.id}`}>
              {campaign.videoTitle || campaign.youtubeVideoId}
            </CardTitle>
            <CardDescription className="mt-1">
              Video ID: {campaign.youtubeVideoId}
            </CardDescription>
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
            <span className="font-medium">{campaign.currentIteration} / {campaign.maxIterations}</span>
          </div>
          <Progress 
            value={(campaign.currentIteration / campaign.maxIterations) * 100} 
            className="h-2"
          />
        </div>

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
            {triggerMutation.isPending ? 'Running...' : 'Run Now'}
          </Button>
        )}

        {ctrImprovement && parseFloat(ctrImprovement) > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10">
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              +{ctrImprovement}% CTR Improvement
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CampaignList() {
  const [, setLocation] = useLocation();
  
  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="aspect-video rounded-md" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const activeCampaigns = campaigns?.filter(c => ['testing', 'optimizing', 'analyzing', 'generating'].includes(c.status)) || [];
  const settledCampaigns = campaigns?.filter(c => c.status === 'settled') || [];
  const failedCampaigns = campaigns?.filter(c => c.status === 'failed') || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Manage your autonomous thumbnail optimization campaigns</p>
        </div>
        <Button 
          onClick={() => setLocation("/campaigns/create")}
          className="gap-2"
          data-testid="button-create-campaign"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </div>

      {activeCampaigns.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Active Campaigns</h2>
          <div className="grid gap-4">
            {activeCampaigns.map(campaign => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </div>
      )}

      {settledCampaigns.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Completed</h2>
          <div className="grid gap-4">
            {settledCampaigns.map(campaign => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </div>
      )}

      {failedCampaigns.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Failed</h2>
          <div className="grid gap-4">
            {failedCampaigns.map(campaign => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </div>
      )}

      {!campaigns?.length && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-6">Create your first campaign to start autonomous thumbnail optimization</p>
            <Button 
              onClick={() => setLocation("/campaigns/create")}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

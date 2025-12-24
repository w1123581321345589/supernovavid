import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft,
  Play, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  BarChart3, 
  Zap,
  TrendingUp,
  Eye,
  MousePointerClick,
  RefreshCw,
  Sparkles,
  Calendar,
  Target,
  Award,
  Wifi,
  WifiOff,
  Activity,
  Copy,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";

interface CampaignStatus {
  campaign: {
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
  };
  thumbnails: Array<{
    id: string;
    name: string;
    imageUrl: string;
    variationIndex: number;
    ctr?: number;
    impressions?: number;
    clicks?: number;
    isWinner?: boolean;
  }>;
  runs: Array<{
    id: string;
    runNumber: number;
    status: string;
    startedAt: string;
    completedAt?: string;
    metrics?: Record<string, number>;
    ctrDelta?: number;
  }>;
  performance: Array<{
    id: string;
    recordedAt: string;
    impressions: number;
    clicks: number;
    ctr: number;
    thumbnailId?: string;
  }>;
}

interface AnalyticsData {
  campaign: any;
  variantStats: Array<{
    id: string;
    name: string;
    imageUrl: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  confidenceResult: {
    winnerId: string | null;
    confidence: number;
    isSignificant: boolean;
    pValue: number;
    zScore: number;
  } | null;
  improvement: number;
  baselineCtr: number;
  currentBestCtr: number;
  timeline: Array<{
    date: string;
    ctr: number;
    impressions: number;
    thumbnailId: string;
  }>;
  runs: any[];
  totalIterations: number;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { icon: typeof Play; className: string; label: string }> = {
    pending: { icon: Clock, className: "bg-muted text-muted-foreground", label: "Pending" },
    analyzing: { icon: Sparkles, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Analyzing" },
    generating: { icon: RefreshCw, className: "bg-purple-500/10 text-purple-600 dark:text-purple-400", label: "Generating" },
    testing: { icon: BarChart3, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "A/B Testing" },
    optimizing: { icon: TrendingUp, className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", label: "Optimizing" },
    settled: { icon: CheckCircle2, className: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Settled" },
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

function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <Badge 
      variant="outline" 
      className={`gap-1 ${isConnected ? 'text-green-600 border-green-500/30' : 'text-muted-foreground'}`}
    >
      {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {isConnected ? 'Live' : 'Offline'}
    </Badge>
  );
}

// Performance chart - shows view velocity (views/hour) as the comparable metric
// Note: YouTube API doesn't expose raw CTR, so we use view velocity as a proxy
function CTRTrendChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        <Activity className="w-8 h-8 mr-2" />
        <span>No performance data yet</span>
      </div>
    );
  }

  const chartData = data.map((d: any, i: number) => {
    // CTR comes from backend already as percentage (e.g., 12.5 for 12.5%)
    // If it's a proportion (< 1), multiply by 100 to convert to percentage
    const rawCtr = d.ctr || 0;
    const ctrValue = rawCtr < 1 && rawCtr > 0 ? rawCtr * 100 : rawCtr;
    
    return {
      name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ctr: parseFloat(ctrValue.toFixed(2)),
      impressions: d.impressions || 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="ctrGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
        <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `${v}%`} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            borderColor: 'hsl(var(--border))',
            borderRadius: '6px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
        />
        <Area 
          type="monotone" 
          dataKey="ctr" 
          stroke="hsl(var(--primary))" 
          fill="url(#ctrGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function VariantComparisonChart({ variants }: { variants: any[] }) {
  if (!variants || variants.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-muted-foreground">
        <BarChart3 className="w-6 h-6 mr-2" />
        <span>No variant data yet</span>
      </div>
    );
  }

  const chartData = variants.map((v: any, i: number) => {
    // CTR should be percentage, convert if proportion
    const rawCtr = v.ctr || 0;
    const ctrValue = rawCtr < 1 && rawCtr > 0 ? rawCtr * 100 : rawCtr;
    
    return {
      name: `V${i + 1}`,
      ctr: parseFloat(ctrValue.toFixed(2)),
      impressions: v.impressions,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
        <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `${v}%`} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            borderColor: 'hsl(var(--border))',
            borderRadius: '6px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
        />
        <Bar dataKey="ctr" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ConfidenceGauge({ confidence }: { confidence: number }) {
  const percentage = Math.min(Math.round(confidence * 100), 100);
  const isSignificant = percentage >= 95;
  
  return (
    <div className="text-center space-y-2">
      <div className="relative w-24 h-24 mx-auto">
        <svg className="transform -rotate-90 w-24 h-24">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-muted"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${percentage * 2.51} 251`}
            className={isSignificant ? 'text-green-500' : 'text-amber-500'}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold ${isSignificant ? 'text-green-500' : 'text-amber-500'}`}>
            {percentage}%
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {isSignificant ? 'Statistically significant' : 'Gathering more data...'}
      </p>
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [wsConnected, setWsConnected] = useState(false);
  const [liveUpdate, setLiveUpdate] = useState<any>(null);

  const { data: status, isLoading } = useQuery<CampaignStatus>({
    queryKey: ["/api/campaigns", id],
    refetchInterval: 30000,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/campaigns", id, "analytics"],
    enabled: !!id,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
          ws?.send(JSON.stringify({ type: 'subscribe', campaignId: id }));
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLiveUpdate(data);
            
            if (data.type === 'status_change' || data.type === 'campaign_update') {
              queryClient.invalidateQueries({ queryKey: ["/api/campaigns", id] });
              queryClient.invalidateQueries({ queryKey: ["/api/campaigns", id, "analytics"] });
            }

            if (data.type === 'status_change') {
              toast({
                title: 'Campaign Update',
                description: `Status changed to: ${data.status}`,
              });
            }
          } catch (e) {
            console.error('WebSocket message error:', e);
          }
        };
      } catch (e) {
        console.error('WebSocket connection error:', e);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, [id, toast]);

  const triggerMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/campaigns/${id}/trigger-optimization`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", id, "analytics"] });
      toast({ title: "Optimization triggered", description: "Running optimization cycle now..." });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/campaigns/${id}/duplicate`),
    onSuccess: (res) => {
      res.json().then((newCampaign) => {
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
        toast({ title: "Campaign duplicated", description: "New campaign created successfully!" });
        setLocation(`/campaign/${newCampaign.id}`);
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to duplicate campaign", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/4" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (!status?.campaign) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold">Campaign not found</h3>
          <Button className="mt-4" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { campaign, thumbnails, runs } = status;
  const ctrImprovement = analytics?.improvement || (
    campaign.bestCtr && campaign.originalCtr
      ? ((campaign.bestCtr - campaign.originalCtr) / campaign.originalCtr * 100)
      : 0
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold line-clamp-1" data-testid="text-campaign-title">
            {campaign.videoTitle}
          </h1>
          <p className="text-muted-foreground">Video ID: {campaign.videoId}</p>
        </div>
        <ConnectionStatus isConnected={wsConnected} />
        <StatusBadge status={campaign.status} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => duplicateMutation.mutate()}
          disabled={duplicateMutation.isPending}
          data-testid="button-duplicate"
        >
          <Copy className="w-4 h-4 mr-2" />
          {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Progress</CardTitle>
              <CardDescription>
                Iteration {campaign.iterationCount} of {campaign.maxIterations}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Progress 
                value={(campaign.iterationCount / campaign.maxIterations) * 100} 
                className="h-3"
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Eye className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Baseline</p>
                  <p className="text-xl font-bold">
                    {analytics?.baselineCtr ? `${analytics.baselineCtr.toFixed(2)}%` : (campaign.originalCtr ? `${(campaign.originalCtr * 100).toFixed(2)}%` : 'N/A')}
                  </p>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-500/10">
                  <MousePointerClick className="w-6 h-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-muted-foreground">Best Performance</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {analytics?.currentBestCtr ? `${analytics.currentBestCtr.toFixed(2)}%` : (campaign.bestCtr ? `${(campaign.bestCtr * 100).toFixed(2)}%` : 'N/A')}
                  </p>
                </div>
                <div className="text-center p-4 rounded-lg bg-amber-500/10">
                  <Target className="w-6 h-6 mx-auto mb-2 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {analytics?.confidenceResult?.confidence 
                      ? `${(analytics.confidenceResult.confidence * 100).toFixed(0)}%` 
                      : (campaign.confidenceScore ? `${(campaign.confidenceScore * 100).toFixed(0)}%` : 'N/A')}
                  </p>
                </div>
                <div className="text-center p-4 rounded-lg bg-cyan-500/10">
                  <TrendingUp className="w-6 h-6 mx-auto mb-2 text-cyan-600 dark:text-cyan-400" />
                  <p className="text-sm text-muted-foreground">Improvement</p>
                  <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                    {ctrImprovement ? `+${ctrImprovement.toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
              </div>

              {campaign.nextScheduledRun && campaign.status !== 'completed' && campaign.status !== 'settled' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm">
                    Next optimization: {new Date(campaign.nextScheduledRun).toLocaleString()}
                  </span>
                </div>
              )}

              {(campaign.status === 'testing' || campaign.status === 'optimizing') && (
                <Button 
                  onClick={() => triggerMutation.mutate()}
                  disabled={triggerMutation.isPending}
                  className="w-full gap-2"
                  data-testid="button-trigger-optimization"
                >
                  <RefreshCw className={`w-4 h-4 ${triggerMutation.isPending ? 'animate-spin' : ''}`} />
                  {triggerMutation.isPending ? 'Running Optimization...' : 'Run Optimization Now'}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Performance Over Time
              </CardTitle>
              <CardDescription>
                View velocity trend across optimization iterations (views per hour)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CTRTrendChart data={analytics?.timeline || []} />
            </CardContent>
          </Card>

          {analytics?.variantStats && analytics.variantStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Variant Comparison
                </CardTitle>
                <CardDescription>
                  View velocity by thumbnail variant
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VariantComparisonChart variants={analytics.variantStats} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Thumbnail Variations
              </CardTitle>
              <CardDescription>
                AI-generated thumbnails being tested
              </CardDescription>
            </CardHeader>
            <CardContent>
              {thumbnails && thumbnails.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {thumbnails.map((thumb: any, index: number) => {
                    const variantStat = analytics?.variantStats?.find(v => v.id === thumb.id);
                    
                    return (
                      <div
                        key={thumb.id}
                        className={`relative rounded-md overflow-hidden border-2 ${
                          analytics?.confidenceResult?.winnerId === thumb.id
                            ? 'border-green-500'
                            : thumb.id === campaign.currentWinnerThumbnailId
                            ? 'border-amber-500'
                            : 'border-transparent'
                        }`}
                        data-testid={`thumbnail-${thumb.id}`}
                      >
                        {analytics?.confidenceResult?.winnerId === thumb.id && (
                          <div className="absolute top-2 left-2 z-10">
                            <Badge className="gap-1 bg-green-500 text-white">
                              <Award className="w-3 h-3" />
                              Winner
                            </Badge>
                          </div>
                        )}
                        <div className="aspect-video bg-muted">
                          <img
                            src={thumb.imageUrl}
                            alt={thumb.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-2 text-sm space-y-1">
                          <p className="font-medium truncate">{thumb.name || `Variant ${index + 1}`}</p>
                          <div className="flex items-center justify-between text-muted-foreground text-xs">
                            <span>CTR: {variantStat?.ctr?.toFixed(2) || thumb.ctr?.toFixed(2) || 'N/A'}%</span>
                            <span>{variantStat?.impressions || thumb.impressions || 0} views</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Thumbnails will appear here once generation begins
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {analytics?.confidenceResult && (
            <Card>
              <CardHeader>
                <CardTitle>Statistical Confidence</CardTitle>
                <CardDescription>
                  95% confidence required to declare winner
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConfidenceGauge confidence={analytics.confidenceResult.confidence} />
                {analytics.confidenceResult.isSignificant && (
                  <div className="mt-4 p-3 rounded-lg bg-green-500/10 text-center">
                    <CheckCircle2 className="w-5 h-5 mx-auto text-green-500 mb-2" />
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Winner found with statistical significance
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Original Thumbnail</CardTitle>
            </CardHeader>
            <CardContent>
              {campaign.originalThumbnailUrl ? (
                <div className="aspect-video rounded-md overflow-hidden bg-muted">
                  <img
                    src={campaign.originalThumbnailUrl}
                    alt="Original thumbnail"
                    className="w-full h-full object-cover"
                    data-testid="img-original-thumbnail"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-md bg-muted flex items-center justify-center">
                  <p className="text-muted-foreground">No original thumbnail</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Optimization History</CardTitle>
            </CardHeader>
            <CardContent>
              {runs && runs.length > 0 ? (
                <div className="space-y-3">
                  {runs.slice(0, 5).map((run: any) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                      data-testid={`run-${run.id}`}
                    >
                      <div>
                        <p className="text-sm font-medium">Run #{run.runNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(run.startedAt).toLocaleString()}
                        </p>
                        {run.ctrDelta !== undefined && (
                          <p className={`text-xs ${run.ctrDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {run.ctrDelta >= 0 ? '+' : ''}{run.ctrDelta?.toFixed(2)}% CTR
                          </p>
                        )}
                      </div>
                      <StatusBadge status={run.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    No optimization runs yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-blue-600">1</span>
                </div>
                <p>AI analyzes your video transcript and content</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-purple-600">2</span>
                </div>
                <p>Generates multiple thumbnail variations</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-amber-600">3</span>
                </div>
                <p>Runs A/B tests on YouTube automatically</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-green-600">4</span>
                </div>
                <p>Settles on the highest-performing thumbnail with 95% confidence</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

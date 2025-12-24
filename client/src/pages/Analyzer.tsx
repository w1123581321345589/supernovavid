import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Zap, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Lightbulb,
  ImagePlus,
  ExternalLink,
  Copy,
  TrendingUp,
  Loader2,
  Search,
  Target,
} from "lucide-react";

interface AnalysisJob {
  id: string;
  userId: string;
  youtubeVideoId: string;
  youtubeVideoUrl: string;
  videoTitle: string | null;
  hookCount: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface HookInsight {
  id: string;
  timestampSeconds: number;
  hookTitle: string;
  thumbnailText: string;
  strategy: string;
  confidenceScore: number | null;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { icon: typeof Clock; className: string; label: string }> = {
    pending: { icon: Clock, className: "bg-muted text-muted-foreground", label: "Pending" },
    processing: { icon: Sparkles, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Analyzing" },
    completed: { icon: CheckCircle2, className: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Complete" },
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

function HookCard({ hook, videoId, onGenerateThumbnail }: { 
  hook: HookInsight; 
  videoId: string;
  onGenerateThumbnail: (hook: HookInsight) => void;
}) {
  const { toast } = useToast();
  const timestampUrl = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(hook.timestampSeconds)}s`;
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <Card className="overflow-visible" data-testid={`card-hook-${hook.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {formatTimestamp(hook.timestampSeconds)}
            </Badge>
            {hook.confidenceScore && (
              <Badge className="bg-gradient-to-r from-violet-600/10 to-indigo-600/10 text-violet-600 dark:text-violet-400 gap-1">
                <TrendingUp className="w-3 h-3" />
                {Math.round(hook.confidenceScore * 100)}%
              </Badge>
            )}
          </div>
          <a 
            href={timestampUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`link-timestamp-${hook.id}`}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Hook Title</Label>
          <div className="flex items-start gap-2 mt-1">
            <p className="text-sm font-medium flex-1">{hook.hookTitle}</p>
            <Button 
              size="icon" 
              variant="ghost" 
              className="shrink-0"
              onClick={() => copyToClipboard(hook.hookTitle)}
              data-testid={`button-copy-title-${hook.id}`}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        
        <div>
          <Label className="text-xs text-muted-foreground">Thumbnail Text</Label>
          <div className="flex items-center gap-2 mt-1">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-3 py-1.5 rounded-md font-bold text-sm">
              {hook.thumbnailText}
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className="shrink-0"
              onClick={() => copyToClipboard(hook.thumbnailText)}
              data-testid={`button-copy-text-${hook.id}`}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            Strategy
          </Label>
          <p className="text-sm text-muted-foreground mt-1">{hook.strategy}</p>
        </div>

        <Button 
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
          onClick={() => onGenerateThumbnail(hook)}
          data-testid={`button-generate-thumbnail-${hook.id}`}
        >
          <ImagePlus className="w-4 h-4 mr-2" />
          Generate Thumbnail
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Analyzer() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [hookCount, setHookCount] = useState([3]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);

  const { data: jobData, refetch: refetchJob } = useQuery<{ job: AnalysisJob; insights: HookInsight[] }>({
    queryKey: ['/api/analyze', currentJobId],
    enabled: !!currentJobId,
    refetchInterval: pollingEnabled ? 2000 : false,
  });

  const { data: historyJobs } = useQuery<AnalysisJob[]>({
    queryKey: ['/api/analyze'],
  });

  useEffect(() => {
    if (jobData?.job) {
      const status = jobData.job.status;
      if (status === 'completed' || status === 'failed') {
        setPollingEnabled(false);
      }
    }
  }, [jobData]);

  const analyzeMutation = useMutation({
    mutationFn: async (data: { youtubeVideoUrl: string; hookCount: number }) => {
      const res = await apiRequest("POST", "/api/analyze", data);
      return res.json() as Promise<{ jobId: string; status: string }>;
    },
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
      setPollingEnabled(true);
      toast({ title: "Analysis started", description: "Extracting viral moments from video..." });
    },
    onError: () => {
      toast({ title: "Analysis failed", description: "Please try again", variant: "destructive" });
    },
  });

  const handleAnalyze = () => {
    if (!youtubeUrl.trim()) {
      toast({ title: "URL required", description: "Please enter a YouTube video URL", variant: "destructive" });
      return;
    }
    analyzeMutation.mutate({ youtubeVideoUrl: youtubeUrl, hookCount: hookCount[0] });
  };

  const handleGenerateThumbnail = (hook: HookInsight) => {
    const params = new URLSearchParams({
      hook: hook.hookTitle,
      text: hook.thumbnailText,
      videoId: jobData?.job?.youtubeVideoId || '',
    });
    setLocation(`/campaigns/create?${params.toString()}`);
  };

  const loadPreviousJob = (job: AnalysisJob) => {
    setCurrentJobId(job.id);
    setYoutubeUrl(job.youtubeVideoUrl);
    if (job.status === 'pending' || job.status === 'processing') {
      setPollingEnabled(true);
    }
  };

  const isProcessing = analyzeMutation.isPending || 
    (jobData?.job?.status === 'pending' || jobData?.job?.status === 'processing');

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 rounded-lg">
            <Search className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <h1 className="text-3xl font-bold">Video Analyzer</h1>
        </div>
        <p className="text-muted-foreground">
          Extract viral moments and hook ideas from any YouTube video
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-600" />
                Analyze Video
              </CardTitle>
              <CardDescription>
                Paste a YouTube URL to discover viral-worthy moments for thumbnails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="youtube-url">YouTube Video URL</Label>
                <Input
                  id="youtube-url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isProcessing}
                  data-testid="input-youtube-url"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Number of Hooks</Label>
                  <span className="text-sm font-medium text-violet-600">{hookCount[0]} hooks</span>
                </div>
                <Slider
                  value={hookCount}
                  onValueChange={setHookCount}
                  min={1}
                  max={10}
                  step={1}
                  disabled={isProcessing}
                  className="w-full"
                  data-testid="slider-hook-count"
                />
                <p className="text-xs text-muted-foreground">
                  More hooks = more thumbnail ideas, but takes longer to analyze
                </p>
              </div>

              <Button 
                onClick={handleAnalyze}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
                data-testid="button-analyze"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing Video...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Find Viral Moments
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {jobData?.job && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {jobData.job.videoTitle || 'Video Analysis'}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {jobData.job.youtubeVideoId}
                  </CardDescription>
                </div>
                <StatusBadge status={jobData.job.status} />
              </CardHeader>
              <CardContent>
                {jobData.job.status === 'processing' && (
                  <div className="flex items-center justify-center py-8 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                    <p className="text-muted-foreground">Extracting viral moments...</p>
                  </div>
                )}

                {jobData.job.status === 'failed' && (
                  <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {jobData.job.errorMessage || 'Analysis failed. Please try another video.'}
                    </p>
                  </div>
                )}

                {jobData.job.status === 'completed' && jobData.insights && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {jobData.insights.map((hook) => (
                      <HookCard 
                        key={hook.id} 
                        hook={hook} 
                        videoId={jobData.job.youtubeVideoId}
                        onGenerateThumbnail={handleGenerateThumbnail}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Analyses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyJobs && historyJobs.length > 0 ? (
                <div className="space-y-2">
                  {historyJobs.slice(0, 5).map((job) => (
                    <button
                      key={job.id}
                      onClick={() => loadPreviousJob(job)}
                      className="w-full text-left p-3 rounded-lg border hover-elevate active-elevate-2 transition-colors"
                      data-testid={`button-history-${job.id}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium truncate flex-1">
                          {job.videoTitle || job.youtubeVideoId}
                        </span>
                        <StatusBadge status={job.status} />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No analyses yet. Start by pasting a YouTube URL.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-500/5 to-indigo-500/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" />
                Pro Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Use videos with strong emotional peaks for best results</p>
              <p>Analyze competitor videos to find winning formulas</p>
              <p>Connect hooks directly to thumbnail generation for fastest workflow</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { ArrowLeft, Youtube, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

export default function CampaignCreate() {
  const [videoUrl, setVideoUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setVideoUrl(value);
    
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

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
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
        toast({ 
          title: "YouTube Not Connected", 
          description: "Please connect your YouTube channel in Settings first.",
          variant: "destructive",
        });
        setLocation("/settings");
        return;
      }
      
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setLocation("/campaigns")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Create Campaign</h1>
          <p className="text-muted-foreground mt-1">Start autonomous thumbnail optimization</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Youtube className="w-5 h-5" />
            YouTube Video
          </CardTitle>
          <CardDescription>Paste the URL of the video you want to optimize</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Video URL</label>
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={videoUrl}
              onChange={handleUrlChange}
              onBlur={handleUrlBlur}
              disabled={createCampaignMutation.isPending}
              data-testid="input-video-url"
              className={urlError ? "border-red-500" : ""}
            />
            {urlError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{urlError}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
            <h3 className="font-medium">What happens next:</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Video analysis - transcript, frames, visual elements</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Gemini generates 4 thumbnail variations</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Automated A/B testing with thumbnail rotation</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Iterative optimization until 95% confidence achieved</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={() => createCampaignMutation.mutate()}
            disabled={!videoUrl.trim() || !!urlError || createCampaignMutation.isPending}
            size="lg"
            className="w-full"
            data-testid="button-create-campaign"
          >
            {createCampaignMutation.isPending ? "Creating Campaign..." : "Start Optimization"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

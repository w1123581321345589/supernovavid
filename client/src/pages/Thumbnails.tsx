import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Sparkles, Grid3X3, List, Trash2, Loader2, Image, RefreshCw, MessageSquare, Send, Wand2 } from "lucide-react";
import type { Thumbnail, GenerationJob } from "@shared/schema";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  thumbnailUrl?: string;
}

export default function Thumbnails() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [variationCount, setVariationCount] = useState([4]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [editingThumbnail, setEditingThumbnail] = useState<Thumbnail | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [editCommand, setEditCommand] = useState("");

  const { data: thumbnails, isLoading: thumbnailsLoading, refetch: refetchThumbnails } = useQuery<Thumbnail[]>({
    queryKey: ["/api/thumbnails"],
  });

  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery<GenerationJob[]>({
    queryKey: ["/api/generation-jobs"],
  });

  const { data: selectedJobData, isLoading: selectedJobLoading } = useQuery<GenerationJob & { thumbnails: Thumbnail[] }>({
    queryKey: ["/api/generation-jobs", selectedJob],
    enabled: !!selectedJob,
    refetchInterval: (query) => {
      const data = query.state.data as (GenerationJob & { thumbnails: Thumbnail[] }) | undefined;
      if (data?.status === "processing" || data?.status === "pending") {
        return 2000;
      }
      return false;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { prompt: string; variationCount: number }) => {
      const res = await apiRequest("POST", "/api/generation-jobs", data);
      return res.json();
    },
    onSuccess: (job) => {
      toast({
        title: "Generation started",
        description: `Generating ${variationCount[0]} thumbnail variations...`,
      });
      setSelectedJob(job.id);
      setGenerateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/generation-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/thumbnails/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Thumbnail deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/thumbnails"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ thumbnailId, editCommand }: { thumbnailId: string; editCommand: string }) => {
      const res = await apiRequest("POST", `/api/thumbnails/${thumbnailId}/edit`, { editCommand });
      return res.json();
    },
    onSuccess: (data) => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message || "Here's your edited thumbnail!",
          thumbnailUrl: data.thumbnail?.imageUrl,
        },
      ]);
      setEditingThumbnail(data.thumbnail);
      queryClient.invalidateQueries({ queryKey: ["/api/thumbnails"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I couldn't apply that edit: ${error.message}` },
      ]);
      toast({ title: "Edit failed", description: error.message, variant: "destructive" });
    },
  });

  const handleStartEdit = (thumbnail: Thumbnail) => {
    setEditingThumbnail(thumbnail);
    setChatMessages([
      {
        role: "assistant",
        content: "Hi! I can help you refine this thumbnail. Tell me what changes you'd like to make - for example, 'make the background brighter' or 'add more dramatic lighting'.",
        thumbnailUrl: thumbnail.imageUrl,
      },
    ]);
    setEditCommand("");
  };

  const handleSendEdit = () => {
    if (!editCommand.trim() || !editingThumbnail) return;
    
    setChatMessages((prev) => [...prev, { role: "user", content: editCommand }]);
    editMutation.mutate({ thumbnailId: editingThumbnail.id, editCommand: editCommand.trim() });
    setEditCommand("");
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({ title: "Please enter a prompt", variant: "destructive" });
      return;
    }
    generateMutation.mutate({ prompt, variationCount: variationCount[0] });
  };

  const filteredThumbnails = thumbnails?.filter((thumb) => {
    if (!search) return true;
    return thumb.name?.toLowerCase().includes(search.toLowerCase()) ||
           thumb.prompt?.toLowerCase().includes(search.toLowerCase());
  }) || [];

  const pendingJobs = jobs?.filter(j => j.status === "processing" || j.status === "pending") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">My Thumbnails</h1>
          <p className="text-muted-foreground mt-1">
            Generate and manage your AI-powered thumbnails
          </p>
        </div>
        <Sheet open={generateOpen} onOpenChange={setGenerateOpen}>
          <SheetTrigger asChild>
            <Button data-testid="button-generate-new">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate New
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Generate Thumbnails</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="prompt">Describe Your Thumbnail</Label>
                <Textarea
                  id="prompt"
                  placeholder="e.g., Bold text saying 'SHOCKING RESULTS', dramatic lighting, surprised expression, bright yellow background..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-24"
                  data-testid="input-prompt"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Number of Variations</Label>
                  <span className="text-sm font-medium">{variationCount[0]}</span>
                </div>
                <Slider
                  value={variationCount}
                  onValueChange={setVariationCount}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                  data-testid="slider-variations"
                />
                <p className="text-xs text-muted-foreground">
                  Each variation costs 1 credit
                </p>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !prompt.trim()}
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate {variationCount[0]} Variations
                  </>
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {pendingJobs.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Thumbnails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingJobs.map((job) => (
                <div 
                  key={job.id} 
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-background cursor-pointer hover-elevate"
                  onClick={() => setSelectedJob(job.id)}
                  data-testid={`job-item-${job.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{job.prompt}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.variationCount} variations
                    </p>
                  </div>
                  <Badge variant="secondary">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {job.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search thumbnails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => {
            refetchThumbnails();
            refetchJobs();
          }}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="grid">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {filteredThumbnails.length} thumbnails
          </p>
          <TabsList>
            <TabsTrigger value="grid" data-testid="tab-grid">
              <Grid3X3 className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="list" data-testid="tab-list">
              <List className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="grid" className="mt-0">
          {thumbnailsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="aspect-video rounded-lg" />
              ))}
            </div>
          ) : filteredThumbnails.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredThumbnails.map((thumb) => (
                <div
                  key={thumb.id}
                  className="group relative aspect-video rounded-lg overflow-hidden bg-muted"
                  data-testid={`thumbnail-card-${thumb.id}`}
                >
                  <img
                    src={thumb.imageUrl}
                    alt={thumb.name || "Thumbnail"}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-sm font-medium truncate">
                        {thumb.name || `Variation ${thumb.variationIndex !== null ? thumb.variationIndex + 1 : ""}`}
                      </p>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(thumb);
                        }}
                        data-testid={`button-edit-${thumb.id}`}
                      >
                        <Wand2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(thumb.id);
                        }}
                        data-testid={`button-delete-${thumb.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Image className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No thumbnails yet</h3>
              <p className="text-muted-foreground mb-6">
                Generate your first AI-powered thumbnails
              </p>
              <Button onClick={() => setGenerateOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Thumbnails
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          {thumbnailsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredThumbnails.length > 0 ? (
            <div className="space-y-2">
              {filteredThumbnails.map((thumb) => (
                <div
                  key={thumb.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-card border hover-elevate"
                  data-testid={`list-item-${thumb.id}`}
                >
                  <img
                    src={thumb.imageUrl}
                    alt={thumb.name || "Thumbnail"}
                    className="w-24 h-14 object-cover rounded-md"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {thumb.name || `Variation ${thumb.variationIndex !== null ? thumb.variationIndex + 1 : ""}`}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {thumb.prompt || "No description"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleStartEdit(thumb)}
                    data-testid={`button-list-edit-${thumb.id}`}
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(thumb.id)}
                    data-testid={`button-list-delete-${thumb.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Image className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No thumbnails yet</h3>
              <p className="text-muted-foreground mb-6">
                Generate your first AI-powered thumbnails
              </p>
              <Button onClick={() => setGenerateOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Thumbnails
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generation Progress</DialogTitle>
            <DialogDescription>
              {selectedJobData?.status === "completed" 
                ? "Generation complete!" 
                : "Your thumbnails are being generated..."}
            </DialogDescription>
          </DialogHeader>
          {selectedJobLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="aspect-video rounded-lg" />
              ))}
            </div>
          ) : selectedJobData ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={selectedJobData.status === "completed" ? "default" : "secondary"}>
                  {selectedJobData.status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {selectedJobData.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedJobData.thumbnails?.length || 0} / {selectedJobData.variationCount} generated
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {selectedJobData.thumbnails?.map((thumb) => (
                  <div key={thumb.id} className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <img
                      src={thumb.imageUrl}
                      alt={thumb.name || "Generated thumbnail"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {selectedJobData.status !== "completed" && 
                  Array.from({ length: (selectedJobData.variationCount || 4) - (selectedJobData.thumbnails?.length || 0) }).map((_, i) => (
                    <Skeleton key={`placeholder-${i}`} className="aspect-video rounded-lg" />
                  ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingThumbnail} onOpenChange={(open) => !open && setEditingThumbnail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Edit Thumbnail with AI
            </DialogTitle>
            <DialogDescription>
              Describe the changes you want to make in natural language
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 min-h-0 pr-4">
            <div className="space-y-4 pb-4">
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                    data-testid={`chat-message-${index}`}
                  >
                    <p className="text-sm">{message.content}</p>
                    {message.thumbnailUrl && (
                      <div className="mt-3 aspect-video rounded-md overflow-hidden">
                        <img
                          src={message.thumbnailUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {editMutation.isPending && (
                <div className="flex gap-3 justify-start">
                  <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Generating your edit...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-4 border-t">
            <Input
              placeholder="e.g., Make the background brighter, add more contrast..."
              value={editCommand}
              onChange={(e) => setEditCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendEdit()}
              disabled={editMutation.isPending}
              data-testid="input-edit-command"
            />
            <Button
              onClick={handleSendEdit}
              disabled={!editCommand.trim() || editMutation.isPending}
              data-testid="button-send-edit"
            >
              {editMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

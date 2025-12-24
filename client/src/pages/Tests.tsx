import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, PlayCircle, CheckCircle, Archive, FlaskConical, Loader2, TrendingUp, Download, Clock, Type } from "lucide-react";
import type { AbTest, TestVariant, Thumbnail } from "@shared/schema";

interface TestWithVariants extends AbTest {
  variants?: (TestVariant & { thumbnail?: Thumbnail })[];
}

export default function Tests() {
  const { toast } = useToast();
  const [createTestOpen, setCreateTestOpen] = useState(false);
  const [testName, setTestName] = useState("");
  const [videoId, setVideoId] = useState("");
  const [rotationInterval, setRotationInterval] = useState("none");

  const { data: tests, isLoading } = useQuery<TestWithVariants[]>({
    queryKey: ["/api/tests"],
  });

  const { data: thumbnails } = useQuery<Thumbnail[]>({
    queryKey: ["/api/thumbnails"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; youtubeVideoId?: string; rotationInterval?: string }) => {
      const res = await apiRequest("POST", "/api/tests", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Test created", description: "Your A/B test has been created." });
      setCreateTestOpen(false);
      setTestName("");
      setVideoId("");
      setRotationInterval("none");
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create test", description: error.message, variant: "destructive" });
    },
  });

  const startMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/tests/${id}/start`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Test started" });
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({ title: "Failed to start test", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, winnerId }: { id: string; winnerId?: string }) => {
      const res = await apiRequest("PATCH", `/api/tests/${id}/complete`, { winningVariantId: winnerId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Test completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
    },
    onError: () => {
      toast({ title: "Failed to complete test", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!testName.trim()) {
      toast({ title: "Please enter a test name", variant: "destructive" });
      return;
    }
    createMutation.mutate({ 
      name: testName, 
      youtubeVideoId: videoId.trim() || undefined,
      rotationInterval: rotationInterval !== "none" ? rotationInterval : undefined,
    });
  };

  const activeTests = tests?.filter(t => t.status === "running") || [];
  const completedTests = tests?.filter(t => t.status === "completed") || [];
  const draftTests = tests?.filter(t => t.status === "draft") || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge variant="default"><PlayCircle className="w-3 h-3 mr-1" /> Running</Badge>;
      case "completed":
        return <Badge variant="secondary"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const TestCard = ({ test }: { test: TestWithVariants }) => (
    <Card data-testid={`test-card-${test.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg">{test.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 flex-wrap">
              {test.youtubeVideoId ? `Video: ${test.youtubeVideoId}` : "No video linked"}
              {test.rotationInterval && test.rotationInterval !== "none" && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {test.rotationInterval}
                </Badge>
              )}
            </CardDescription>
          </div>
          {getStatusBadge(test.status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {test.variants && test.variants.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {test.variants.map((variant, idx) => (
                <div 
                  key={variant.id} 
                  className="space-y-2"
                  data-testid={`variant-${variant.id}`}
                >
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    {variant.thumbnail ? (
                      <img
                        src={variant.thumbnail.imageUrl}
                        alt={`Variant ${String.fromCharCode(65 + idx)}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No thumbnail
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">Variant {String.fromCharCode(65 + idx)}</span>
                      {(variant.impressions ?? 0) > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{variant.impressions} imp</span>
                          <Badge variant="outline" className="font-mono">
                            {(((variant.clicks ?? 0) / (variant.impressions ?? 0)) * 100).toFixed(2)}%
                          </Badge>
                        </div>
                      )}
                    </div>
                    {variant.title && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Type className="h-3 w-3" />
                        <span className="truncate">{variant.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FlaskConical className="w-8 h-8 mx-auto mb-2" />
              <p>No variants added yet</p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {test.status === "draft" && (
              <Button 
                onClick={() => startMutation.mutate(test.id)}
                disabled={startMutation.isPending || !test.variants?.length}
                data-testid={`button-start-${test.id}`}
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4 mr-2" />
                )}
                Start Test
              </Button>
            )}
            {test.status === "running" && (
              <Button 
                variant="outline"
                onClick={() => completeMutation.mutate({ id: test.id })}
                disabled={completeMutation.isPending}
                data-testid={`button-complete-${test.id}`}
              >
                {completeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                End Test
              </Button>
            )}
            {(test.status === "completed" || test.status === "running") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.location.href = `/api/tests/${test.id}/export`;
                }}
                data-testid={`button-export-${test.id}`}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">A/B Tests</h1>
          <p className="text-muted-foreground mt-1">
            Compare thumbnail performance and find your winners
          </p>
        </div>
        <Button onClick={() => setCreateTestOpen(true)} data-testid="button-create-test">
          <Plus className="h-4 w-4 mr-2" />
          Create Test
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="gap-2" data-testid="tab-active">
            <PlayCircle className="h-4 w-4" />
            Active ({activeTests.length})
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-2" data-testid="tab-draft">
            <FlaskConical className="h-4 w-4" />
            Drafts ({draftTests.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2" data-testid="tab-completed">
            <CheckCircle className="h-4 w-4" />
            Completed ({completedTests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6 mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : activeTests.length > 0 ? (
            <div className="space-y-6">
              {activeTests.map((test) => (
                <TestCard key={test.id} test={test} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <PlayCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active tests</p>
              <Button onClick={() => setCreateTestOpen(true)}>
                Create your first A/B test
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="draft" className="space-y-6 mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : draftTests.length > 0 ? (
            <div className="space-y-6">
              {draftTests.map((test) => (
                <TestCard key={test.id} test={test} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No draft tests</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : completedTests.length > 0 ? (
            <div className="space-y-6">
              {completedTests.map((test) => (
                <TestCard key={test.id} test={test} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Your completed tests will appear here</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createTestOpen} onOpenChange={setCreateTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create A/B Test</DialogTitle>
            <DialogDescription>
              Set up a new test to compare thumbnail performance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-name">Test Name</Label>
              <Input
                id="test-name"
                placeholder="e.g., Homepage Thumbnail Test"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                data-testid="input-test-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-id">YouTube Video ID (optional)</Label>
              <Input
                id="video-id"
                placeholder="e.g., dQw4w9WgXcQ"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                data-testid="input-video-id"
              />
              <p className="text-xs text-muted-foreground">
                Link to a YouTube video to enable automatic thumbnail rotation
              </p>
            </div>
            <div className="space-y-2">
              <Label>Rotation Schedule (optional)</Label>
              <Select value={rotationInterval} onValueChange={setRotationInterval}>
                <SelectTrigger data-testid="select-rotation">
                  <SelectValue placeholder="Select rotation interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No automatic rotation</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Automatically swap thumbnails on a schedule to test different variants
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTestOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

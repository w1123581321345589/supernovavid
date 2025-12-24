import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  User, Bell, CreditCard, Zap, Link2, ExternalLink, Sparkles, CheckCircle2, XCircle,
  Key, Webhook, Plus, Trash2, Copy, Eye, EyeOff, RefreshCw, Send, Clock, AlertCircle
} from "lucide-react";
import { SiYoutube } from "react-icons/si";

interface Stats {
  totalThumbnails: number;
  activeTests: number;
  avgCtr: number;
  creditsRemaining: number;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  eventType: string;
  status: string;
  statusCode: number | null;
  attemptedAt: string;
}

const WEBHOOK_EVENTS = [
  { value: "campaign.created", label: "Campaign Created" },
  { value: "campaign.completed", label: "Campaign Completed" },
  { value: "campaign.failed", label: "Campaign Failed" },
  { value: "thumbnail.generated", label: "Thumbnail Generated" },
  { value: "test.winner_found", label: "A/B Test Winner Found" },
];

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [showNewWebhookDialog, setShowNewWebhookDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState("never");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [newWebhookName, setNewWebhookName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: youtubeStatus, isLoading: youtubeLoading } = useQuery<{
    connected: boolean;
    channelTitle?: string;
    channelId?: string;
  }>({
    queryKey: ["/api/youtube/status"],
  });

  const { data: apiKeys, isLoading: apiKeysLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const { data: webhooks, isLoading: webhooksLoading } = useQuery<WebhookConfig[]>({
    queryKey: ["/api/webhooks"],
  });

  const { data: deliveries } = useQuery<WebhookDelivery[]>({
    queryKey: ["/api/webhooks", selectedWebhookId, "deliveries"],
    enabled: !!selectedWebhookId,
  });

  const createApiKeyMutation = useMutation({
    mutationFn: (data: { name: string; expiresAt?: string }) =>
      apiRequest("POST", "/api/api-keys", data),
    onSuccess: async (res) => {
      const data = await res.json();
      setCreatedKey(data.key);
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API Key Created", description: "Copy your key now - it won't be shown again." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create API key", variant: "destructive" });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API Key Deleted" });
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: (data: { name: string; url: string; events: string[] }) =>
      apiRequest("POST", "/api/webhooks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setShowNewWebhookDialog(false);
      setNewWebhookName("");
      setNewWebhookUrl("");
      setNewWebhookEvents([]);
      toast({ title: "Webhook Created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create webhook", variant: "destructive" });
    },
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/webhooks/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({ title: "Webhook Deleted" });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/webhooks/${id}/test`),
    onSuccess: () => {
      toast({ title: "Test Sent", description: "Check your webhook endpoint for the test payload." });
    },
    onError: () => {
      toast({ title: "Test Failed", description: "Could not send test webhook", variant: "destructive" });
    },
  });

  const handleConnectYouTube = async () => {
    try {
      const response = await fetch("/api/youtube/auth-url");
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({
          title: "Error",
          description: "Could not generate YouTube authorization URL",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to YouTube",
        variant: "destructive",
      });
    }
  };

  const handleCreateApiKey = () => {
    const expiresAt = newKeyExpiry === "never" ? undefined : 
      newKeyExpiry === "30days" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() :
      newKeyExpiry === "90days" ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() :
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    
    createApiKeyMutation.mutate({ name: newKeyName, expiresAt });
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      toast({ title: "Copied!", description: "API key copied to clipboard" });
    }
  };

  const handleCloseKeyDialog = (open: boolean) => {
    if (!open) {
      setNewKeyName("");
      setNewKeyExpiry("never");
      setCreatedKey(null);
    }
    setShowNewKeyDialog(open);
  };

  const getInitials = () => {
    if (!user) return "?";
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (!user) return "User";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    if (user.email) return user.email.split("@")[0];
    return "User";
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account, integrations, and developer settings
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList>
          <TabsTrigger value="account" data-testid="tab-account">Account</TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
          <TabsTrigger value="api" data-testid="tab-api">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks" data-testid="tab-webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>Your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg" data-testid="text-profile-name">
                    {getDisplayName()}
                  </p>
                  <p className="text-muted-foreground" data-testid="text-profile-email">
                    {user?.email || "No email"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Your profile is managed through Replit authentication.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Usage & Credits
              </CardTitle>
              <CardDescription>Monitor your usage and credit balance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <Zap className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold">Credits Balance</p>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-20 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold" data-testid="text-credits-balance">
                        {stats?.creditsRemaining?.toLocaleString() || 0}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Thumbnails</p>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-12 mt-1" />
                  ) : (
                    <p className="text-xl font-semibold" data-testid="text-total-thumbnails">
                      {stats?.totalThumbnails || 0}
                    </p>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Active Tests</p>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-12 mt-1" />
                  ) : (
                    <p className="text-xl font-semibold" data-testid="text-active-tests">
                      {stats?.activeTests || 0}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Configure how you receive updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Test Complete</p>
                  <p className="text-sm text-muted-foreground">Get notified when an A/B test finishes</p>
                </div>
                <Switch defaultChecked data-testid="switch-test-complete" />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Winner Found</p>
                  <p className="text-sm text-muted-foreground">Alert when a clear winner is determined</p>
                </div>
                <Switch defaultChecked data-testid="switch-winner-found" />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Low Credits Warning</p>
                  <p className="text-sm text-muted-foreground">Alert when credits fall below 100</p>
                </div>
                <Switch defaultChecked data-testid="switch-low-credits" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Generation
              </CardTitle>
              <CardDescription>Powered by Google Gemini</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    G
                  </div>
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">Connected</p>
                    <p className="text-sm text-muted-foreground">Gemini AI Integration</p>
                  </div>
                </div>
                <Badge className="bg-green-500/20 text-green-600 dark:text-green-400">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                AI thumbnail generation is powered by Replit AI Integrations. Usage is billed to your Replit credits.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                YouTube Connection
              </CardTitle>
              <CardDescription>Connect your YouTube channel for autonomous thumbnail optimization</CardDescription>
            </CardHeader>
            <CardContent>
              {youtubeLoading ? (
                <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div>
                      <Skeleton className="h-5 w-24 mb-1" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-32" />
                </div>
              ) : youtubeStatus?.connected ? (
                <div className="flex items-center justify-between gap-4 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white">
                      <SiYoutube className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Connected
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {youtubeStatus.channelTitle || "YouTube Channel"}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-600 dark:text-green-400">Active</Badge>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white">
                      <SiYoutube className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        Not Connected
                      </p>
                      <p className="text-sm text-muted-foreground">Connect to enable A/B testing</p>
                    </div>
                  </div>
                  <Button onClick={handleConnectYouTube} data-testid="button-connect-youtube">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect YouTube
                  </Button>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-4">
                Connect your YouTube channel to enable automatic thumbnail rotation and A/B testing.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>Manage API keys for programmatic access to your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog open={showNewKeyDialog} onOpenChange={handleCloseKeyDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => setShowNewKeyDialog(true)} data-testid="button-create-api-key">
                    <Plus className="h-4 w-4 mr-2" />
                    Create API Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{createdKey ? "API Key Created" : "Create API Key"}</DialogTitle>
                    <DialogDescription>
                      {createdKey 
                        ? "Copy your API key now. It won't be shown again." 
                        : "Create a new API key for programmatic access."}
                    </DialogDescription>
                  </DialogHeader>
                  {createdKey ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all">
                        {createdKey}
                      </div>
                      <Button onClick={handleCopyKey} className="w-full" data-testid="button-copy-key">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy to Clipboard
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="key-name">Key Name</Label>
                        <Input
                          id="key-name"
                          placeholder="My API Key"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                          data-testid="input-key-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="key-expiry">Expiration</Label>
                        <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                          <SelectTrigger data-testid="select-key-expiry">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="never">Never expires</SelectItem>
                            <SelectItem value="30days">30 days</SelectItem>
                            <SelectItem value="90days">90 days</SelectItem>
                            <SelectItem value="1year">1 year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <Button 
                          onClick={handleCreateApiKey} 
                          disabled={!newKeyName || createApiKeyMutation.isPending}
                          data-testid="button-confirm-create-key"
                        >
                          {createApiKeyMutation.isPending ? "Creating..." : "Create Key"}
                        </Button>
                      </DialogFooter>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {apiKeysLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : apiKeys && apiKeys.length > 0 ? (
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div 
                      key={key.id} 
                      className="flex items-center justify-between gap-4 p-4 rounded-lg border"
                      data-testid={`api-key-${key.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{key.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <code className="bg-muted px-1.5 py-0.5 rounded">{key.keyPrefix}...</code>
                          <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                          {key.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires {new Date(key.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteApiKeyMutation.mutate(key.id)}
                        disabled={deleteApiKeyMutation.isPending}
                        data-testid={`button-delete-key-${key.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No API keys yet</p>
                  <p className="text-sm">Create an API key to access your data programmatically</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhooks
              </CardTitle>
              <CardDescription>Receive real-time notifications when events occur</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog open={showNewWebhookDialog} onOpenChange={setShowNewWebhookDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-webhook">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Webhook
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Webhook</DialogTitle>
                    <DialogDescription>
                      Configure a webhook endpoint to receive event notifications.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="webhook-name">Name</Label>
                      <Input
                        id="webhook-name"
                        placeholder="My Webhook"
                        value={newWebhookName}
                        onChange={(e) => setNewWebhookName(e.target.value)}
                        data-testid="input-webhook-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhook-url">Endpoint URL</Label>
                      <Input
                        id="webhook-url"
                        placeholder="https://example.com/webhook"
                        value={newWebhookUrl}
                        onChange={(e) => setNewWebhookUrl(e.target.value)}
                        data-testid="input-webhook-url"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Events</Label>
                      <div className="space-y-2">
                        {WEBHOOK_EVENTS.map((event) => (
                          <div key={event.value} className="flex items-center gap-2">
                            <Checkbox
                              id={event.value}
                              checked={newWebhookEvents.includes(event.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNewWebhookEvents([...newWebhookEvents, event.value]);
                                } else {
                                  setNewWebhookEvents(newWebhookEvents.filter(e => e !== event.value));
                                }
                              }}
                              data-testid={`checkbox-event-${event.value}`}
                            />
                            <Label htmlFor={event.value} className="font-normal cursor-pointer">
                              {event.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={() => createWebhookMutation.mutate({
                        name: newWebhookName,
                        url: newWebhookUrl,
                        events: newWebhookEvents,
                      })}
                      disabled={!newWebhookName || !newWebhookUrl || newWebhookEvents.length === 0 || createWebhookMutation.isPending}
                      data-testid="button-confirm-create-webhook"
                    >
                      {createWebhookMutation.isPending ? "Creating..." : "Create Webhook"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {webhooksLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : webhooks && webhooks.length > 0 ? (
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <div 
                      key={webhook.id} 
                      className="p-4 rounded-lg border space-y-3"
                      data-testid={`webhook-${webhook.id}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{webhook.name}</p>
                            <Badge variant={webhook.isActive ? "default" : "secondary"}>
                              {webhook.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{webhook.url}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => testWebhookMutation.mutate(webhook.id)}
                            disabled={testWebhookMutation.isPending}
                            data-testid={`button-test-webhook-${webhook.id}`}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setSelectedWebhookId(
                              selectedWebhookId === webhook.id ? null : webhook.id
                            )}
                            data-testid={`button-view-deliveries-${webhook.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Switch
                            checked={webhook.isActive}
                            onCheckedChange={(checked) => 
                              toggleWebhookMutation.mutate({ id: webhook.id, isActive: checked })
                            }
                            data-testid={`switch-webhook-${webhook.id}`}
                          />
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                            disabled={deleteWebhookMutation.isPending}
                            data-testid={`button-delete-webhook-${webhook.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                      {selectedWebhookId === webhook.id && deliveries && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <p className="text-sm font-medium">Recent Deliveries</p>
                          {deliveries.length > 0 ? (
                            deliveries.slice(0, 5).map((delivery) => (
                              <div 
                                key={delivery.id} 
                                className="flex items-center justify-between gap-2 text-sm p-2 bg-muted/50 rounded"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  {delivery.status === "success" ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                  )}
                                  <span>{delivery.eventType}</span>
                                  {delivery.statusCode && (
                                    <Badge variant="outline" className="text-xs">
                                      {delivery.statusCode}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-muted-foreground">
                                  {new Date(delivery.attemptedAt).toLocaleString()}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No deliveries yet</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No webhooks configured</p>
                  <p className="text-sm">Create a webhook to receive real-time event notifications</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

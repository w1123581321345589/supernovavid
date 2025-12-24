import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Search, TrendingUp, Gamepad2, Video, BookOpen, Mic, LayoutTemplate, Sparkles,
  Plus, Pencil, Trash2, Copy, Share2, Lock, Globe
} from "lucide-react";
import { Link } from "wouter";
import type { Template } from "@shared/schema";

const categories = [
  { id: "all", label: "All", icon: null },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "gaming", label: "Gaming", icon: Gamepad2 },
  { id: "vlog", label: "Vlogs", icon: Video },
  { id: "tutorial", label: "Tutorials", icon: BookOpen },
  { id: "podcast", label: "Podcasts", icon: Mic },
];

interface TemplateFormData {
  name: string;
  promptTemplate: string;
  category: string;
  isPublic: boolean;
}

export default function Templates() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("browse");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: "",
    promptTemplate: "",
    category: "general",
    isPublic: false,
  });

  const { data: publicTemplates, isLoading: publicLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates", { public: true }],
  });

  const { data: myTemplates, isLoading: myLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates/my"],
  });

  const invalidateTemplates = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    queryClient.invalidateQueries({ queryKey: ["/api/templates/my"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: TemplateFormData) => apiRequest("POST", "/api/templates", data),
    onSuccess: () => {
      invalidateTemplates();
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "Template Created", description: "Your template has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create template", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TemplateFormData> }) =>
      apiRequest("PATCH", `/api/templates/${id}`, data),
    onSuccess: () => {
      invalidateTemplates();
      setEditingTemplate(null);
      resetForm();
      toast({ title: "Template Updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update template", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/templates/${id}`),
    onSuccess: () => {
      invalidateTemplates();
      toast({ title: "Template Deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (template: Template) =>
      apiRequest("POST", "/api/templates", {
        name: `${template.name} (Copy)`,
        promptTemplate: template.promptTemplate,
        category: template.category,
        isPublic: false,
      }),
    onSuccess: () => {
      invalidateTemplates();
      toast({ title: "Template Duplicated", description: "A copy has been added to your templates." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to duplicate template", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      promptTemplate: "",
      category: "general",
      isPublic: false,
    });
  };

  const openEditDialog = (template: Template) => {
    setFormData({
      name: template.name,
      promptTemplate: template.promptTemplate || "",
      category: template.category || "general",
      isPublic: template.isPublic ?? false,
    });
    setEditingTemplate(template);
  };

  const handleSubmit = () => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleCopyPrompt = (promptTemplate: string) => {
    navigator.clipboard.writeText(promptTemplate);
    toast({ title: "Copied!", description: "Prompt template copied to clipboard" });
  };

  const filteredPublicTemplates = publicTemplates?.filter((template) => {
    const matchesSearch = 
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.category?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = 
      category === "all" || 
      template.category?.toLowerCase().includes(category);
    return matchesSearch && matchesCategory;
  }) || [];

  const filteredMyTemplates = myTemplates?.filter((template) => {
    const matchesSearch = 
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.category?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Template Library</h1>
          <p className="text-muted-foreground mt-1">
            Browse proven thumbnail styles or create your own
          </p>
        </div>
        <Dialog open={showCreateDialog || !!editingTemplate} onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingTemplate(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-template">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
              <DialogDescription>
                {editingTemplate 
                  ? "Update your template settings." 
                  : "Create a reusable prompt template for thumbnail generation."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  placeholder="My Awesome Template"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-prompt">Prompt Template</Label>
                <Textarea
                  id="template-prompt"
                  placeholder="Create a YouTube thumbnail with {title} featuring bold text, vibrant colors, and an eye-catching design..."
                  value={formData.promptTemplate}
                  onChange={(e) => setFormData({ ...formData, promptTemplate: e.target.value })}
                  rows={5}
                  data-testid="input-template-prompt"
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{title}"}, {"{channel}"}, or {"{topic}"} as placeholders
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-category">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="gaming">Gaming</SelectItem>
                    <SelectItem value="vlog">Vlogs</SelectItem>
                    <SelectItem value="tutorial">Tutorials</SelectItem>
                    <SelectItem value="podcast">Podcasts</SelectItem>
                    <SelectItem value="trending">Trending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {formData.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  <div>
                    <p className="font-medium text-sm">
                      {formData.isPublic ? "Public Template" : "Private Template"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formData.isPublic 
                        ? "Visible to all users in the library" 
                        : "Only visible to you"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.isPublic}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                  data-testid="switch-template-public"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleSubmit}
                disabled={!formData.name || !formData.promptTemplate || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-template"
              >
                {(createMutation.isPending || updateMutation.isPending) 
                  ? "Saving..." 
                  : editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-templates"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse" data-testid="tab-browse">
            <Globe className="h-4 w-4 mr-2" />
            Browse Library
          </TabsTrigger>
          <TabsTrigger value="my" data-testid="tab-my-templates">
            <LayoutTemplate className="h-4 w-4 mr-2" />
            My Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-6 space-y-4">
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="flex-wrap h-auto gap-1">
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="gap-2"
                  data-testid={`tab-category-${cat.id}`}
                >
                  {cat.icon && <cat.icon className="h-4 w-4" />}
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {filteredPublicTemplates.length} templates available
            </p>
          </div>
          
          {publicLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : filteredPublicTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPublicTemplates.map((template) => (
                <Card 
                  key={template.id} 
                  className="overflow-hidden"
                  data-testid={`template-card-${template.id}`}
                >
                  <div className="aspect-video bg-muted relative">
                    {template.previewUrl ? (
                      <img
                        src={template.previewUrl}
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <LayoutTemplate className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-medium truncate">{template.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {template.category || "General"}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        <Globe className="h-3 w-3 mr-1" />
                        Public
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.promptTemplate}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleCopyPrompt(template.promptTemplate || "")}
                        data-testid={`button-copy-${template.id}`}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => duplicateMutation.mutate(template)}
                        disabled={duplicateMutation.isPending}
                        data-testid={`button-save-${template.id}`}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <LayoutTemplate className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No templates found</h3>
              <p className="text-muted-foreground mb-6">
                {search ? "Try a different search term" : "Templates will appear here when available"}
              </p>
              <Button asChild>
                <Link href="/thumbnails">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Custom Thumbnails
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="my" className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <p className="text-sm text-muted-foreground">
              {filteredMyTemplates.length} templates
            </p>
          </div>

          {myLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : filteredMyTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMyTemplates.map((template) => (
                <Card 
                  key={template.id} 
                  className="overflow-hidden"
                  data-testid={`my-template-${template.id}`}
                >
                  <div className="aspect-video bg-muted relative">
                    {template.previewUrl ? (
                      <img
                        src={template.previewUrl}
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <LayoutTemplate className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-medium truncate">{template.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {template.category || "General"}
                        </p>
                      </div>
                      <Badge variant={template.isPublic ? "default" : "secondary"}>
                        {template.isPublic ? (
                          <>
                            <Globe className="h-3 w-3 mr-1" />
                            Public
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3 mr-1" />
                            Private
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.promptTemplate}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openEditDialog(template)}
                        data-testid={`button-edit-${template.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleCopyPrompt(template.promptTemplate || "")}
                        data-testid={`button-copy-my-${template.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => duplicateMutation.mutate(template)}
                        disabled={duplicateMutation.isPending}
                        data-testid={`button-duplicate-${template.id}`}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteMutation.mutate(template.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${template.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <LayoutTemplate className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first template or save one from the library
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

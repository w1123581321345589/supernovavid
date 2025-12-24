import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, X } from "lucide-react";

interface Variant {
  id: string;
  imageUrl: string;
}

interface CreateTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTest?: (data: { videoUrl: string; duration: string; variants: Variant[] }) => void;
}

export function CreateTestDialog({ open, onOpenChange, onCreateTest }: CreateTestDialogProps) {
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState("7");
  const [variants, setVariants] = useState<Variant[]>([
    { id: "1", imageUrl: "" },
    { id: "2", imageUrl: "" },
  ]);

  const handleAddVariant = () => {
    if (variants.length < 5) {
      setVariants([...variants, { id: String(Date.now()), imageUrl: "" }]);
    }
  };

  const handleRemoveVariant = (id: string) => {
    if (variants.length > 2) {
      setVariants(variants.filter((v) => v.id !== id));
    }
  };

  const handleSubmit = () => {
    console.log("Creating test:", { videoUrl, duration, variants });
    onCreateTest?.({ videoUrl, duration, variants });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create A/B Test</DialogTitle>
          <DialogDescription>
            Set up a new thumbnail test for your YouTube video. Add 2-5 variants to compare.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="video-url">YouTube Video URL</Label>
            <Input
              id="video-url"
              placeholder="https://youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              data-testid="input-video-url"
            />
          </div>

          <div className="space-y-2">
            <Label>Test Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger data-testid="select-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Thumbnail Variants</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddVariant}
                disabled={variants.length >= 5}
                data-testid="button-add-variant"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Variant
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {variants.map((variant, index) => (
                <Card
                  key={variant.id}
                  className="relative aspect-video flex items-center justify-center border-2 border-dashed cursor-pointer hover-elevate"
                  data-testid={`variant-slot-${index}`}
                >
                  {variant.imageUrl ? (
                    <img
                      src={variant.imageUrl}
                      alt={`Variant ${index + 1}`}
                      className="w-full h-full object-cover rounded-md"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <Plus className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Variant {String.fromCharCode(65 + index)}
                      </span>
                    </div>
                  )}
                  {variants.length > 2 && (
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveVariant(variant.id);
                      }}
                      data-testid={`button-remove-variant-${index}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </Card>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click on a slot to add a thumbnail from your library
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-test">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!videoUrl} data-testid="button-start-test">
            Start A/B Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

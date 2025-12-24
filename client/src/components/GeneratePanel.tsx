import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Sparkles, Wand2, Image, Loader2 } from "lucide-react";

interface GeneratePanelProps {
  onGenerate?: (prompt: string, count: number, style: string) => void;
}

export function GeneratePanel({ onGenerate }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState("");
  const [variationCount, setVariationCount] = useState([10]);
  const [style, setStyle] = useState("bold");
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    console.log("Generating with:", { prompt, count: variationCount[0], style });
    onGenerate?.(prompt, variationCount[0], style);
    setTimeout(() => setIsGenerating(false), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedImage(url);
      console.log("Image uploaded:", file.name);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Generate Thumbnails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Upload Reference Image</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors hover-elevate cursor-pointer ${uploadedImage ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
            onClick={() => document.getElementById("image-upload")?.click()}
            data-testid="upload-zone"
          >
            {uploadedImage ? (
              <div className="relative aspect-video max-w-xs mx-auto">
                <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover rounded-lg" />
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop your image here or click to upload
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG up to 10MB
                </p>
              </>
            )}
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              data-testid="input-image-upload"
            />
          </div>
        </div>

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
          <Label>Style Preset</Label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger data-testid="select-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bold">Bold & Attention-Grabbing</SelectItem>
              <SelectItem value="minimal">Clean & Minimal</SelectItem>
              <SelectItem value="dramatic">Dramatic & Cinematic</SelectItem>
              <SelectItem value="colorful">Bright & Colorful</SelectItem>
              <SelectItem value="professional">Professional & Sleek</SelectItem>
            </SelectContent>
          </Select>
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
            max={50}
            step={1}
            className="w-full"
            data-testid="slider-variations"
          />
          <p className="text-xs text-muted-foreground">
            Powered by Gemini Nano Banana
          </p>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={handleGenerate}
          disabled={isGenerating || (!prompt && !uploadedImage)}
          data-testid="button-generate"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate {variationCount[0]} Variations
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

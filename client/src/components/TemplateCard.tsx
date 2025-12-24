import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface TemplateCardProps {
  id: string;
  imageUrl: string;
  name: string;
  category: string;
  popularity?: number;
  onUse?: () => void;
}

export function TemplateCard({
  id,
  imageUrl,
  name,
  category,
  popularity,
  onUse,
}: TemplateCardProps) {
  return (
    <Card
      className="group overflow-visible hover-elevate cursor-pointer"
      data-testid={`template-card-${id}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-t-lg">
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button onClick={onUse} data-testid={`button-use-template-${id}`}>
            <Sparkles className="h-4 w-4 mr-2" />
            Use Template
          </Button>
        </div>
        {popularity && popularity > 80 && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-orange-500 text-white">Trending</Badge>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{name}</h3>
        <p className="text-xs text-muted-foreground mt-1">{category}</p>
      </div>
    </Card>
  );
}

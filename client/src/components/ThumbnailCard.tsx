import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Play, Pause, Trophy, BarChart2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ThumbnailCardProps {
  id: string;
  imageUrl: string;
  title: string;
  ctr?: number;
  views?: number;
  status: "testing" | "winner" | "archived" | "draft";
  onClick?: () => void;
}

export function ThumbnailCard({
  id,
  imageUrl,
  title,
  ctr,
  views,
  status,
  onClick,
}: ThumbnailCardProps) {
  const getStatusBadge = () => {
    switch (status) {
      case "testing":
        return <Badge variant="secondary" className="gap-1"><Play className="h-3 w-3" />Testing</Badge>;
      case "winner":
        return <Badge className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"><Trophy className="h-3 w-3" />Winner</Badge>;
      case "archived":
        return <Badge variant="outline">Archived</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <Card
      className="group overflow-visible hover-elevate cursor-pointer"
      onClick={onClick}
      data-testid={`thumbnail-card-${id}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-t-lg">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
            {ctr !== undefined && (
              <div className="flex items-center gap-1 text-white text-sm font-medium">
                <BarChart2 className="h-4 w-4" />
                {ctr.toFixed(1)}% CTR
              </div>
            )}
            {views !== undefined && (
              <div className="text-white/80 text-sm">
                {views.toLocaleString()} views
              </div>
            )}
          </div>
        </div>
        <div className="absolute top-2 right-2">
          {getStatusBadge()}
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-sm truncate">{title}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" data-testid={`button-thumbnail-menu-${id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem data-testid={`menu-edit-${id}`}>Edit</DropdownMenuItem>
              <DropdownMenuItem data-testid={`menu-duplicate-${id}`}>Duplicate</DropdownMenuItem>
              <DropdownMenuItem data-testid={`menu-start-test-${id}`}>
                {status === "testing" ? "Stop Test" : "Start A/B Test"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" data-testid={`menu-delete-${id}`}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

import { StatsCard } from "../StatsCard";
import { Image, BarChart3, PlayCircle, Zap } from "lucide-react";

export default function StatsCardExample() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        title="Total Thumbnails"
        value={247}
        trend={12}
        icon={<Image className="h-5 w-5" />}
      />
      <StatsCard
        title="Avg CTR"
        value="8.4%"
        trend={3.2}
        icon={<BarChart3 className="h-5 w-5" />}
      />
      <StatsCard
        title="Tests Running"
        value={5}
        icon={<PlayCircle className="h-5 w-5" />}
      />
      <StatsCard
        title="Credits"
        value={1250}
        trend={-5}
        icon={<Zap className="h-5 w-5" />}
      />
    </div>
  );
}

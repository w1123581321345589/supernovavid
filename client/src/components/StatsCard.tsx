import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon: React.ReactNode;
}

export function StatsCard({ title, value, trend, icon }: StatsCardProps) {
  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (trend === undefined) return "";
    if (trend > 0) return "text-green-500";
    if (trend < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <Card data-testid={`stats-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{title}</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-3xl font-bold">{value}</span>
              {trend !== undefined && (
                <div className={`flex items-center gap-1 text-sm ${getTrendColor()}`}>
                  {getTrendIcon()}
                  <span>{Math.abs(trend)}%</span>
                </div>
              )}
            </div>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

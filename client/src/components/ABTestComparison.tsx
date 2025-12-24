import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy, Clock, TrendingUp, Eye, Timer, Info } from "lucide-react";

interface Variant {
  id: string;
  imageUrl: string;
  viewVelocity?: number;
  views?: number;
  exposureHours?: number;
  ctr?: number;
  impressions?: number;
  clicks?: number;
}

interface ABTestComparisonProps {
  testId: string;
  videoTitle: string;
  variantA: Variant;
  variantB: Variant;
  confidence: number;
  daysRemaining?: number;
  onDeclareWinner?: (variantId: string) => void;
  onExtendTest?: () => void;
}

export function ABTestComparison({
  testId,
  videoTitle,
  variantA,
  variantB,
  confidence,
  daysRemaining,
  onDeclareWinner,
  onExtendTest,
}: ABTestComparisonProps) {
  const useVelocityMetrics = variantA.viewVelocity !== undefined && variantB.viewVelocity !== undefined;
  
  const getPerformanceValue = (v: Variant) => useVelocityMetrics ? (v.viewVelocity || 0) : (v.ctr || 0);
  const winner = getPerformanceValue(variantA) > getPerformanceValue(variantB) ? "A" : 
                 getPerformanceValue(variantB) > getPerformanceValue(variantA) ? "B" : null;
  const maxValue = Math.max(getPerformanceValue(variantA), getPerformanceValue(variantB), 1);

  const renderVariant = (variant: Variant, label: string, isWinner: boolean) => {
    const performanceValue = getPerformanceValue(variant);
    
    return (
      <div className="flex-1 relative">
        {isWinner && confidence >= 95 && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <Badge className="gap-1 bg-green-500 text-white">
              <Trophy className="h-3 w-3" />
              Leader
            </Badge>
          </div>
        )}
        <div className={`relative aspect-video rounded-lg overflow-hidden border-2 ${isWinner && confidence >= 95 ? "border-green-500" : "border-transparent"}`}>
          <img src={variant.imageUrl} alt={`Variant ${label}`} className="w-full h-full object-cover" />
          <div className="absolute top-2 left-2">
            <Badge variant="secondary">Variant {label}</Badge>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                  <TrendingUp className="h-4 w-4" /> {useVelocityMetrics ? "View Velocity" : "Performance"}
                  <Info className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  {useVelocityMetrics 
                    ? "Views per hour while this thumbnail was active. Higher is better."
                    : "Performance score based on available metrics."}
                </p>
              </TooltipContent>
            </Tooltip>
            <span className="text-2xl font-bold">
              {useVelocityMetrics ? `${performanceValue.toFixed(1)}/hr` : `${performanceValue.toFixed(2)}%`}
            </span>
          </div>
          <Progress value={(performanceValue / maxValue) * 100} className="h-2" />
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                <Eye className="h-3 w-3" /> {useVelocityMetrics ? "Total Views" : "Impressions"}
              </div>
              <div className="font-semibold">
                {useVelocityMetrics 
                  ? (variant.views ?? 0).toLocaleString()
                  : (variant.impressions ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                <Timer className="h-3 w-3" /> {useVelocityMetrics ? "Exposure" : "Clicks"}
              </div>
              <div className="font-semibold">
                {useVelocityMetrics 
                  ? `${(variant.exposureHours ?? 0).toFixed(1)}h`
                  : (variant.clicks ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card data-testid={`ab-test-${testId}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg">{videoTitle}</CardTitle>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {daysRemaining ? `${daysRemaining} days left` : "Complete"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Confidence: <span className={confidence >= 95 ? "text-green-500 font-medium" : ""}>{confidence}%</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {confidence >= 95 && (
              <Button
                onClick={() => onDeclareWinner?.(winner === "A" ? variantA.id : variantB.id)}
                data-testid={`button-declare-winner-${testId}`}
              >
                <Trophy className="h-4 w-4 mr-2" />
                Declare Winner
              </Button>
            )}
            <Button variant="outline" onClick={onExtendTest} data-testid={`button-extend-test-${testId}`}>
              Extend Test
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6">
          {renderVariant(variantA, "A", winner === "A")}
          <div className="w-px bg-border" />
          {renderVariant(variantB, "B", winner === "B")}
        </div>
      </CardContent>
    </Card>
  );
}

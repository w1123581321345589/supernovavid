import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { TrendingUp, TrendingDown, Eye, MousePointer, Target, Trophy } from "lucide-react";
import type { AbTest, TestVariant } from "@shared/schema";

interface TestWithVariants extends AbTest {
  variants?: TestVariant[];
}

interface AnalyticsData {
  tests: TestWithVariants[];
  totalImpressions: number;
  totalClicks: number;
  overallCtr: number;
  testsRun: number;
}

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30");

  const { data: tests, isLoading } = useQuery<TestWithVariants[]>({
    queryKey: ["/api/tests"],
  });

  const analyticsData: AnalyticsData | null = tests ? {
    tests,
    totalImpressions: tests.reduce((acc, t) => 
      acc + (t.variants?.reduce((sum, v) => sum + (v.impressions || 0), 0) || 0), 0),
    totalClicks: tests.reduce((acc, t) => 
      acc + (t.variants?.reduce((sum, v) => sum + (v.clicks || 0), 0) || 0), 0),
    overallCtr: 0,
    testsRun: tests.filter(t => t.status === "completed" || t.status === "running").length,
  } : null;

  if (analyticsData) {
    analyticsData.overallCtr = analyticsData.totalImpressions > 0 
      ? (analyticsData.totalClicks / analyticsData.totalImpressions) * 100 
      : 0;
  }

  const chartData = tests?.filter(t => t.startedAt).map(test => {
    const totalImp = test.variants?.reduce((s, v) => s + (v.impressions || 0), 0) || 0;
    const totalClicks = test.variants?.reduce((s, v) => s + (v.clicks || 0), 0) || 0;
    return {
      date: new Date(test.startedAt || test.createdAt || "").toLocaleDateString(),
      ctr: totalImp > 0 ? (totalClicks / totalImp) * 100 : 0,
      impressions: totalImp,
      clicks: totalClicks,
      testName: test.name,
    };
  }).slice(-parseInt(timeRange)) || [];

  const topPerformers = tests?.flatMap(test =>
    test.variants?.map(v => ({
      ...v,
      testName: test.name,
    })) || []
  ).sort((a, b) => (b.ctr || 0) - (a.ctr || 0)).slice(0, 5) || [];

  const ctrByTest = tests?.map(test => {
    const totalImp = test.variants?.reduce((s, v) => s + (v.impressions || 0), 0) || 0;
    const totalClicks = test.variants?.reduce((s, v) => s + (v.clicks || 0), 0) || 0;
    return {
      name: test.name.length > 15 ? test.name.slice(0, 15) + "..." : test.name,
      ctr: totalImp > 0 ? (totalClicks / totalImp) * 100 : 0,
      impressions: totalImp,
    };
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track your thumbnail performance over time
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40" data-testid="select-time-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-impressions">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Total Impressions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-impressions">
              {analyticsData?.totalImpressions.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-clicks">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <MousePointer className="h-4 w-4" />
              Total Clicks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-clicks">
              {analyticsData?.totalClicks.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-ctr">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Average CTR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold" data-testid="text-avg-ctr">
                {analyticsData?.overallCtr.toFixed(2) || "0.00"}%
              </span>
              {(analyticsData?.overallCtr || 0) > 5 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-tests">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Tests Run
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-tests-run">
              {analyticsData?.testsRun || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-ctr-chart">
          <CardHeader>
            <CardTitle>CTR Over Time</CardTitle>
            <CardDescription>Click-through rate trends</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ctr" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-test-comparison">
          <CardHeader>
            <CardTitle>CTR by Test</CardTitle>
            <CardDescription>Compare performance across tests</CardDescription>
          </CardHeader>
          <CardContent>
            {ctrByTest.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ctrByTest} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)}%`, "CTR"]}
                  />
                  <Bar dataKey="ctr" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No tests available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-top-performers">
        <CardHeader>
          <CardTitle>Top Performers</CardTitle>
          <CardDescription>Your best performing variants</CardDescription>
        </CardHeader>
        <CardContent>
          {topPerformers.length > 0 ? (
            <div className="space-y-4">
              {topPerformers.map((variant, idx) => (
                <div 
                  key={variant.id} 
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50"
                  data-testid={`top-performer-${idx}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-medium">{variant.name || `Variant`}</p>
                      <p className="text-sm text-muted-foreground">{variant.testName}</p>
                      {variant.title && (
                        <p className="text-xs text-muted-foreground mt-1">Title: {variant.title}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="font-mono">
                      {(variant.ctr || 0).toFixed(2)}% CTR
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {variant.impressions?.toLocaleString() || 0} impressions
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No test variants yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

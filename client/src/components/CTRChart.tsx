import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DataPoint {
  date: string;
  variantA: number;
  variantB: number;
}

interface CTRChartProps {
  data: DataPoint[];
  title?: string;
}

export function CTRChart({ data, title = "CTR Over Time" }: CTRChartProps) {
  return (
    <Card data-testid="ctr-chart">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="variantA"
                name="Variant A"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="variantB"
                name="Variant B"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--chart-3))", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useSWR from "swr";
import { motion } from "framer-motion";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function DeploymentActivityChart() {
  const { data, isLoading } = useSWR("/api/analytics", fetcher);
  
  // Use empty array if API doesn't have real chart data yet
  const chartData = data?.chartData || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card className="col-span-full lg:col-span-4 bg-card/50 backdrop-blur shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle>Deployment Activity</CardTitle>
          <CardDescription>Daily deployment frequency across all projects.</CardDescription>
        </div>
        <Select defaultValue="7d">
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] mt-4 w-full">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-md">
              No deployment data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDeployments" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area 
                  type="monotone" 
                  dataKey="deployments" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorDeployments)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
    </motion.div>
  );
}

"use client";

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Analytics({ projectId }: { projectId: string }) {
  // Generate stable mock data for the project
  const data = useMemo(() => {
    const arr = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Use project ID to seed some variation so it doesn't look identical for every project
      const seed = projectId.charCodeAt(0) + projectId.charCodeAt(1);
      
      // Some random looking but stable data
      const pseudoRandom1 = Math.abs(Math.cos(i + seed));
      const pseudoRandom2 = Math.abs(Math.sin(i * 2 + seed));
      
      const visitors = Math.floor(100 + Math.sin(i * 0.5 + seed) * 50 + pseudoRandom1 * 20);
      const pageviews = Math.floor(visitors * (1.5 + pseudoRandom2));
      
      arr.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        visitors,
        pageviews,
      });
    }
    return arr;
  }, [projectId]);

  const totalVisitors = data.reduce((acc, curr) => acc + curr.visitors, 0);
  const totalPageviews = data.reduce((acc, curr) => acc + curr.pageviews, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Visitors (30d)</CardDescription>
            <CardTitle className="text-3xl">{totalVisitors.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground flex items-center">
              <span className="text-emerald-500 font-medium mr-1">+12.5%</span> from previous 30 days
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Pageviews (30d)</CardDescription>
            <CardTitle className="text-3xl">{totalPageviews.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground flex items-center">
              <span className="text-emerald-500 font-medium mr-1">+8.2%</span> from previous 30 days
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Traffic</CardTitle>
          <CardDescription>Daily unique visitors and pageviews.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `${value}`} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '6px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="visitors" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 6 }} 
                  name="Visitors"
                />
                <Line 
                  type="monotone" 
                  dataKey="pageviews" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  dot={false} 
                  name="Pageviews"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Box, CheckCircle2, XCircle, Globe, Key, Activity as ActivityIcon, User, Trash, Loader2 } from "lucide-react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const IconMap: Record<string, any> = {
  Box, CheckCircle2, XCircle, Globe, Key, Activity: ActivityIcon, User, Trash, GitBranch
};

export default function ActivityPage() {
  const { data, isLoading } = useSWR("/api/activity", fetcher);
  const activities = data?.activities || [];

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Activity</h2>
        <p className="text-muted-foreground">Audit log of all events across your workspace.</p>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Showing activity for the last 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
               <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ActivityIcon className="h-8 w-8 mb-4 opacity-30" />
              <p>No activity yet.</p>
            </div>
          ) : (
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {activities.map((activity: any) => {
                const IconComponent = IconMap[activity.icon] || ActivityIcon;
                
                return (
                  <div key={activity._id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm ${activity.color?.replace('text-', 'bg-').replace('-500', '-500/10') || 'bg-muted'}`}>
                      <IconComponent className={`h-4 w-4 ${activity.color || 'text-foreground'}`} />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border/50 bg-card/50 shadow-sm transition-all hover:shadow-md hover:border-border">
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-foreground">{activity.title}</div>
                        <time className="text-xs font-medium text-muted-foreground">{formatDistanceToNow(new Date(activity.createdAt))} ago</time>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activity.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Box, CheckCircle2, XCircle, Globe, Key } from "lucide-react";

export default function ActivityPage() {
  const activities = [
    {
      id: 1,
      type: "deployment_success",
      title: "Deployment successful",
      description: "Portfolio was successfully deployed to Production.",
      time: "2 minutes ago",
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10"
    },
    {
      id: 2,
      type: "project_created",
      title: "Project created",
      description: "You created the project 'Portfolio'.",
      time: "2 hours ago",
      icon: Box,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    {
      id: 3,
      type: "env_var_added",
      title: "Environment Variable added",
      description: "You added DATABASE_URL to Portfolio.",
      time: "2 hours ago",
      icon: Key,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    {
      id: 4,
      type: "github_connected",
      title: "GitHub connected",
      description: "You connected your GitHub account to DeployX.",
      time: "1 day ago",
      icon: GitBranch,
      color: "text-foreground",
      bgColor: "bg-muted"
    },
  ];

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
          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {activities.map((activity, index) => (
              <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                {/* Icon */}
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm ${activity.bgColor}`}>
                  <activity.icon className={`h-4 w-4 ${activity.color}`} />
                </div>
                {/* Card */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border/50 bg-card/50 shadow-sm transition-all hover:shadow-md hover:border-border">
                  <div className="flex items-center justify-between space-x-2 mb-1">
                    <div className="font-bold text-foreground">{activity.title}</div>
                    <time className="text-xs font-medium text-muted-foreground">{activity.time}</time>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {activity.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

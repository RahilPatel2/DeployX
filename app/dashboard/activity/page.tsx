"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch,
  Box,
  CheckCircle2,
  XCircle,
  Globe,
  Key,
  Activity as ActivityIcon,
  User,
  Trash,
  Settings,
  GitCommit,
  Zap,
  RefreshCw,
  FolderKanban,
  Loader2,
} from "lucide-react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PopulatedProject {
  _id: string;
  name: string;
  slug: string;
  repository: string;
  branch: string;
  framework: string;
  productionUrl?: string;
}

interface ActivityRecord {
  _id: string;
  userId: string;
  projectId?: PopulatedProject | string;
  type: string;
  title: string;
  description: string;
  icon?: string;
  color?: string;
  createdAt: string;
}

interface ActivityApiResponse {
  activities: ActivityRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const IconMap: Record<string, LucideIcon> = {
  Box,
  CheckCircle2,
  XCircle,
  Globe,
  Key,
  Activity: ActivityIcon,
  User,
  Trash,
  GitBranch,
  Settings,
  GitCommit,
  Zap,
};

export default function ActivityPage() {
  const [category, setCategory] = useState<string>("all");
  const [page, setPage] = useState<number>(1);

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", "20");
  if (category !== "all") queryParams.set("category", category);

  const url = `/api/activity?${queryParams.toString()}`;
  const { data, isLoading, mutate } = useSWR<ActivityApiResponse>(url, fetcher, {
    keepPreviousData: true,
  });

  const activities = data?.activities || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const categories = [
    { id: "all", label: "All Activity" },
    { id: "projects", label: "Projects" },
    { id: "deployments", label: "Deployments" },
    { id: "webhooks", label: "Webhooks" },
    { id: "auth", label: "Integrations" },
  ];

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Activity Feed</h2>
          <p className="text-muted-foreground mt-1">
            Real-time audit log of deployments, configuration changes, and integration events.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutate()}
          disabled={isLoading}
          className="h-9 self-start md:self-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} /> Refresh Feed
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={category === cat.id ? "default" : "outline"}
            size="sm"
            className="h-8 rounded-full text-xs shrink-0"
            onClick={() => {
              setCategory(cat.id);
              setPage(1);
            }}
          >
            {cat.label}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
          {total} {total === 1 ? "event" : "events"} recorded
        </span>
      </div>

      {/* Main Activity Timeline Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Workspace Timeline</CardTitle>
          <CardDescription>
            Audit events sorted chronologically by execution time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-3 opacity-60" />
              <p className="text-sm">Loading activity feed...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ActivityIcon className="h-10 w-10 mb-3 opacity-30" />
              <h4 className="font-semibold text-foreground text-sm">No activity recorded</h4>
              <p className="text-xs text-muted-foreground max-w-sm text-center mt-1">
                {category !== "all"
                  ? `No events found for category '${category}'. Try switching back to 'All Activity'.`
                  : "Events such as creating projects, pushing code, or triggering deployments will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/60 before:to-transparent">
              {activities.map((activity) => {
                const IconComponent = (activity.icon && IconMap[activity.icon]) || ActivityIcon;
                const projectObj =
                  activity.projectId && typeof activity.projectId === "object"
                    ? (activity.projectId as PopulatedProject)
                    : null;

                return (
                  <div key={activity._id} className="relative flex items-start gap-4 group">
                    {/* Event Icon Node */}
                    <div
                      className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border border-border/60 bg-card shadow-sm shrink-0`}
                    >
                      <IconComponent
                        className={`h-4 w-4 ${activity.color || "text-foreground"}`}
                      />
                    </div>

                    {/* Event Card Content */}
                    <div className="flex-1 p-4 rounded-xl border border-border/50 bg-card/60 shadow-xs hover:border-border transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">
                            {activity.title}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-mono font-normal">
                            {activity.type}
                          </Badge>
                        </div>
                        <time className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(activity.createdAt))} ago
                        </time>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {activity.description}
                      </p>

                      {/* Associated Project Link Pill */}
                      {projectObj && (
                        <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center gap-2">
                          <Link
                            href={`/dashboard/projects/${projectObj._id}`}
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                          >
                            <FolderKanban className="h-3 w-3" />
                            {projectObj.name}
                          </Link>
                          <span className="text-muted-foreground text-xs font-mono">
                            ({projectObj.repository})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({total} events)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

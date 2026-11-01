"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Loader2,
  CheckCheck,
  Trash2,
  ExternalLink,
  Filter,
  Check,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  category?: "deployment" | "security" | "system" | "project";
  read: boolean;
  link?: string;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
}

type CategoryTab = "all" | "deployment" | "security" | "project" | "system";

export default function NotificationsPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryTab>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const queryParams = new URLSearchParams();
  if (selectedCategory !== "all") queryParams.set("category", selectedCategory);
  if (unreadOnly) queryParams.set("unread", "true");
  queryParams.set("limit", "50");

  const endpoint = `/api/notifications?${queryParams.toString()}`;

  const { data, isLoading, error, mutate } = useSWR<NotificationsResponse>(endpoint, {
    revalidateOnFocus: false,
    dedupingInterval: 15000,
  });

  const [markingAll, setMarkingAll] = useState(false);
  const [clearingRead, setClearingRead] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      // Optimistic update
      mutate(
        (prev) =>
          prev
            ? {
                ...prev,
                unreadCount: 0,
                notifications: prev.notifications.map((n) => ({ ...n, read: true })),
              }
            : prev,
        false
      );

      const res = await fetch("/api/notifications", { method: "PUT" });
      if (!res.ok) throw new Error("Failed to mark notifications read");
      toast.success("All notifications marked as read");
      await mutate();
    } catch {
      toast.error("Failed to update notifications");
      await mutate();
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClearRead = async () => {
    setClearingRead(true);
    try {
      const res = await fetch("/api/notifications?clearRead=true", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear read notifications");
      toast.success("All read notifications cleared");
      await mutate();
    } catch {
      toast.error("Failed to clear notifications");
    } finally {
      setClearingRead(false);
    }
  };

  const handleToggleRead = async (notification: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActingId(notification._id);
    const targetState = !notification.read;

    try {
      mutate(
        (prev) =>
          prev
            ? {
                ...prev,
                unreadCount: targetState ? prev.unreadCount + 1 : Math.max(0, prev.unreadCount - 1),
                notifications: prev.notifications.map((n) =>
                  n._id === notification._id ? { ...n, read: targetState } : n
                ),
              }
            : prev,
        false
      );

      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification._id, read: targetState }),
      });
      if (!res.ok) throw new Error("Failed to update notification");
      await mutate();
    } catch {
      toast.error("Failed to update status");
      await mutate();
    } finally {
      setActingId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActingId(id);
    try {
      mutate(
        (prev) =>
          prev
            ? {
                ...prev,
                notifications: prev.notifications.filter((n) => n._id !== id),
                total: Math.max(0, prev.total - 1),
              }
            : prev,
        false
      );

      const res = await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete notification");
      toast.success("Notification removed");
      await mutate();
    } catch {
      toast.error("Failed to delete notification");
      await mutate();
    } finally {
      setActingId(null);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
      default:
        return <Info className="h-5 w-5 text-blue-500 shrink-0" />;
    }
  };

  const categories: { label: string; value: CategoryTab }[] = [
    { label: "All", value: "all" },
    { label: "Deployments", value: "deployment" },
    { label: "Security", value: "security" },
    { label: "Projects", value: "project" },
    { label: "System", value: "system" },
  ];

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-8 pt-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Stay informed on live build logs, deployments, and account security notices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {notifications.some((n) => n.read) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearRead}
              disabled={clearingRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {clearingRead ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
              Clear Read
            </Button>
          )}

          {unreadCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="text-xs"
            >
              {markingAll ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-1.5 h-3.5 w-3.5" />}
              Mark all read ({unreadCount})
            </Button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(cat.value)}
              className="text-xs h-8 px-3 rounded-md"
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Unread Toggle */}
        <Button
          variant={unreadOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnreadOnly((prev) => !prev)}
          className="text-xs h-8 self-start sm:self-auto"
        >
          <Filter className="h-3 w-3 mr-1.5" />
          {unreadOnly ? "Showing Unread" : "Filter Unread"}
        </Button>
      </div>

      {/* Notifications List Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="py-4 px-6 border-b border-border/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Inbox</CardTitle>
            <span className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                : "All notifications read"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && !data ? (
            <div className="divide-y divide-border/40">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-5 flex gap-4">
                  <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-1" />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-sm font-semibold text-foreground">Unable to load notifications</p>
              <p className="text-xs text-muted-foreground mt-1">Please check your connection and try again.</p>
              <Button variant="outline" size="sm" onClick={() => mutate()} className="mt-3 text-xs">
                Retry
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-semibold text-sm text-foreground">No notifications found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {unreadOnly
                  ? "You have no unread notifications in this category."
                  : "Build status updates and account security events will appear here."}
              </p>
              {unreadOnly && (
                <Button variant="link" size="sm" onClick={() => setUnreadOnly(false)} className="mt-2 text-xs">
                  View all notifications
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {notifications.map((n) => (
                <div
                  key={n._id}
                  className={`p-4 sm:p-5 flex items-start gap-3.5 transition-colors group hover:bg-muted/30 ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                    <div className="mt-0.5">{getIcon(n.type)}</div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p
                            className={`text-sm truncate ${
                              !n.read ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                            }`}
                          >
                            {n.title}
                          </p>
                          {n.category && (
                            <Badge
                              variant="outline"
                              className="text-[10px] capitalize font-mono py-0 px-1.5 h-4 text-muted-foreground border-border/60"
                            >
                              {n.category}
                            </Badge>
                          )}
                          {!n.read && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    {/* Quick Row Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={(e) => handleToggleRead(n, e)}
                        disabled={actingId === n._id}
                        title={n.read ? "Mark as unread" : "Mark as read"}
                      >
                        <Check className={`h-3.5 w-3.5 ${n.read ? "opacity-40" : "text-primary"}`} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(n._id, e)}
                        disabled={actingId === n._id}
                        title="Delete notification"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>

                      {n.link && (
                        <Link href={n.link} className="text-muted-foreground/60 hover:text-foreground p-1">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

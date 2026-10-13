"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, AlertTriangle, Info, XCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { data, isLoading, mutate } = useSWR<{ notifications: NotificationItem[]; total: number }>("/api/notifications", fetcher);
  const [markingRead, setMarkingRead] = useState(false);

  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setMarkingRead(true);
    try {
      const res = await fetch("/api/notifications", { method: "PUT" });
      if (!res.ok) throw new Error("Failed to mark notifications as read");
      toast.success("All notifications marked as read");
      mutate();
    } catch {
      toast.error("Failed to update notifications");
    } finally {
      setMarkingRead(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "warning": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "error": return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground mt-1">Stay updated on your deployments and account.</p>
        </div>
        {notifications.length > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead} disabled={markingRead || unreadCount === 0}>
            {markingRead ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Mark all as read
          </Button>
        )}
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.` : "All caught up. No unread notifications."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium text-sm">No notifications yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Activity alerts and build updates will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map((notification) => (
                <div 
                  key={notification._id} 
                  className={`p-6 flex gap-4 transition-colors hover:bg-muted/30 ${!notification.read ? 'bg-primary/5' : ''}`}
                >
                  <div className="shrink-0 mt-1">
                    {getIcon(notification.type)}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${!notification.read ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                        {notification.title}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt))} ago
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
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

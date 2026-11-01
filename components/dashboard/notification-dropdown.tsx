"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  CheckCheck,
  ExternalLink,
  Loader2,
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

export function NotificationDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const { data, mutate } = useSWR<NotificationsResponse>(
    "/api/notifications?limit=8",
    {
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    }
  );

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount ?? notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleNotificationClick = async (notification: NotificationItem) => {
    setOpen(false);

    if (!notification.read) {
      try {
        // Optimistic local update
        mutate(
          (prev) =>
            prev
              ? {
                  ...prev,
                  unreadCount: Math.max(0, prev.unreadCount - 1),
                  notifications: prev.notifications.map((n) =>
                    n._id === notification._id ? { ...n, read: true } : n
                  ),
                }
              : prev,
          false
        );

        fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notification._id, read: true }),
        }).catch(() => {});
      } catch {}
    }

    if (notification.link) {
      router.push(notification.link);
    } else {
      router.push("/dashboard/notifications");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
      default:
        return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
        aria-label="Open notifications menu"
      />}>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary ring-2 ring-background" />
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-80 sm:w-96 p-0 shadow-2xl border-border/60 bg-popover/95 backdrop-blur-md"
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">Notifications</span>
            {unreadCount > 0 ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {unreadCount} unread
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">All caught up</span>
            )}
          </div>

          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              {markingAll ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground px-4">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
              <p className="text-xs font-medium text-foreground">No notifications yet</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Build status and deployment alerts will appear here.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                onClick={() => handleNotificationClick(n)}
                className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors hover:bg-muted/40 ${
                  !n.read ? "bg-primary/5" : ""
                }`}
              >
                <div className="mt-0.5">{getIcon(n.type)}</div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={`text-xs truncate ${
                        !n.read ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                      }`}
                    >
                      {n.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: false })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                </div>
                {!n.read && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-border/40 bg-muted/20">
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded transition-colors"
          >
            <span>View all notifications</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

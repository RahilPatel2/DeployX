import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertCircle, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export type DeploymentStatusType =
  | "QUEUED"
  | "BUILDING"
  | "READY"
  | "FAILED"
  | "CANCELED"
  | "active"
  | "inactive"
  | string;

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: DeploymentStatusType;
  showIcon?: boolean;
  size?: "sm" | "default";
}

export function StatusBadge({
  status,
  showIcon = true,
  size = "default",
  className,
  ...props
}: StatusBadgeProps) {
  const normalized = (status || "QUEUED").toUpperCase();

  switch (normalized) {
    case "READY":
    case "ACTIVE":
      return (
        <Badge
          variant="ready"
          role="status"
          aria-label={`Status: ${normalized}`}
          className={cn(size === "sm" ? "text-[11px] h-4.5 px-1.5" : "text-xs h-5 px-2", className)}
          {...props}
        >
          {showIcon && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
          <span>Ready</span>
        </Badge>
      );

    case "BUILDING":
      return (
        <Badge
          variant="building"
          role="status"
          aria-label="Status: Building"
          className={cn(size === "sm" ? "text-[11px] h-4.5 px-1.5" : "text-xs h-5 px-2", className)}
          {...props}
        >
          {showIcon && (
            <span className="relative flex h-2 w-2 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
          )}
          <span>Building</span>
        </Badge>
      );

    case "QUEUED":
    case "PENDING":
      return (
        <Badge
          variant="queued"
          role="status"
          aria-label="Status: Queued"
          className={cn(size === "sm" ? "text-[11px] h-4.5 px-1.5" : "text-xs h-5 px-2", className)}
          {...props}
        >
          {showIcon && <Clock className="h-3 w-3 text-blue-400" />}
          <span>Queued</span>
        </Badge>
      );

    case "FAILED":
    case "ERROR":
      return (
        <Badge
          variant="destructive"
          role="status"
          aria-label="Status: Failed"
          className={cn(size === "sm" ? "text-[11px] h-4.5 px-1.5" : "text-xs h-5 px-2", className)}
          {...props}
        >
          {showIcon && <XCircle className="h-3 w-3 text-destructive" />}
          <span>Failed</span>
        </Badge>
      );

    case "CANCELED":
    case "CANCELLED":
      return (
        <Badge
          variant="canceled"
          role="status"
          aria-label="Status: Canceled"
          className={cn(size === "sm" ? "text-[11px] h-4.5 px-1.5" : "text-xs h-5 px-2", className)}
          {...props}
        >
          {showIcon && <Ban className="h-3 w-3 text-zinc-400" />}
          <span>Canceled</span>
        </Badge>
      );

    default:
      return (
        <Badge
          variant="outline"
          role="status"
          aria-label={`Status: ${status}`}
          className={cn(size === "sm" ? "text-[11px] h-4.5 px-1.5" : "text-xs h-5 px-2", className)}
          {...props}
        >
          {showIcon && <AlertCircle className="h-3 w-3 text-muted-foreground" />}
          <span>{status}</span>
        </Badge>
      );
  }
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Copy, Check, Search, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function LogViewer({
  deploymentId,
  status = "READY",
}: {
  deploymentId: string;
  status?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isBuilding = ["QUEUED", "BUILDING"].includes(status);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  // During active builds, poll with a windowed tail to conserve bandwidth and CPU
  const logsUrl = `/api/deployments/${deploymentId}/logs${isBuilding ? "?tail=400" : ""}`;

  const { data } = useSWR(
    logsUrl,
    fetcher,
    { refreshInterval: isBuilding ? 3000 : 0 }
  );

  const rawLogs: string[] = data?.logs || [];

  const filteredLogs = searchTerm.trim()
    ? rawLogs
        .map((line, index) => ({ line, originalIndex: index }))
        .filter((item) =>
          item.line.toLowerCase().includes(searchTerm.toLowerCase().trim())
        )
    : rawLogs.map((line, index) => ({ line, originalIndex: index }));

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [rawLogs, autoScroll]);

  const copyAllLogs = async () => {
    if (rawLogs.length === 0) {
      toast.info("No logs to copy");
      return;
    }
    try {
      let logsToCopy = rawLogs;
      if (data?.isTailed) {
        const fullRes = await fetch(`/api/deployments/${deploymentId}/logs`);
        if (fullRes.ok) {
          const fullData = await fullRes.json();
          if (Array.isArray(fullData.logs)) {
            logsToCopy = fullData.logs;
          }
        }
      }
      await navigator.clipboard.writeText(logsToCopy.join("\n"));
      setCopied(true);
      toast.success("Logs copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy logs");
    }
  };

  return (
    <div
      className="rounded-lg border border-border/60 bg-[#0c0d0e] overflow-hidden flex flex-col h-[560px] shadow-lg transition-all"
      role="region"
      aria-label="Deployment build log console"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border/50 bg-[#121316] gap-2">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1.5" aria-hidden="true">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 border border-red-500/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 border border-yellow-500/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 border border-green-500/20" />
          </div>
          <span className="text-xs font-mono font-medium text-foreground/80 flex items-center gap-1.5">
            terminal:build-output
          </span>
          <span className="text-[11px] font-mono text-muted-foreground hidden md:inline">
            ({rawLogs.length} line{rawLogs.length === 1 ? "" : "s"})
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-36 sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 pl-8 pr-2 text-xs font-mono bg-background/50 border-border/50 focus-visible:ring-1"
              aria-label="Search build logs"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAutoScroll((prev) => !prev)}
            className={`h-7 px-2 text-xs font-mono transition-colors ${
              autoScroll
                ? "text-primary bg-primary/10 hover:bg-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll paused"}
            aria-pressed={autoScroll}
          >
            <ArrowDown
              className={`h-3.5 w-3.5 mr-1 ${
                autoScroll ? "translate-y-0.5" : "opacity-50"
              }`}
            />
            <span className="hidden sm:inline">Scroll</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyAllLogs}
            className="h-7 px-2 text-xs font-mono text-muted-foreground hover:text-foreground"
            title="Copy all logs"
            aria-label="Copy all build logs to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Terminal lines */}
      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Build log output text"
        className="flex-1 p-3 sm:p-4 font-mono text-xs sm:text-[13px] leading-relaxed overflow-y-auto outline-none focus-visible:ring-1 focus-visible:ring-primary/40 scrollbar-thin scrollbar-thumb-muted-foreground/20"
      >
        {rawLogs.length === 0 ? (
          <div className="text-muted-foreground text-center pt-16 flex flex-col items-center justify-center gap-2">
            {isBuilding ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Waiting for build worker execution...</span>
              </>
            ) : (
              <span>No logs recorded for this deployment.</span>
            )}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-muted-foreground text-center pt-12">
            No lines match query &quot;{searchTerm}&quot;
          </div>
        ) : (
          filteredLogs.map(({ line, originalIndex }) => (
            <div
              key={originalIndex}
              className="flex hover:bg-white/[0.04] px-1.5 py-0.5 rounded-sm transition-colors group"
            >
              <span className="text-muted-foreground/40 group-hover:text-muted-foreground/80 mr-3 select-none shrink-0 w-8 text-right font-mono text-[11px] pt-0.5">
                {originalIndex + 1}
              </span>
              <span
                className={`whitespace-pre-wrap break-all ${
                  line?.includes("✓") || line?.toLowerCase().includes("success")
                    ? "text-emerald-400"
                    : line?.includes("→") || line?.includes("info")
                    ? "text-blue-400"
                    : line?.includes("warn")
                    ? "text-amber-400"
                    : line?.toLowerCase().includes("error") ||
                      line?.toLowerCase().includes("failed")
                    ? "text-rose-400 font-medium"
                    : "text-zinc-300"
                }`}
              >
                {line}
              </span>
            </div>
          ))
        )}

        {isBuilding && (
          <div className="flex items-center text-blue-400 mt-4 px-2 py-1 bg-blue-500/10 rounded border border-blue-500/20 w-fit text-xs">
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            <span>Building deployment artifacts in worker pipeline...</span>
          </div>
        )}
      </div>
    </div>
  );
}

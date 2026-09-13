"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, Copy, Search, Maximize2, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function LogViewer({ deploymentId, status = "READY" }: { deploymentId: string, status?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isBuilding = ['QUEUED', 'BUILDING'].includes(status);

  const { data } = useSWR(
    `/api/deployments/${deploymentId}/logs`, 
    fetcher, 
    { refreshInterval: isBuilding ? 3000 : 0 }
  );

  const logs: string[] = data?.logs || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-md border border-border/50 bg-[#0c0c0c] overflow-hidden flex flex-col h-[600px] shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-[#111111]">
        <div className="flex items-center space-x-4">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80 border border-red-500/20" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 border border-yellow-500/20" />
            <div className="w-3 h-3 rounded-full bg-green-500/80 border border-green-500/20" />
          </div>
          <span className="text-xs font-mono text-muted-foreground hidden sm:inline-block">Build Output</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hidden sm:flex">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      
      <div ref={scrollRef} className="flex-1 p-4 font-mono text-[13px] leading-relaxed overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-muted-foreground text-center pt-8">
            {isBuilding ? 'Waiting for logs...' : 'No logs available.'}
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex hover:bg-white/[0.02] px-2 py-0.5 rounded-sm transition-colors">
              <span className="text-muted-foreground mr-4 select-none shrink-0 opacity-50 w-6 text-right">
                {i + 1}
              </span>
              <span className={`whitespace-pre-wrap ${
                log?.includes('✓') ? 'text-emerald-400' : 
                log?.includes('→') ? 'text-blue-400' : 
                log?.includes('error') ? 'text-red-400' : 'text-gray-300'
              }`}>
                {log}
              </span>
            </div>
          ))
        )}
        
        {isBuilding && (
          <div className="flex items-center text-blue-400 mt-4 px-2">
            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
            <span>Executing...</span>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { getDeploymentLogsAndStatus } from "@/app/dashboard/deployments/[id]/actions";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface LogEntry {
  created_at: string;
  level: string;
  message: string;
}

export function LogViewer({ deploymentId }: { deploymentId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<string>("QUEUED");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const fetchLogs = async () => {
      try {
        const data = await getDeploymentLogsAndStatus(deploymentId);
        setLogs(data.logs);
        setStatus(data.status);

        // Auto scroll to bottom
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }

        // If not terminal state, poll again in 2 seconds
        if (!["READY", "FAILED", "CANCELLED"].includes(data.status)) {
          timeoutId = setTimeout(fetchLogs, 2000);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to fetch logs", e);
        setLoading(false);
      }
    };

    fetchLogs();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [deploymentId]);

  return (
    <div className="rounded-md border bg-black overflow-hidden flex flex-col h-[500px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs font-mono text-gray-400 ml-2">Build Output</span>
        </div>
        <div className="text-xs font-mono">
          <span className={status === "READY" ? "text-green-500" : status === "FAILED" ? "text-red-500" : "text-blue-400"}>
            {status}
          </span>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 p-4 font-mono text-sm overflow-y-auto"
      >
        {logs.map((log, i) => (
          <div key={i} className="mb-1 flex">
            <span className="text-gray-500 mr-4 select-none shrink-0">
              {format(new Date(log.created_at), "HH:mm:ss.SSS")}
            </span>
            <span className={log.level === "error" ? "text-red-400" : "text-gray-300 whitespace-pre-wrap"}>
              {log.message}
            </span>
          </div>
        ))}
        
        {loading && (
          <div className="flex items-center text-blue-400 mt-2">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            <span>Waiting for logs...</span>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, Copy, Search, Maximize2, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";

const MOCK_LOGS = [
  "09:41:02  → Initializing deployment",
  "09:41:03  → Connecting to repository RahilPatel2/portfolio",
  "09:41:05  ✓ Repository cloned successfully",
  "09:41:08  → Installing dependencies using npm...",
  "09:41:12  │ added 342 packages, and audited 343 packages in 4s",
  "09:41:12  │ 106 packages are looking for funding",
  "09:41:13  │ found 0 vulnerabilities",
  "09:41:18  ✓ Dependencies installed",
  "09:41:19  → Running build command 'npm run build'",
  "09:41:20  │ > portfolio@0.1.0 build",
  "09:41:20  │ > next build",
  "09:41:22  │   ▲ Next.js 14.2.3",
  "09:41:22  │   - Environments: .env.production",
  "09:41:24  │   Creating an optimized production build ...",
  "09:41:29  │   Compiled successfully",
  "09:41:30  │   Route (app)                              Size     First Load JS",
  "09:41:30  │   ┌ ○ /                                    142 B          84.3 kB",
  "09:41:30  │   ├ ○ /about                               142 B          84.3 kB",
  "09:41:30  │   └ ○ /contact                             142 B          84.3 kB",
  "09:41:34  ✓ Build completed",
  "09:41:36  → Uploading assets to edge network...",
  "09:41:39  ✓ Deployment ready and propagated globally"
];

export function LogViewer({ deploymentId, status = "READY" }: { deploymentId: string, status?: string }) {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < MOCK_LOGS.length) {
        setLogs(prev => [...prev, MOCK_LOGS[index]]);
        index++;
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      } else {
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

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
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hidden sm:flex">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      
      <div ref={scrollRef} className="flex-1 p-4 font-mono text-[13px] leading-relaxed overflow-y-auto">
        {logs.map((log, i) => (
          <div key={i} className="flex hover:bg-white/[0.02] px-2 py-0.5 rounded-sm transition-colors">
            <span className="text-muted-foreground mr-4 select-none shrink-0 opacity-50 w-6 text-right">
              {i + 1}
            </span>
            <span className={`whitespace-pre-wrap ${
              log.includes('✓') ? 'text-emerald-400' : 
              log.includes('→') ? 'text-blue-400' : 
              log.includes('error') ? 'text-red-400' : 'text-gray-300'
            }`}>
              {log}
            </span>
          </div>
        ))}
        
        {logs.length < MOCK_LOGS.length && (
          <div className="flex items-center text-blue-400 mt-2 px-2">
            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
            <span>Executing...</span>
          </div>
        )}
      </div>
    </div>
  );
}

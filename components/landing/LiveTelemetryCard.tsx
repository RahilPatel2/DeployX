"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Globe, HardDrive, Wifi } from "lucide-react";
import { useSafeReducedMotion } from "./motion-utils";

interface RegionMetric {
  city: string;
  code: string;
  latencyMs: number;
  status: "optimal" | "good";
}

const REGIONS: RegionMetric[] = [
  { city: "Ashburn (US-East)", code: "IAD", latencyMs: 18, status: "optimal" },
  { city: "Frankfurt (EU-Central)", code: "FRA", latencyMs: 24, status: "optimal" },
  { city: "Tokyo (AP-Northeast)", code: "NRT", latencyMs: 44, status: "optimal" },
  { city: "London (EU-West)", code: "LHR", latencyMs: 22, status: "optimal" },
  { city: "Singapore (AP-Southeast)", code: "SIN", latencyMs: 38, status: "optimal" },
  { city: "São Paulo (SA-East)", code: "GRU", latencyMs: 58, status: "good" },
];

export function LiveTelemetryCard() {
  const reducedMotion = useSafeReducedMotion();
  const [latencyTicks, setLatencyTicks] = React.useState<number>(38);

  React.useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      // Gentle realistic edge latency flutter between 36ms and 41ms
      const delta = (Math.random() - 0.5) * 4;
      setLatencyTicks(Math.round(38 + delta));
    }, 2000);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  return (
    <div className="py-1 sm:py-2 space-y-3 sm:space-y-5">
      {/* Top 3 High-Level KPIs: 3-Col on all screens with compact mobile sizing */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        <div className="p-2 sm:p-3.5 rounded-xl border border-border/50 bg-card/60 backdrop-blur-md">
          <div className="flex items-center justify-between text-muted-foreground mb-0.5 sm:mb-1">
            <span className="text-[10px] sm:text-xs font-medium truncate">Avg TTFB</span>
            <Wifi className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-base sm:text-2xl font-bold font-mono text-foreground flex items-baseline gap-0.5 sm:gap-1">
            <span>{latencyTicks}</span>
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">ms</span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 sm:mt-1 truncate">
            <span className="h-1 sm:h-1.5 w-1 sm:w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">SLA Met</span>
          </div>
        </div>

        <div className="p-2 sm:p-3.5 rounded-xl border border-border/50 bg-card/60 backdrop-blur-md">
          <div className="flex items-center justify-between text-muted-foreground mb-0.5 sm:mb-1">
            <span className="text-[10px] sm:text-xs font-medium truncate">Cache Ratio</span>
            <HardDrive className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400 shrink-0" />
          </div>
          <div className="text-base sm:text-2xl font-bold font-mono text-foreground flex items-baseline gap-0.5 sm:gap-1">
            <span>98.6</span>
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">%</span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-blue-400 mt-0.5 sm:mt-1 truncate">
            Smart Routing
          </div>
        </div>

        <div className="p-2 sm:p-3.5 rounded-xl border border-border/50 bg-card/60 backdrop-blur-md">
          <div className="flex items-center justify-between text-muted-foreground mb-0.5 sm:mb-1">
            <span className="text-[10px] sm:text-xs font-medium truncate">Edge PoPs</span>
            <Globe className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400 shrink-0" />
          </div>
          <div className="text-base sm:text-2xl font-bold font-mono text-foreground flex items-baseline gap-0.5 sm:gap-1">
            <span>275+</span>
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground hidden xs:inline">cities</span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-purple-400 mt-0.5 sm:mt-1 truncate">
            100+ nations
          </div>
        </div>
      </div>

      {/* Regional Edge Latency Breakdown Table */}
      <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-md p-2.5 sm:p-4">
        <div className="flex items-center justify-between mb-2 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Edge PoP Region</span>
          <span>Response Time</span>
        </div>

        <div className="space-y-1.5 sm:space-y-2.5">
          {REGIONS.slice(0, 4).map((region) => (
            <div key={region.code} className="space-y-0.5 sm:space-y-1">
              <div className="flex items-center justify-between text-[11px] sm:text-xs">
                <span className="text-foreground font-medium flex items-center gap-1.5 sm:gap-2 truncate">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate">{region.city}</span>
                  <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground">({region.code})</span>
                </span>
                <span className="font-mono text-[11px] sm:text-xs font-semibold text-foreground shrink-0 ml-2">
                  {region.latencyMs} ms
                </span>
              </div>
              {/* Animated Progress Bar */}
              <div className="h-1 sm:h-1.5 w-full bg-muted/70 rounded-full overflow-hidden">
                <motion.div
                  initial={reducedMotion ? { width: `${(region.latencyMs / 70) * 100}%` } : { width: 0 }}
                  animate={{ width: `${(region.latencyMs / 70) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    region.latencyMs < 30
                      ? "bg-emerald-400"
                      : region.latencyMs < 50
                      ? "bg-blue-400"
                      : "bg-amber-400"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

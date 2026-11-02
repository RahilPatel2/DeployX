"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Network, Activity, RotateCw } from "lucide-react";
import { useSafeReducedMotion, SPRINGS } from "./motion-utils";
import { TerminalSimulation } from "./TerminalSimulation";
import { ArchitectureFlow } from "./ArchitectureFlow";
import { LiveTelemetryCard } from "./LiveTelemetryCard";

export type PreviewTab = "terminal" | "architecture" | "telemetry";

interface TabItem {
  id: PreviewTab;
  label: string;
  labelShort: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
}

const TABS: TabItem[] = [
  { id: "terminal", label: "Build & Deploy Logs", labelShort: "Logs", icon: Terminal, tag: "Live" },
  { id: "architecture", label: "Architecture Flow", labelShort: "Pipeline", icon: Network, tag: "Pipeline" },
  { id: "telemetry", label: "Edge Telemetry", labelShort: "Telemetry", icon: Activity, tag: "275+ PoPs" },
];

export function LiveProductPreview() {
  const [activeTab, setActiveTab] = React.useState<PreviewTab>("terminal");
  const [cycleKey, setCycleKey] = React.useState(0);
  const reducedMotion = useSafeReducedMotion();

  const handleRestart = () => {
    setCycleKey((prev) => prev + 1);
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto mt-4 sm:mt-8 mb-6 sm:mb-16">
      {/* Ambient background glow behind the preview window */}
      <div 
        aria-hidden="true" 
        className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-2xl opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none" 
      />

      {/* Main Glassmorphic Window Container */}
      <div className="relative rounded-2xl border border-border/70 bg-card/90 backdrop-blur-2xl shadow-2xl overflow-hidden transition-all duration-300">
        
        {/* Window Title Bar & Navigation Controls */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-2.5 sm:px-4 py-2 sm:py-3 gap-2">
          
          {/* macOS Traffic Lights + Window Title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-rose-500/80 inline-block shadow-sm" />
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-amber-500/80 inline-block shadow-sm" />
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-500/80 inline-block shadow-sm" />
            </div>
            <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />
            <span className="text-[11px] sm:text-xs font-mono font-medium text-muted-foreground hidden xs:flex items-center gap-1.5">
              deployx-project
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ACTIVE
              </span>
            </span>
          </div>

          {/* Interactive Tab Switcher */}
          <div 
            role="tablist" 
            aria-label="DeployX product preview modes" 
            className="flex items-center bg-background/60 p-0.5 sm:p-1 rounded-xl border border-border/50 backdrop-blur-md"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors cursor-pointer select-none ${
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="preview-active-pill"
                      transition={SPRINGS.snappy}
                      className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/30 shadow-sm"
                    />
                  )}
                  <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 relative z-10" />
                  <span className="relative z-10 hidden sm:inline">{tab.label}</span>
                  <span className="relative z-10 sm:hidden">{tab.labelShort}</span>
                  {tab.tag && (
                    <span 
                      className={`relative z-10 text-[9px] px-1.5 py-0.2 rounded font-mono hidden md:inline ${
                        isActive 
                          ? "bg-primary text-primary-foreground font-bold" 
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tab.tag}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action restart button */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={handleRestart}
              title="Restart simulation"
              className="p-1 sm:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <RotateCw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Panel Display Area */}
        <div className="min-h-[220px] sm:min-h-[420px] bg-background/50 relative p-3 sm:p-6 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === "terminal" && (
              <motion.div
                key={`terminal-${cycleKey}`}
                id="tabpanel-terminal"
                role="tabpanel"
                aria-labelledby="tab-terminal"
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="w-full h-full"
              >
                <TerminalSimulation key={cycleKey} onRestart={handleRestart} />
              </motion.div>
            )}

            {activeTab === "architecture" && (
              <motion.div
                key={`arch-${cycleKey}`}
                id="tabpanel-architecture"
                role="tabpanel"
                aria-labelledby="tab-architecture"
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="w-full h-full"
              >
                <ArchitectureFlow />
              </motion.div>
            )}

            {activeTab === "telemetry" && (
              <motion.div
                key={`telemetry-${cycleKey}`}
                id="tabpanel-telemetry"
                role="tabpanel"
                aria-labelledby="tab-telemetry"
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="w-full h-full"
              >
                <LiveTelemetryCard />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

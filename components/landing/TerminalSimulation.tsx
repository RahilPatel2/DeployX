"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, Check, Play, Pause, RotateCw, ExternalLink } from "lucide-react";
import { useSafeReducedMotion } from "./motion-utils";

interface LogStep {
  id: number;
  text: string;
  type: "info" | "success" | "warn" | "accent";
  delayMs: number;
}

const STEPS: LogStep[] = [
  { id: 1, text: "git checkout commit 7405332 (branch: main)", type: "info", delayMs: 400 },
  { id: 2, text: "Verifying HMAC webhook signature: Valid ✓", type: "accent", delayMs: 700 },
  { id: 3, text: "Framework auto-detected: Next.js 16 (App Router + React Server Components)", type: "info", delayMs: 1100 },
  { id: 4, text: "Spinning isolated ephemeral sandbox container (cgroup v2, read-only root)", type: "accent", delayMs: 1600 },
  { id: 5, text: "Running: pnpm install --frozen-lockfile (reused 128 cached packages)", type: "info", delayMs: 2200 },
  { id: 6, text: "Compiling production bundle: next build", type: "info", delayMs: 2900 },
  { id: 7, text: "Generated 73 optimized static routes (0 linting or type errors)", type: "success", delayMs: 3600 },
  { id: 8, text: "Sanitizing secret keys & masking sensitive credentials", type: "accent", delayMs: 4200 },
  { id: 9, text: "Dispatching static assets to Cloudflare Pages edge network (275+ PoPs)", type: "info", delayMs: 4800 },
  { id: 10, text: "Global propagation complete in 1.4s. SSL Certificate provisioned.", type: "success", delayMs: 5400 },
];

export function TerminalSimulation({ onRestart }: { onRestart?: () => void }) {
  const reducedMotion = useSafeReducedMotion();
  const [visibleCount, setVisibleCount] = React.useState<number>(reducedMotion ? STEPS.length : 1);
  const [isPaused, setIsPaused] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (reducedMotion || isPaused || visibleCount >= STEPS.length) return;

    const timer = setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 1, STEPS.length));
    }, 550);

    return () => clearTimeout(timer);
  }, [visibleCount, isPaused, reducedMotion]);

  const handleCopy = () => {
    navigator.clipboard.writeText("https://preview-deployx-app.pages.dev");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isComplete = visibleCount >= STEPS.length;

  return (
    <div className="font-mono text-[11px] sm:text-xs text-foreground space-y-2 sm:space-y-3">
      {/* Terminal Toolbar */}
      <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-border/40 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span
            className={`h-2 sm:h-2.5 w-2 sm:w-2.5 rounded-full ${
              isComplete ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            {isComplete ? "Deploy Complete" : "Building..."}
          </span>
          <span className="text-[9px] sm:text-[11px] px-1 sm:px-1.5 py-0.2 rounded bg-muted/80 text-muted-foreground border border-border/50">
            {visibleCount}/{STEPS.length}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1 px-1.5 sm:px-2 text-[10px] sm:text-[11px] rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 border border-border/40 cursor-pointer"
            title={isPaused ? "Resume simulation" : "Pause simulation"}
          >
            {isPaused ? <Play className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : <Pause className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
            <span className="hidden xs:inline">{isPaused ? "Resume" : "Pause"}</span>
          </button>
          {onRestart && (
            <button
              onClick={() => {
                setVisibleCount(1);
                onRestart();
              }}
              className="p-1 px-1.5 sm:px-2 text-[10px] sm:text-[11px] rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 border border-border/40 cursor-pointer"
              title="Restart"
            >
              <RotateCw className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="hidden xs:inline">Replay</span>
            </button>
          )}
        </div>
      </div>

      {/* Terminal Body */}
      <div className="space-y-1.5 sm:space-y-2 py-1.5 sm:py-2 min-h-[140px] sm:min-h-[260px] max-h-[190px] sm:max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
        {STEPS.slice(0, visibleCount).map((step, idx) => (
          <motion.div
            key={step.id}
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-2.5 leading-relaxed"
          >
            <span className="text-muted-foreground/50 select-none text-xs w-5 text-right font-mono">
              {idx + 1}
            </span>
            <span className="text-primary font-bold select-none">›</span>
            <div className="flex-1 break-all">
              {step.type === "accent" ? (
                <span className="text-blue-400 font-medium">{step.text}</span>
              ) : step.type === "success" ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 inline" />
                  {step.text}
                </span>
              ) : step.type === "warn" ? (
                <span className="text-amber-400">{step.text}</span>
              ) : (
                <span className="text-foreground/90">{step.text}</span>
              )}
            </div>
          </motion.div>
        ))}

        {!isComplete && (
          <div className="flex items-center gap-2 text-muted-foreground pl-7 pt-1 animate-pulse">
            <span className="h-3.5 w-1.5 bg-primary rounded-xs inline-block" />
            <span className="text-xs">Processing build worker job...</span>
          </div>
        )}
      </div>

      {/* Completion Banner with Live URL */}
      {isComplete && (
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="mt-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-300">Live URL Ready</div>
              <a
                href="https://preview-deployx-app.pages.dev"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-emerald-400/90 underline hover:text-emerald-200 transition-colors flex items-center gap-1"
              >
                https://preview-deployx-app.pages.dev
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg text-xs font-sans font-medium bg-background/80 hover:bg-background border border-border/60 text-foreground transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Copy URL</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

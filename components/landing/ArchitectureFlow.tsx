"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { GitBranch, Shield, Globe, ArrowRight, Zap } from "lucide-react";
import { useSafeReducedMotion, SPRINGS } from "./motion-utils";

interface PipelineNode {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  details: string[];
}

const NODES: PipelineNode[] = [
  {
    title: "GitHub Repo",
    subtitle: "HMAC Signed Push",
    icon: GitBranch,
    color: "from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30",
    details: ["Webhook Verification", "SHA-256 Digest", "Branch Targeting"],
  },
  {
    title: "DeployX Runner",
    subtitle: "Isolated Sandbox",
    icon: Shield,
    color: "from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30",
    details: ["Secret Masking", "SSRF Safeguards", "Parallel Builds"],
  },
  {
    title: "Cloudflare Edge",
    subtitle: "275+ PoPs Worldwide",
    icon: Globe,
    color: "from-orange-500/20 to-amber-500/20 text-orange-400 border-orange-500/30",
    details: ["Anycast Routing", "Sub-50ms TTFB", "Zero Cold Starts"],
  },
];

export function ArchitectureFlow() {
  const reducedMotion = useSafeReducedMotion();
  const [hoveredNode, setHoveredNode] = React.useState<number | null>(null);

  return (
    <div className="py-2 sm:py-4 px-1 sm:px-2 space-y-3 sm:space-y-6">
      {/* Overview subtitle */}
      <div className="text-center max-w-xl mx-auto mb-3 sm:mb-6">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider">
          End-to-End Zero-Trust Deployment Pipeline
        </h3>
        <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
          Every commit triggers a verified, hardened pipeline with instant global delivery.
        </p>
      </div>

      {/* Responsive Pipeline Nodes Container: Horizontal Snap on Mobile, 3-Col on Desktop */}
      <div className="flex overflow-x-auto snap-x snap-mandatory pb-2 gap-3 no-scrollbar md:grid md:grid-cols-3 md:gap-4 md:overflow-visible">
        {NODES.map((node, index) => {
          const Icon = node.icon;
          const isHovered = hoveredNode === index;

          return (
            <div key={node.title} className="w-[80vw] max-w-[280px] shrink-0 snap-center md:w-auto md:max-w-none">
              <motion.div
                onHoverStart={() => setHoveredNode(index)}
                onHoverEnd={() => setHoveredNode(null)}
                whileHover={reducedMotion ? {} : { y: -4, scale: 1.02 }}
                transition={SPRINGS.snappy}
                className={`relative rounded-xl border bg-card/60 backdrop-blur-xl p-3 sm:p-4 transition-all duration-300 shadow-sm cursor-default select-none h-full flex flex-col justify-between ${
                  isHovered ? "border-primary shadow-md bg-card/90" : "border-border/60"
                }`}
              >
                {/* Connecting animated arrow for desktop */}
                {index < NODES.length - 1 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-background border border-border items-center justify-center text-muted-foreground shadow-sm">
                    <ArrowRight className="h-3 w-3" />
                  </div>
                )}

                <div>
                  {/* Node Card Header */}
                  <div className="flex items-center gap-2.5 sm:gap-3 mb-2 sm:mb-3">
                    <div
                      className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-gradient-to-br border flex items-center justify-center ${node.color}`}
                    >
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-foreground">{node.title}</h4>
                      <p className="text-[10px] sm:text-[11px] font-mono text-muted-foreground">{node.subtitle}</p>
                    </div>
                  </div>

                  {/* Node Feature Bullets */}
                  <ul className="space-y-1 sm:space-y-1.5 pt-1.5 sm:pt-2 border-t border-border/40">
                    {node.details.map((detail) => (
                      <li key={detail} className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Active Pulse Status */}
                <div className="mt-2.5 sm:mt-3 pt-1.5 sm:pt-2 border-t border-border/30 flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground">
                  <span className="font-mono text-[9px] sm:text-[10px]">STAGE 0{index + 1}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Synced
                  </span>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Network Traffic Simulation Pill */}
      <div className="mt-2 sm:mt-4 p-2 sm:p-3 rounded-xl bg-muted/40 border border-border/50 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-muted-foreground">Edge Latency:</span>
          <span className="font-mono font-bold text-foreground">38ms avg</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 font-mono text-[10px] sm:text-[11px] text-muted-foreground">
          <span>TLS 1.3</span>
          <span>•</span>
          <span>HTTP/3 QUIC</span>
          <span>•</span>
          <span>Brotli 11</span>
        </div>
      </div>
    </div>
  );
}

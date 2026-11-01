"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useSafeReducedMotion } from "./motion-utils";

interface Framework {
  name: string;
  tagline: string;
  color: string;
  badge: string;
}

const FRAMEWORKS: Framework[] = [
  { name: "Next.js 16", tagline: "App Router & SSR", color: "from-white/10 to-zinc-500/10", badge: "Native" },
  { name: "Vite 6", tagline: "Lightning Fast Bundling", color: "from-purple-500/10 to-indigo-500/10", badge: "Fast" },
  { name: "React 19", tagline: "Modern Client & Server", color: "from-cyan-500/10 to-blue-500/10", badge: "Standard" },
  { name: "Astro 4", tagline: "Content-Driven Islands", color: "from-orange-500/10 to-amber-500/10", badge: "Zero-JS" },
  { name: "Remix", tagline: "Web Standards & Loaders", color: "from-red-500/10 to-rose-500/10", badge: "Edge" },
  { name: "SvelteKit", tagline: "Compiler-Based UI", color: "from-rose-500/10 to-orange-500/10", badge: "Minimal" },
  { name: "Nuxt 3", tagline: "The Intuitive Vue Framework", color: "from-emerald-500/10 to-teal-500/10", badge: "Fullstack" },
  { name: "Bun", tagline: "All-in-One JavaScript", color: "from-amber-500/10 to-yellow-500/10", badge: "Blazing" },
];

export function FrameworkMarquee() {
  const reducedMotion = useSafeReducedMotion();

  return (
    <div className="py-16 relative overflow-hidden border-y border-border/40 bg-muted/10 backdrop-blur-sm">
      {/* Section Sub-header */}
      <div className="text-center mb-8 px-4">
        <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
          Zero-Config Auto-Detection for Modern Frameworks
        </p>
      </div>

      {/* Edge Gradient Fades for Smooth Carousel Fade-out */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 sm:w-36 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 sm:w-36 bg-gradient-to-l from-background to-transparent z-10" />

      {/* Marquee Track */}
      {reducedMotion ? (
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 px-4">
          {FRAMEWORKS.map((fw) => (
            <div
              key={fw.name}
              className="p-3.5 rounded-xl border border-border/60 bg-card/70 flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-bold text-foreground">{fw.name}</div>
                <div className="text-[11px] text-muted-foreground">{fw.tagline}</div>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {fw.badge}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex w-full select-none overflow-hidden group">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              repeat: Infinity,
              duration: 32,
              ease: "linear",
            }}
            className="flex shrink-0 items-center gap-4 py-2 group-hover:[animation-play-state:paused]"
          >
            {/* Duplicated list to create flawless infinite loop */}
            {[...FRAMEWORKS, ...FRAMEWORKS].map((fw, idx) => (
              <div
                key={`${fw.name}-${idx}`}
                className="shrink-0 flex items-center gap-3 px-5 py-3 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md shadow-sm hover:border-primary/40 hover:bg-card hover:scale-105 transition-all duration-300 cursor-default"
              >
                <div className="h-2 w-2 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
                    {fw.name}
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {fw.badge}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">{fw.tagline}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}

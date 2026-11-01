"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Globe, GitBranch, Cpu, Zap, ShieldCheck } from "lucide-react";
import { useSafeReducedMotion, SPRINGS } from "./motion-utils";

/**
 * Floating Interactive Decorative Badges around Hero & Product Preview
 */
export function FloatingBadges() {
  const reducedMotion = useSafeReducedMotion();

  if (reducedMotion) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden max-w-6xl mx-auto hidden lg:block z-20">
      {/* 1. Top-Left Floating Badge: Cloudflare Edge */}
      <motion.div
        animate={{
          y: [-8, 6, -8],
          rotate: [-1, 1.5, -1],
        }}
        transition={{
          duration: 6.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-28 left-4 pointer-events-auto"
      >
        <motion.div
          whileHover={{ scale: 1.08, y: -2 }}
          transition={SPRINGS.snappy}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-border/70 bg-card/80 backdrop-blur-xl shadow-lg cursor-default select-none group"
        >
          <div className="h-7 w-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-foreground">Cloudflare Pages</div>
            <div className="text-[10px] text-muted-foreground">275+ Edge Locations</div>
          </div>
        </motion.div>
      </motion.div>

      {/* 2. Top-Right Floating Badge: HMAC Webhooks */}
      <motion.div
        animate={{
          y: [6, -8, 6],
          rotate: [1, -1.5, 1],
        }}
        transition={{
          duration: 7.2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
        className="absolute top-36 right-4 pointer-events-auto"
      >
        <motion.div
          whileHover={{ scale: 1.08, y: -2 }}
          transition={SPRINGS.snappy}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-border/70 bg-card/80 backdrop-blur-xl shadow-lg cursor-default select-none group"
        >
          <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-foreground">Instant Git Sync</div>
            <div className="text-[10px] text-muted-foreground">HMAC-SHA256 Webhook</div>
          </div>
        </motion.div>
      </motion.div>

      {/* 3. Mid-Right Floating Badge: Sandboxed Builds */}
      <motion.div
        animate={{
          y: [-5, 7, -5],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.2,
        }}
        className="absolute top-[480px] -right-2 pointer-events-auto"
      >
        <motion.div
          whileHover={{ scale: 1.08, y: -2 }}
          transition={SPRINGS.snappy}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-border/70 bg-card/80 backdrop-blur-xl shadow-lg cursor-default select-none group"
        >
          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-foreground">Sandboxed Runner</div>
            <div className="text-[10px] text-muted-foreground">Secret Stripping Active</div>
          </div>
        </motion.div>
      </motion.div>

      {/* 4. Mid-Left Floating Badge: Sub-50ms TTFB */}
      <motion.div
        animate={{
          y: [7, -6, 7],
        }}
        transition={{
          duration: 7.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.8,
        }}
        className="absolute top-[520px] -left-2 pointer-events-auto"
      >
        <motion.div
          whileHover={{ scale: 1.08, y: -2 }}
          transition={SPRINGS.snappy}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-border/70 bg-card/80 backdrop-blur-xl shadow-lg cursor-default select-none group"
        >
          <div className="h-7 w-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-foreground">&lt; 50ms Edge TTFB</div>
            <div className="text-[10px] text-muted-foreground">Global CDN Caching</div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

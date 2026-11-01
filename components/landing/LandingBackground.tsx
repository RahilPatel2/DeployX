"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useSafeReducedMotion } from "./motion-utils";

/**
 * Cinematic Layered Background for DeployX Landing Page
 * Features ambient floating aurora glow orbs, subtle grid mesh, and soft particle accents.
 */
export function LandingBackground() {
  const reducedMotion = useSafeReducedMotion();

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none bg-background z-[-1] select-none">
      {/* 1. Subtle High-Tech Blueprint Grid with Radial Vignette */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#8080800e_1px,transparent_1px),linear-gradient(to_bottom,#8080800e_1px,transparent_1px)] bg-[size:32px_32px]"
        style={{
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 25%, black 20%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 25%, black 20%, transparent 85%)",
        }}
      />

      {/* 2. Top-Center Ambient Glow Cone */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[340px] sm:w-[700px] h-[250px] sm:h-[400px] rounded-full blur-[60px] sm:blur-[130px] opacity-25 dark:opacity-40"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.5) 0%, rgba(16,185,129,0.2) 50%, transparent 80%)",
        }}
      />

      {/* 3. Primary Floating Azure Orb (Hero Left) */}
      {!reducedMotion ? (
        <motion.div
          animate={{
            x: [0, 45, -30, 0],
            y: [0, -35, 25, 0],
            scale: [1, 1.08, 0.95, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-[12%] -left-[8%] w-[320px] sm:w-[600px] h-[320px] sm:h-[600px] rounded-full blur-[60px] sm:blur-[140px] opacity-30 dark:opacity-25"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.45) 0%, rgba(99,102,241,0.2) 60%, transparent 80%)",
            willChange: "transform",
          }}
        />
      ) : (
        <div
          className="absolute -top-[12%] -left-[8%] w-[320px] sm:w-[600px] h-[320px] sm:h-[600px] rounded-full blur-[60px] sm:blur-[140px] opacity-25"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)",
          }}
        />
      )}

      {/* 4. Secondary Floating Emerald Orb (Cloudflare Edge Indicator - Hero Right) */}
      {!reducedMotion ? (
        <motion.div
          animate={{
            x: [0, -50, 40, 0],
            y: [0, 40, -30, 0],
            scale: [1, 0.94, 1.06, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[20%] -right-[10%] w-[300px] sm:w-[550px] h-[300px] sm:h-[550px] rounded-full blur-[60px] sm:blur-[140px] opacity-25 dark:opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(16,185,129,0.35) 0%, rgba(6,182,212,0.15) 60%, transparent 80%)",
            willChange: "transform",
          }}
        />
      ) : (
        <div
          className="absolute top-[20%] -right-[10%] w-[300px] sm:w-[550px] h-[300px] sm:h-[550px] rounded-full blur-[60px] sm:blur-[140px] opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)",
          }}
        />
      )}

      {/* 5. Deep Purple Ambient Base Orb (Lower Sections) */}
      {!reducedMotion && (
        <motion.div
          animate={{
            x: [0, 30, -25, 0],
            y: [0, -25, 35, 0],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[65%] left-[20%] w-[350px] sm:w-[650px] h-[350px] sm:h-[650px] rounded-full blur-[80px] sm:blur-[160px] opacity-20 dark:opacity-15 hidden sm:block"
          style={{
            background: "radial-gradient(circle, rgba(147,51,234,0.3) 0%, rgba(59,130,246,0.1) 60%, transparent 80%)",
            willChange: "transform",
          }}
        />
      )}

      {/* 6. Subtle Micro-Grain Texture Overlay */}
      <div
        className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
        }}
      />
    </div>
  );
}

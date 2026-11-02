"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, type Variants } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, Sparkles, Terminal, Shield, CheckCircle2 } from "lucide-react";
import { EASING, useSafeReducedMotion } from "./motion-utils";

/**
 * Magnetic Button Component that subtly pulls toward the mouse cursor
 */
function MagneticButton({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
}) {
  const ref = React.useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 250, damping: 20 });
  const springY = useSpring(y, { stiffness: 250, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.18);
    y.set((e.clientY - centerY) * 0.18);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div style={{ x: springX, y: springY }} className="w-full sm:w-auto">
      <Link
        ref={ref}
        href={href}
        prefetch={true}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={className}
      >
        {children}
      </Link>
    </motion.div>
  );
}

/**
 * Cinematic Hero Section for DeployX
 * Features staggered headline reveals, animated beacon badge, magnetic buttons, and glowing gradients.
 */
export function HeroSection() {
  const reducedMotion = useSafeReducedMotion();

  // Word-by-word staggered reveal animation
  const headlineWords = [
    { text: "Deploy", highlight: false },
    { text: "web", highlight: false },
    { text: "apps", highlight: false },
    { text: "from", highlight: false },
    { text: "GitHub", highlight: true },
    { text: "directly", highlight: false },
    { text: "to", highlight: false },
    { text: "the", highlight: false },
    { text: "edge.", highlight: true, edgeColor: true },
  ];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.15,
      },
    },
  };

  const wordVariants: Variants = {
    hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.7,
        ease: EASING.smooth,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: EASING.smooth,
      },
    },
  };

  return (
    <section className="relative z-10 w-full pt-4 sm:pt-20 pb-8 sm:pb-16 overflow-hidden">
      <div className="container mx-auto px-2 sm:px-6 flex flex-col items-center text-center">
        <motion.div
          variants={containerVariants}
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
          className="max-w-4xl flex flex-col items-center w-full"
        >
          {/* Animated Pulsing Status Beacon */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.04 }}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-primary/25 bg-primary/5 px-2.5 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-foreground backdrop-blur-md shadow-xs mb-3 sm:mb-6 cursor-default group"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              DeployX Engine v2.0
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-foreground font-semibold flex items-center gap-1">
              Zero Cold Starts <Sparkles className="h-3 w-3 text-amber-400 hidden sm:inline" />
            </span>
          </motion.div>

          {/* Cinematic Headline with Staggered Word Reveals */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-[76px] font-black tracking-tight leading-[1.08] text-foreground mb-3 sm:mb-6 max-w-4xl">
            {headlineWords.map((word, i) => (
              <React.Fragment key={i}>
                <motion.span
                  variants={reducedMotion ? undefined : wordVariants}
                  className={`inline-block ${
                    word.edgeColor
                      ? "bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-sm"
                      : word.highlight
                      ? "text-foreground font-black"
                      : "text-muted-foreground font-bold"
                  }`}
                >
                  {word.text}
                </motion.span>
                {i === 4 ? <br className="hidden sm:inline" /> : " "}
              </React.Fragment>
            ))}
          </h1>

          {/* Subtitle with Fade and Smooth Elevation */}
          <motion.p
            variants={itemVariants}
            className="text-xs sm:text-lg text-muted-foreground max-w-2xl mx-auto tracking-normal leading-relaxed font-normal mb-5 sm:mb-8 line-clamp-3 sm:line-clamp-none px-2"
          >
            Connect your repository, pick your branch, and ship globally in seconds. DeployX delivers automated
            framework detection, sandboxed builds, credential scrubbing, and instant Cloudflare Pages distribution.
          </motion.p>

          {/* CTA Buttons with Magnetic Hover Animation & Gradient Aura */}
          <motion.div
            variants={itemVariants}
            className="flex flex-row items-center justify-center gap-2 sm:gap-3.5 w-full max-w-sm sm:max-w-none sm:w-auto px-2"
          >
            <MagneticButton
              href="/dashboard/projects/new"
              className={buttonVariants({
                size: "lg",
                className:
                  "flex-1 sm:flex-initial sm:w-auto h-10 sm:h-12 px-3 sm:px-7 text-xs sm:text-sm font-semibold rounded-xl shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 relative overflow-hidden group border border-primary/40 flex items-center justify-center",
              })}
            >
              <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                Deploy Project
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/25 via-transparent to-primary/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </MagneticButton>

            <MagneticButton
              href="/dashboard"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className:
                  "flex-1 sm:flex-initial sm:w-auto h-10 sm:h-12 px-3 sm:px-7 text-xs sm:text-sm font-medium rounded-xl border-border/80 bg-card/60 backdrop-blur-md hover:bg-muted/60 transition-all flex items-center justify-center",
              })}
            >
              Dashboard
            </MagneticButton>
          </motion.div>

          {/* Feature Highlights Trust Ticker */}
          <motion.div
            variants={itemVariants}
            className="mt-4 sm:mt-8 flex flex-wrap items-center justify-center gap-y-1 gap-x-3 sm:gap-x-6 text-[10px] sm:text-xs text-muted-foreground/80 font-medium"
          >
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>Free tier</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-blue-500" />
              <span>SOC2 isolated</span>
            </div>
            <div className="flex items-center gap-1">
              <Terminal className="h-3 w-3 text-purple-500" />
              <span>Build streaming</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Terminal, Copy, Check, Sparkles, ShieldCheck } from "lucide-react";
import { FADE_UP, useSafeReducedMotion, SPRINGS } from "./motion-utils";

export function CtaSection() {
  const reducedMotion = useSafeReducedMotion();
  const [copied, setCopied] = React.useState(false);

  const handleCopyCmd = () => {
    navigator.clipboard.writeText("npx deployx-cli init");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-10 sm:py-20 lg:py-28 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        
        {/* Cosmic Ambient Radial Glow behind the CTA Card */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-80 bg-gradient-to-r from-blue-600/30 via-purple-600/30 to-pink-600/30 blur-3xl opacity-70"
        />

        {/* Card Container */}
        <motion.div
          variants={FADE_UP}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="relative rounded-2xl sm:rounded-3xl border border-primary/30 bg-card/80 backdrop-blur-2xl p-5 sm:p-12 lg:p-16 text-center shadow-2xl overflow-hidden"
        >
          {/* Subtle grid texture overlay */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"
          />

          <div className="relative z-10 max-w-2xl mx-auto space-y-4 sm:space-y-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span>Instant Setup • Zero Configuration</span>
            </div>

            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
              Ready to Ship in Under{" "}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                60 Seconds?
              </span>
            </h2>

            <p className="text-xs sm:text-lg text-muted-foreground leading-relaxed px-2">
              Connect your GitHub repository and experience zero-trust isolated builds with instant propagation to 275+ edge locations.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4 w-full">
              <motion.div
                whileHover={reducedMotion ? {} : { scale: 1.04 }}
                whileTap={reducedMotion ? {} : { scale: 0.98 }}
                transition={SPRINGS.snappy}
                className="w-full sm:w-auto"
              >
                <Link
                  href="/signup"
                  prefetch={true}
                  className="w-full sm:w-auto px-6 py-2.5 sm:py-3.5 rounded-xl font-semibold text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-primary/40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Start Deploying Free</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Link>
              </motion.div>

              {/* CLI Quickstart Command */}
              <button
                onClick={handleCopyCmd}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-3 rounded-xl font-mono text-[11px] sm:text-xs bg-muted/60 hover:bg-muted/90 text-foreground border border-border/70 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
                title="Click to copy CLI command"
              >
                <Terminal className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                <span>npx deployx-cli init</span>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400 ml-1" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                )}
              </button>
            </div>

            {/* Guarantee Note */}
            <div className="pt-2 sm:pt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                No credit card required
              </span>
              <span>•</span>
              <span>Free tier forever</span>
              <span>•</span>
              <span>Sub-50ms edge SLA</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

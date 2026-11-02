"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { GitCommit, ShieldCheck, Cpu, Globe2, ArrowRight, Zap, Check } from "lucide-react";
import { containerStagger, FADE_UP, useSafeReducedMotion } from "./motion-utils";

interface PipelineStep {
  number: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  badgeColor: string;
  specs: string[];
}

const STEPS: PipelineStep[] = [
  {
    number: "01",
    title: "Git Webhook Ingestion",
    subtitle: "HMAC-SHA256 Authenticated",
    description: "Every commit pushed to GitHub instantly triggers a cryptographic webhook payload validated against your repo secret.",
    icon: GitCommit,
    tag: "Instant Trigger",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    specs: ["Sub-millisecond webhook receipt", "Custom branch targeting filters", "PR preview deployments"],
  },
  {
    number: "02",
    title: "Isolated Container Build",
    subtitle: "Zero-Trust Security Sandbox",
    description: "Your build executes in an isolated environment with read-only root filesystems, strict SSRF blocks, and scrubbed secrets.",
    icon: ShieldCheck,
    tag: "Hardened Runtime",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    specs: ["cgroups v2 resource capping", "Secret redaction in build logs", "Private subnet egress restriction"],
  },
  {
    number: "03",
    title: "Asset Optimization Engine",
    subtitle: "High-Performance Bundling",
    description: "DeployX analyzes framework outputs, generates immutable hashes, pre-compresses assets with Brotli 11, and optimizes routing tables.",
    icon: Cpu,
    tag: "Next.js & Vite Native",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    specs: ["Incremental cache reuse", "Automatic 404 & redirect maps", "Serverless edge handler packing"],
  },
  {
    number: "04",
    title: "Edge Anycast Propagation",
    subtitle: "275+ Global Edge Nodes",
    description: "Production releases replicate simultaneously across Cloudflare Pages edge locations with automated zero-downtime cutover.",
    icon: Globe2,
    tag: "Sub-50ms TTFB",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    specs: ["Zero cold start penalty", "HTTP/3 and 0-RTT support", "Instant rollback to prior SHA"],
  },
];

/**
 * 3D Tilt Card with dynamic cursor hover effect
 */
function PipelineCard({ step, index }: { step: PipelineStep; index: number }) {
  const reducedMotion = useSafeReducedMotion();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = React.useState(0);
  const [rotateY, setRotateY] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rX = ((y - centerY) / centerY) * -7;
    const rY = ((x - centerX) / centerX) * 7;
    setRotateX(rX);
    setRotateY(rY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const Icon = step.icon;

  return (
    <motion.div
      variants={FADE_UP}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: "preserve-3d",
        transform: reducedMotion ? "none" : `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transition: isHovered ? "none" : "transform 0.4s ease-out",
      }}
      className="relative rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xl p-4 sm:p-7 shadow-sm transition-colors duration-300 hover:border-primary/50 hover:shadow-xl group flex flex-col justify-between h-full"
    >
      {/* Subtle hover gradient illumination */}
      <div
        aria-hidden="true"
        className={`absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
      />

      <div className="relative z-10">
        {/* Top Header: Step Number & Badge */}
        <div className="flex items-center justify-between mb-3 sm:mb-5">
          <span className="font-mono text-2xl sm:text-3xl font-extrabold text-foreground/20 group-hover:text-primary/40 transition-colors">
            {step.number}
          </span>
          <span className={`text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border ${step.badgeColor}`}>
            {step.tag}
          </span>
        </div>

        {/* Icon & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 mb-2 sm:mb-3">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
              {step.title}
            </h3>
            <p className="text-[11px] sm:text-xs font-mono text-muted-foreground">{step.subtitle}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-3 sm:mb-6">
          {step.description}
        </p>

        {/* Specs List */}
        <ul className="space-y-1.5 sm:space-y-2 pt-3 sm:pt-4 border-t border-border/40">
          {step.specs.map((spec) => (
            <li key={spec} className="flex items-center gap-2 text-[11px] sm:text-xs text-foreground/80">
              <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400 shrink-0" />
              <span>{spec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer step status */}
      <div className="relative z-10 pt-3 sm:pt-5 mt-3 sm:mt-4 border-t border-border/30 flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
        <span className="font-mono text-[10px] sm:text-[11px]">PHASE {index + 1}</span>
        <span className="flex items-center gap-1 text-primary text-[10px] sm:text-[11px] font-semibold group-hover:translate-x-1 transition-transform">
          Deep Dive <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </motion.div>
  );
}

export function PipelineSection() {
  return (
    <section id="pipeline" className="py-10 sm:py-24 lg:py-32 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-3 sm:mb-4">
            <Zap className="h-3.5 w-3.5" />
            <span>Autonomous CI/CD Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            From Git Push to Global Edge in{" "}
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Seconds
            </span>
          </h2>
          <p className="mt-2 sm:mt-4 text-xs sm:text-lg text-muted-foreground leading-relaxed px-2">
            Eliminate server management and brittle configurations. DeployX orchestrates every step with automated container sandboxing, secret protection, and Cloudflare Pages propagation.
          </p>
        </div>

        {/* Mobile Swipe Hint */}
        <div className="flex md:hidden items-center justify-between text-[10px] text-muted-foreground px-1 mb-2 font-mono">
          <span>Swipe 4 phases</span>
          <span className="flex items-center gap-1 text-primary">Horizontal Scroll ›</span>
        </div>

        {/* 4-Stage Container: Horizontal Snap-Scroll on Mobile, 2x2 Grid on Desktop */}
        <motion.div
          variants={containerStagger(0.12)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="flex overflow-x-auto snap-x snap-mandatory pb-3 gap-3 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 md:grid md:grid-cols-2 md:gap-6 lg:gap-8 md:overflow-visible"
        >
          {STEPS.map((step, idx) => (
            <div key={step.number} className="w-[85vw] max-w-[320px] shrink-0 snap-center md:w-auto md:max-w-none">
              <PipelineCard step={step} index={idx} />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

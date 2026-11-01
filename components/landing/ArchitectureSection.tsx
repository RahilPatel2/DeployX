"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ShieldAlert, KeyRound, Network, History, Lock, Cpu, Globe, ArrowUpRight } from "lucide-react";
import { containerStagger, FADE_UP, useSafeReducedMotion } from "./motion-utils";

interface BentoCardProps {
  title: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  colSpan?: string;
  gradient: string;
  children?: React.ReactNode;
}

function BentoCard({ title, category, description, icon: Icon, colSpan = "col-span-1", gradient, children }: BentoCardProps) {
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const reducedMotion = useSafeReducedMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      variants={FADE_UP}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative rounded-3xl border border-border/70 bg-card/70 backdrop-blur-xl p-6 sm:p-8 shadow-sm transition-all duration-300 hover:border-primary/50 group overflow-hidden ${colSpan}`}
    >
      {/* Radial Spotlight Glow following mouse cursor */}
      {!reducedMotion && isHovered && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-100"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(59, 130, 246, 0.12), transparent 80%)`,
          }}
        />
      )}

      {/* Decorative gradient corner aura */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-3xl group-hover:opacity-35 transition-opacity`}
      />

      <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              {category}
            </span>
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <Icon className="h-4 w-4" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {description}
          </p>
        </div>

        {children && <div className="pt-2">{children}</div>}
      </div>
    </motion.div>
  );
}

export function ArchitectureSection() {
  return (
    <section id="architecture" className="py-24 sm:py-32 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-4">
            <Lock className="h-3.5 w-3.5" />
            <span>Enterprise Security & Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Engineered for{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Speed & Hardened Security
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Every layer of DeployX is engineered from the ground up to isolate builds, protect secrets, and deliver sub-50ms edge performance worldwide.
          </p>
        </div>

        {/* Bento Grid */}
        <motion.div
          variants={containerStagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Bento 1: Large Span (2 Columns) - Ephemeral Sandboxes */}
          <BentoCard
            colSpan="md:col-span-2"
            category="Runtime Hardening"
            title="Zero-Trust Ephemeral Build Containers"
            description="Build jobs execute in ephemeral sandboxes with read-only root directories, strict SSRF egress filters, and cgroup resource boundaries to guarantee zero cross-tenant contamination."
            icon={Cpu}
            gradient="from-blue-600/30 to-indigo-600/30"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-border/40 font-mono text-xs">
              <div className="p-2 rounded-lg bg-background/60 border border-border/40">
                <span className="text-muted-foreground block text-[10px]">ISOLATION</span>
                <span className="font-semibold text-foreground">cgroup v2</span>
              </div>
              <div className="p-2 rounded-lg bg-background/60 border border-border/40">
                <span className="text-muted-foreground block text-[10px]">EGRESS FILTER</span>
                <span className="font-semibold text-emerald-400">Strict SSRF Guard</span>
              </div>
              <div className="p-2 rounded-lg bg-background/60 border border-border/40 col-span-2 sm:col-span-1">
                <span className="text-muted-foreground block text-[10px]">FILESYSTEM</span>
                <span className="font-semibold text-foreground">Read-Only Overlay</span>
              </div>
            </div>
          </BentoCard>

          {/* Bento 2: 1 Column - Secret Masking */}
          <BentoCard
            category="Credential Defense"
            title="Automated Secret Scrubbing"
            description="Encrypted AES-256-GCM environment variables are dynamically scrubbed from terminal outputs and client-side bundles."
            icon={KeyRound}
            gradient="from-purple-600/30 to-pink-600/30"
          >
            <div className="mt-4 p-2.5 rounded-xl bg-background/60 border border-border/40 font-mono text-xs text-muted-foreground">
              <div className="flex items-center justify-between text-[11px]">
                <span>DATABASE_URL</span>
                <span className="text-emerald-400 font-semibold">[REDACTED]</span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span>CLOUDFLARE_TOKEN</span>
                <span className="text-emerald-400 font-semibold">[REDACTED]</span>
              </div>
            </div>
          </BentoCard>

          {/* Bento 3: 1 Column - MFA & Cryptography */}
          <BentoCard
            category="Identity Protection"
            title="Multi-Factor Auth & TOTP"
            description="Hardened Google Authenticator MFA with SHA-256 backup codes and HMAC-SHA256 signature verification."
            icon={Lock}
            gradient="from-emerald-600/30 to-teal-600/30"
          >
            <div className="flex items-center gap-2 mt-4 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>RFC 6238 Compliant TOTP Engine</span>
            </div>
          </BentoCard>

          {/* Bento 4: Large Span (2 Columns) - Cloudflare Pages Global Edge */}
          <BentoCard
            colSpan="md:col-span-2"
            category="Edge Delivery"
            title="Cloudflare Pages Anycast Mesh Network"
            description="Your web applications are distributed across 275+ edge data centers in 100+ countries. Automatic TLS 1.3 issuance, HTTP/3 0-RTT support, and tiered caching guarantee sub-50ms TTFB worldwide."
            icon={Globe}
            gradient="from-orange-600/30 to-amber-600/30"
          >
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border/40 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
                ⚡ 275+ Edge PoPs
              </span>
              <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                🔒 Automatic TLS 1.3
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                🚀 HTTP/3 QUIC
              </span>
              <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                🔄 Instant Atomic Rollbacks
              </span>
            </div>
          </BentoCard>
        </motion.div>
      </div>
    </section>
  );
}

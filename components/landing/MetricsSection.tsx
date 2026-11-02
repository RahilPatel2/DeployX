"use client";

import * as React from "react";
import { motion, useInView, animate } from "framer-motion";
import { Zap, ShieldCheck, Globe, Clock } from "lucide-react";
import { containerStagger, FADE_UP, useSafeReducedMotion } from "./motion-utils";

interface MetricItem {
  id: string;
  targetValue: number;
  suffix: string;
  prefix?: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  decimals?: number;
}

const METRICS: MetricItem[] = [
  {
    id: "builds",
    targetValue: 12500,
    suffix: "+",
    label: "Successful Deployments",
    description: "Automated builds executed across static, SSR, and edge projects.",
    icon: Zap,
    color: "from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30",
  },
  {
    id: "latency",
    targetValue: 42,
    prefix: "< ",
    suffix: "ms",
    label: "Global Edge Latency",
    description: "Sub-50ms average TTFB delivered via Anycast edge caching.",
    icon: Clock,
    color: "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30",
  },
  {
    id: "uptime",
    targetValue: 99.99,
    suffix: "%",
    decimals: 2,
    label: "Guaranteed SLA Uptime",
    description: "Multi-region redundant failover across Cloudflare's backbone.",
    icon: ShieldCheck,
    color: "from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30",
  },
  {
    id: "pops",
    targetValue: 275,
    suffix: "+",
    label: "Global Edge PoPs",
    description: "Active points of presence spanning 100+ nations worldwide.",
    icon: Globe,
    color: "from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30",
  },
];

function AnimatedCounter({ metric }: { metric: MetricItem }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const reducedMotion = useSafeReducedMotion();
  const [displayValue, setDisplayValue] = React.useState<string>(
    reducedMotion
      ? metric.targetValue.toLocaleString()
      : (0).toFixed(metric.decimals ?? 0)
  );

  React.useEffect(() => {
    if (reducedMotion || !inView) return;

    const controls = animate(0, metric.targetValue, {
      duration: 2,
      ease: [0.16, 1, 0.3, 1], // snappy custom easeOut
      onUpdate: (latest) => {
        if (metric.decimals) {
          setDisplayValue(latest.toFixed(metric.decimals));
        } else {
          setDisplayValue(Math.round(latest).toLocaleString());
        }
      },
    });

    return () => controls.stop();
  }, [inView, metric.targetValue, metric.decimals, reducedMotion]);

  const Icon = metric.icon;

  return (
    <motion.div
      variants={FADE_UP}
      className="p-3.5 sm:p-8 rounded-2xl sm:rounded-3xl border border-border/70 bg-card/60 backdrop-blur-xl flex flex-col justify-between hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-lg group"
    >
      <div>
        <div className="flex items-center justify-between mb-2.5 sm:mb-4">
          <div
            className={`h-7 w-7 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-gradient-to-br border flex items-center justify-center ${metric.color} group-hover:scale-110 transition-transform`}
          >
            <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </div>
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded bg-muted/60">
            METRIC
          </span>
        </div>

        <div className="font-mono text-xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight flex items-baseline">
          {metric.prefix && <span className="text-sm sm:text-2xl lg:text-3xl text-muted-foreground mr-0.5 sm:mr-1">{metric.prefix}</span>}
          <span ref={ref}>{displayValue}</span>
          <span className="text-base sm:text-2xl lg:text-3xl text-primary ml-0.5">{metric.suffix}</span>
        </div>

        <h3 className="text-xs sm:text-base font-bold text-foreground mt-1.5 sm:mt-3 group-hover:text-primary transition-colors line-clamp-1">
          {metric.label}
        </h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 leading-relaxed hidden sm:block">
          {metric.description}
        </p>
      </div>

      <div className="mt-2.5 sm:mt-6 pt-2 sm:pt-4 border-t border-border/40 flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[11px] font-mono text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="truncate">Live Telemetry</span>
      </div>
    </motion.div>
  );
}

export function MetricsSection() {
  return (
    <section className="py-10 sm:py-20 lg:py-28 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-16">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Proven Performance at{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Scale
            </span>
          </h2>
          <p className="mt-2 text-xs sm:text-base text-muted-foreground px-2">
            Trusted by developers shipping modern web applications with speed and reliability.
          </p>
        </div>

        {/* 4 Metrics Grid: 2x2 on Mobile, 4-Cols on Desktop */}
        <motion.div
          variants={containerStagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5"
        >
          {METRICS.map((metric) => (
            <AnimatedCounter key={metric.id} metric={metric} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Star, Quote, CheckCircle2 } from "lucide-react";
import { containerStagger, FADE_UP, useSafeReducedMotion } from "./motion-utils";

interface Testimonial {
  name: string;
  role: string;
  company: string;
  content: string;
  avatarText: string;
  avatarColor: string;
  highlight: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Elena Rostova",
    role: "Head of Infrastructure",
    company: "ScaleGrid AI",
    content: "Migrating from traditional VPS setups to DeployX cut our global release cycles from 12 minutes to 18 seconds. The automatic Cloudflare Pages routing and secret sandboxing gave our security team immediate peace of mind.",
    avatarText: "ER",
    avatarColor: "bg-blue-500 text-white",
    highlight: "18s release cycles",
  },
  {
    name: "Marcus Vance",
    role: "Senior Full-Stack Lead",
    company: "Hyperion Labs",
    content: "DeployX feels like what modern developer hosting was always supposed to be. HMAC-authenticated git webhooks, instant atomic rollbacks, and zero build cold starts. It just works, every single time.",
    avatarText: "MV",
    avatarColor: "bg-purple-500 text-white",
    highlight: "Zero cold starts",
  },
  {
    name: "Sophia Chen",
    role: "Founding Engineer",
    company: "Aether Dynamics",
    content: "The live build terminal and automatic framework detection are pure magic. We push Next.js 16 updates multiple times a day without ever worrying about stale assets or edge propagation delays.",
    avatarText: "SC",
    avatarColor: "bg-emerald-500 text-white",
    highlight: "Pure magic",
  },
];

export function TestimonialsSection() {
  const reducedMotion = useSafeReducedMotion();

  return (
    <section id="testimonials" className="py-10 sm:py-24 lg:py-32 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-3 sm:mb-4">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span>Developer Experiences</span>
          </div>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Loved by Developers Shipping at{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Speed
            </span>
          </h2>
          <p className="mt-2 sm:mt-4 text-xs sm:text-lg text-muted-foreground leading-relaxed px-2">
            See how forward-thinking teams streamline their continuous deployment workflows with DeployX.
          </p>
        </div>

        {/* Mobile Swipe Hint */}
        <div className="flex md:hidden items-center justify-between text-[10px] text-muted-foreground px-1 mb-2 font-mono">
          <span>Developer Stories</span>
          <span className="flex items-center gap-1 text-primary">Horizontal Scroll ›</span>
        </div>

        {/* 3 Testimonials: Horizontal Snap on Mobile, 3-Cols on Desktop */}
        <motion.div
          variants={containerStagger(0.12)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="flex overflow-x-auto snap-x snap-mandatory pb-3 gap-3.5 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible"
        >
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="w-[85vw] max-w-[320px] shrink-0 snap-center md:w-auto md:max-w-none">
              <motion.div
                variants={FADE_UP}
                whileHover={reducedMotion ? {} : { y: -4 }}
                className="relative rounded-2xl sm:rounded-3xl border border-border/70 bg-card/70 backdrop-blur-xl p-4 sm:p-7 shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between group h-full"
              >
                <div>
                  {/* 5-star rating + quote icon */}
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
                      ))}
                    </div>
                    <Quote className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
                  </div>

                  {/* Quote Content */}
                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed italic mb-4 sm:mb-6">
                    &ldquo;{t.content}&rdquo;
                  </p>
                </div>

                {/* Author footer */}
                <div className="pt-3 sm:pt-4 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div
                      className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center font-bold text-xs select-none shadow-sm ${t.avatarColor}`}
                    >
                      {t.avatarText}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1">
                        {t.name}
                        <CheckCircle2 className="h-3 w-3 text-blue-400" />
                      </h4>
                      <p className="text-[11px] sm:text-xs text-muted-foreground">
                        {t.role}, <span className="text-foreground/80 font-medium">{t.company}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

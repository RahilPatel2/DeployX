"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Sparkles, ArrowRight, Zap } from "lucide-react";
import { containerStagger, FADE_UP, useSafeReducedMotion, SPRINGS } from "./motion-utils";

type BillingCycle = "monthly" | "annual";

interface PricingTier {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  isPopular?: boolean;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  ctaVariant: "default" | "primary" | "outline";
}

const TIERS: PricingTier[] = [
  {
    id: "hobby",
    name: "Developer",
    tagline: "Perfect for personal projects, experiments, and side hustles.",
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      "Up to 3 Active Projects",
      "100 Automated Builds / mo",
      "Cloudflare Pages 275+ Edge PoPs",
      "Automatic SSL (TLS 1.3)",
      "Instant GitHub Webhook Deployments",
      "Community Discord Support",
    ],
    ctaLabel: "Start Building Free",
    ctaHref: "/signup",
    ctaVariant: "outline",
  },
  {
    id: "pro",
    name: "Pro Team",
    tagline: "For scaling products requiring isolated sandboxes and zero limits.",
    monthlyPrice: 20,
    annualPrice: 16,
    isPopular: true,
    features: [
      "Unlimited Active Projects",
      "Unlimited Automated Builds",
      "Isolated cgroup v2 Build Runners",
      "Automated Secret Scrubbing",
      "Custom Domains & Root Apex Support",
      "Preview Deployments for Pull Requests",
      "Google Authenticator & TOTP MFA",
      "Priority Email & Slack Support",
    ],
    ctaLabel: "Deploy with Pro",
    ctaHref: "/signup",
    ctaVariant: "primary",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Dedicated infrastructure, SLA guarantees, and enterprise security.",
    monthlyPrice: 99,
    annualPrice: 79,
    features: [
      "Dedicated High-CPU Build Workers",
      "Custom SSRF Egress IP Allowlisting",
      "99.99% Guaranteed Uptime SLA",
      "Audit Trail & Compliance Logs",
      "SSO & SAML Authentication",
      "Dedicated Solutions Architect",
      "Custom SLA & Invoicing",
    ],
    ctaLabel: "Contact Enterprise",
    ctaHref: "mailto:sales@deployx.dev",
    ctaVariant: "outline",
  },
];

export function PricingSection() {
  const [billing, setBilling] = React.useState<BillingCycle>("annual");
  const reducedMotion = useSafeReducedMotion();

  return (
    <section id="pricing" className="py-24 sm:py-32 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-4">
            <Zap className="h-3.5 w-3.5" />
            <span>Transparent Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Simple, Predictable{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Developer Tiers
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Start for free, scale when you need high-concurrency builds and dedicated edge instances.
          </p>

          {/* Billing Switcher Toggle */}
          <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-muted/60 border border-border/60 backdrop-blur-md">
            <button
              onClick={() => setBilling("monthly")}
              className={`relative px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer select-none ${
                billing === "monthly" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {billing === "monthly" && (
                <motion.div
                  layoutId="pricing-active-toggle"
                  transition={SPRINGS.snappy}
                  className="absolute inset-0 rounded-xl bg-background border border-border shadow-sm"
                />
              )}
              <span className="relative z-10">Monthly Billing</span>
            </button>

            <button
              onClick={() => setBilling("annual")}
              className={`relative px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer select-none flex items-center gap-2 ${
                billing === "annual" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {billing === "annual" && (
                <motion.div
                  layoutId="pricing-active-toggle"
                  transition={SPRINGS.snappy}
                  className="absolute inset-0 rounded-xl bg-background border border-border shadow-sm"
                />
              )}
              <span className="relative z-10">Annual Billing</span>
              <span className="relative z-10 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* 3 Pricing Cards */}
        <motion.div
          variants={containerStagger(0.12)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch"
        >
          {TIERS.map((tier) => {
            const price = billing === "annual" ? tier.annualPrice : tier.monthlyPrice;

            return (
              <motion.div
                key={tier.id}
                variants={FADE_UP}
                whileHover={reducedMotion ? {} : { y: -6 }}
                className={`relative rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-xl ${
                  tier.isPopular
                    ? "border-2 border-primary bg-card/90 backdrop-blur-2xl shadow-primary/10"
                    : "border border-border/70 bg-card/60 backdrop-blur-xl hover:border-border"
                }`}
              >
                {/* Popular Pill */}
                {tier.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {tier.tagline}
                  </p>

                  {/* Price */}
                  <div className="mt-6 flex items-baseline gap-1 font-mono">
                    <span className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
                      ${price}
                    </span>
                    <span className="text-sm font-sans text-muted-foreground">
                      / month
                    </span>
                  </div>
                  {billing === "annual" && tier.annualPrice > 0 && (
                    <div className="text-[11px] font-mono text-emerald-400 mt-1">
                      Billed annually (${tier.annualPrice * 12}/yr)
                    </div>
                  )}

                  {/* Feature Checklist */}
                  <div className="mt-8 pt-6 border-t border-border/40">
                    <span className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground font-semibold block mb-4">
                      What&apos;s Included:
                    </span>
                    <ul className="space-y-3">
                      {tier.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-xs text-foreground/90">
                          <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="mt-8 pt-4">
                  <Link
                    href={tier.ctaHref}
                    prefetch={true}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-sm active:scale-98 ${
                      tier.ctaVariant === "primary"
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-primary/20"
                        : "bg-muted hover:bg-muted/80 text-foreground border border-border/60 hover:border-border"
                    }`}
                  >
                    <span>{tier.ctaLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

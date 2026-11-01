"use client";

import * as React from "react";
import { LandingBackground } from "@/components/landing/LandingBackground";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { FloatingBadges } from "@/components/landing/FloatingBadges";
import { LiveProductPreview } from "@/components/landing/LiveProductPreview";
import { FrameworkMarquee } from "@/components/landing/FrameworkMarquee";
import { PipelineSection } from "@/components/landing/PipelineSection";
import { ArchitectureSection } from "@/components/landing/ArchitectureSection";
import { MetricsSection } from "@/components/landing/MetricsSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { CtaSection } from "@/components/landing/CtaSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background selection:bg-primary/25 flex flex-col font-sans text-foreground overflow-x-hidden">
      {/* 1. Cinematic Ambient Gradient Canvas with Glowing Orbs */}
      <LandingBackground />

      {/* 2. Glassmorphic Navigation with Scroll Progress and LayoutId Pill */}
      <LandingNav />

      {/* 3. Main Landing Content */}
      <main className="relative z-10 flex-1 w-full">
        {/* Hero Section Container */}
        <div className="relative pt-8 sm:pt-16 pb-8 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FloatingBadges />
          <HeroSection />
          <LiveProductPreview />
        </div>

        {/* Infinite Framework Marquee */}
        <div id="frameworks">
          <FrameworkMarquee />
        </div>

        {/* 4-Stage Deployment Pipeline with 3D Tilt Cards */}
        <PipelineSection />

        {/* Enterprise Architecture Bento Grid with Spotlight Effect */}
        <ArchitectureSection />

        {/* Viewport-Triggered Spring Numeric Counters */}
        <MetricsSection />

        {/* Social Proof & Developer Testimonials */}
        <TestimonialsSection />

        {/* Interactive Pricing with Monthly/Annual Switcher */}
        <PricingSection />

        {/* Cosmic Radial Glow Bottom CTA */}
        <CtaSection />
      </main>

      {/* 4. Rich Multi-Column Landing Footer */}
      <LandingFooter />
    </div>
  );
}

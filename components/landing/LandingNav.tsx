"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import { buttonVariants, Button } from "@/components/ui/button";
import { Menu, X, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { SPRINGS } from "./motion-utils";

interface NavItem {
  name: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Pipeline", href: "#pipeline" },
  { name: "Features", href: "#features" },
  { name: "Architecture", href: "#architecture" },
  { name: "Metrics", href: "#metrics" },
  { name: "Pricing", href: "#pricing" },
  { name: "Dashboard", href: "/dashboard" },
];

export function LandingNav() {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [hoveredNav, setHoveredNav] = React.useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 20);
  });

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? "border-b border-border/50 bg-background/80 backdrop-blur-xl shadow-xs"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="container flex h-16 items-center justify-between mx-auto px-4 sm:px-6">
        {/* Brand Logo with Interactive Glow */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ scale: 1.08, rotate: [0, -3, 3, 0] }}
            whileTap={{ scale: 0.95 }}
            transition={SPRINGS.snappy}
            className="h-8 w-8 bg-foreground rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden"
          >
            <span className="text-background font-extrabold text-sm tracking-tight">DX</span>
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight text-foreground flex items-center gap-1.5">
              DeployX
              <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded-full hidden sm:inline-flex items-center gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Edge
              </span>
            </span>
          </div>
        </Link>

        {/* Desktop Nav Items with LayoutId Pill on Hover */}
        <nav
          onMouseLeave={() => setHoveredNav(null)}
          className="hidden md:flex items-center gap-1 p-1 rounded-full border border-border/40 bg-card/40 backdrop-blur-md"
        >
          {NAV_ITEMS.map((item) => {
            const isHovered = hoveredNav === item.name;
            return (
              <Link
                key={item.name}
                href={item.href}
                onMouseEnter={() => setHoveredNav(item.name)}
                className="relative px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                {isHovered && (
                  <motion.div
                    layoutId="active-nav-pill"
                    transition={SPRINGS.snappy}
                    className="absolute inset-0 bg-muted/70 rounded-full z-[-1]"
                  />
                )}
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Action Buttons with Magnetic Scaling & Glow */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
          >
            Sign In
          </Link>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={SPRINGS.snappy}>
            <Link
              href="/signup"
              className={buttonVariants({
                size: "sm",
                className:
                  "rounded-lg px-4 text-xs font-semibold shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 relative group overflow-hidden",
              })}
            >
              <span className="relative z-10 flex items-center gap-1.5">
                Get Started
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </Link>
          </motion.div>
        </div>

        {/* Mobile menu hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </motion.header>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import { buttonVariants, Button } from "@/components/ui/button";
import { Menu, X, ArrowRight, GitBranch, ShieldCheck, Zap, Globe, Sparkles } from "lucide-react";
import { SPRINGS, EASING } from "./motion-utils";
import { useAuthSession } from "@/lib/auth/use-session";

interface NavItem {
  name: string;
  href: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Pipeline", href: "#pipeline", description: "4-stage deterministic build engine", icon: GitBranch },
  { name: "Features", href: "#features", description: "Zero-config edge distribution", icon: Zap },
  { name: "Architecture", href: "#architecture", description: "Multi-tenant sandboxed runner", icon: ShieldCheck },
  { name: "Metrics", href: "#metrics", description: "Sub-second global cold starts", icon: Globe },
  { name: "Pricing", href: "#pricing", description: "Developer-first transparent tiers", icon: Sparkles },
  { name: "Dashboard", href: "/dashboard", description: "Project control center" },
];

export function LandingNav() {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [hoveredNav, setHoveredNav] = React.useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { scrollY } = useScroll();
  const { isAuthenticated } = useAuthSession();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 20);
  });

  // Lock body scroll when mobile menu is open
  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: EASING.expo }}
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? "border-b border-border/50 bg-background/80 backdrop-blur-xl shadow-xs"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="container flex h-14 sm:h-16 items-center justify-between mx-auto px-3 sm:px-6">
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
          {isAuthenticated ? (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={SPRINGS.snappy}>
              <Link
                href="/dashboard"
                prefetch={true}
                className={buttonVariants({
                  size: "sm",
                  className:
                    "rounded-lg px-4 text-xs font-semibold shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 relative group overflow-hidden",
                })}
              >
                <span className="relative z-10 flex items-center gap-1.5">
                  Go to Dashboard
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          ) : (
            <>
              <Link
                href="/login"
                prefetch={true}
                className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
              >
                Sign In
              </Link>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={SPRINGS.snappy}>
                <Link
                  href="/signup"
                  prefetch={true}
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
            </>
          )}
        </div>

        {/* Mobile menu hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground relative"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile navigation menu"
          >
            <AnimatePresence mode="wait">
              {mobileMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="h-5 w-5" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Menu className="h-5 w-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </div>

      {/* Animated Mobile Drawer with Spring Stagger */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASING.smooth }}
            className="md:hidden border-b border-border/50 bg-background/95 backdrop-blur-2xl overflow-hidden px-6 py-5 shadow-2xl"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.06 },
                },
              }}
              className="space-y-2.5"
            >
              {NAV_ITEMS.map((item) => (
                <motion.div
                  key={item.name}
                  variants={{
                    hidden: { opacity: 0, x: -16 },
                    visible: { opacity: 1, x: 0 },
                  }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      {item.icon && (
                        <div className="h-8 w-8 rounded-md bg-muted/60 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                          <item.icon className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors block">
                          {item.name}
                        </span>
                        {item.description && (
                          <span className="text-[11px] text-muted-foreground block">{item.description}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </Link>
                </motion.div>
              ))}

              <div className="pt-4 border-t border-border/40">
                {isAuthenticated ? (
                  <Link
                    href="/dashboard"
                    prefetch={true}
                    onClick={() => setMobileMenuOpen(false)}
                    className={buttonVariants({ size: "sm", className: "w-full justify-center font-semibold" })}
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href="/login"
                      prefetch={true}
                      onClick={() => setMobileMenuOpen(false)}
                      className={buttonVariants({ variant: "outline", size: "sm", className: "w-full justify-center" })}
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/signup"
                      prefetch={true}
                      onClick={() => setMobileMenuOpen(false)}
                      className={buttonVariants({ size: "sm", className: "w-full justify-center font-semibold" })}
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

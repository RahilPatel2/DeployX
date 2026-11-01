"use client";

import * as React from "react";

interface SidebarContextValue {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  closeMobileDrawer: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(undefined);

const SIDEBAR_STORAGE_KEY = "deployx_sidebar_collapsed";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("deployx-sidebar-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("deployx-sidebar-change", callback);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot() {
  return false;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isCollapsedStored = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [overrideCollapsed, setOverrideCollapsed] = React.useState<boolean | null>(null);
  const [isMobileOpen, setMobileOpen] = React.useState<boolean>(false);

  const isCollapsed = overrideCollapsed !== null ? overrideCollapsed : isCollapsedStored;

  const toggleCollapse = React.useCallback(() => {
    const next = !isCollapsed;
    setOverrideCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      window.dispatchEvent(new Event("deployx-sidebar-change"));
    } catch {
      // LocalStorage access may fail in private browsing mode
    }
  }, [isCollapsed]);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        // Only toggle if not currently in an input / textarea
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleCollapse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  const closeMobileDrawer = React.useCallback(() => {
    setMobileOpen(false);
  }, []);

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      isCollapsed,
      toggleCollapse,
      isMobileOpen,
      setMobileOpen,
      closeMobileDrawer,
    }),
    [isCollapsed, toggleCollapse, isMobileOpen, closeMobileDrawer]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

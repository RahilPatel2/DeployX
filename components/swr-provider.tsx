"use client";

import * as React from "react";
import { SWRConfig, preload } from "swr";

export const defaultFetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error = new Error(errorData.error || `HTTP ${res.status}: Failed to fetch data`);
    (error as unknown as { status: number }).status = res.status;
    throw error;
  }
  return res.json();
};

/**
 * Preload route data into SWR in-memory cache ahead of navigation.
 * Called on hover or focus of navigation elements for instant rendering.
 */
export function preloadRouteData(key: string) {
  if (typeof window === "undefined" || !key) return;
  try {
    preload(key, defaultFetcher);
  } catch {
    // Graceful fallback: do nothing if preloading fails
  }
}

export function SWRDashboardProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: defaultFetcher,
        // Deduplicate identical in-flight requests within a 30-second window
        dedupingInterval: 30000,
        // Do not auto-revalidate when tab gains focus to prevent redundant API calls
        revalidateOnFocus: false,
        // Revalidate on network reconnect
        revalidateOnReconnect: true,
        // Keep prior rendered data during background revalidations to eliminate layout flashes
        keepPreviousData: true,
        // Throttle focus revalidations
        focusThrottleInterval: 60000,
        // Exponential backoff for network errors, but stop on auth failures
        onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
          if (error?.status === 401 || error?.status === 403 || error?.status === 404) return;
          if (retryCount >= 3) return;
          setTimeout(() => revalidate({ retryCount }), Math.min(1000 * 2 ** retryCount, 10000));
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

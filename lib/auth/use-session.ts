"use client";

import useSWR from "swr";

interface SessionData {
  authenticated: boolean;
  user?: {
    userId: string;
    email?: string;
    username?: string;
    name?: string;
  };
}

const sessionFetcher = async (url: string): Promise<SessionData> => {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return { authenticated: false };
    }

    const data = await res.json();
    if (data?.session?.userId || data?.userId) {
      return {
        authenticated: true,
        user: {
          userId: data.session?.userId || data.userId,
          email: data.session?.email || data.email,
          username: data.session?.username || data.username,
          name: data.session?.name || data.name,
        },
      };
    }

    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
};

/**
 * Lightweight client session hook with long deduping interval.
 * Allows client navigation components (e.g. Get Started) to route directly
 * without server-side redirect waterfalls.
 */
export function useAuthSession() {
  const { data, isLoading } = useSWR<SessionData>(
    "/api/auth/session",
    sessionFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 60 seconds deduping
      shouldRetryOnError: false,
    }
  );

  return {
    isAuthenticated: Boolean(data?.authenticated),
    user: data?.user,
    isLoading,
  };
}

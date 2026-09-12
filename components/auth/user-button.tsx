"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function UserButton() {
  const router = useRouter();
  const [user, setUser] = useState<{name?: string, username?: string} | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  if (!user) return null;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium">{user.name || user.username}</span>
      <Button variant="outline" size="sm" onClick={handleLogout}>
        Log out
      </Button>
    </div>
  );
}

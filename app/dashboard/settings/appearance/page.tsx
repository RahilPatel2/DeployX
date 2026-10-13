"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, LayoutGrid, List, Sun, Moon, Laptop } from "lucide-react";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PreferencesResponse {
  preferences: {
    theme?: "system" | "light" | "dark";
    defaultView?: "grid" | "list";
    notifyOnBuildSuccess?: boolean;
    notifyOnBuildFailure?: boolean;
    notifyOnDeploymentStarted?: boolean;
    timezone?: string;
  };
}

export default function AppearanceSettingsPage() {
  const { theme: currentNextTheme, setTheme } = useTheme();
  const { data, isLoading, mutate } = useSWR<PreferencesResponse>("/api/user/preferences", fetcher);

  const [selectedThemeState, setSelectedTheme] = useState<string | null>(null);
  const [selectedViewState, setSelectedView] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedTheme = selectedThemeState ?? data?.preferences?.theme ?? currentNextTheme ?? "dark";
  const selectedView = selectedViewState ?? data?.preferences?.defaultView ?? "grid";

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Update theme in next-themes for instant browser re-rendering
      setTheme(selectedTheme);

      // 2. Persist to MongoDB
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: selectedTheme,
          defaultView: selectedView,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to save preferences");
      }

      toast.success("Appearance preferences saved successfully.");
      await mutate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save preferences";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Appearance & Display</h3>
        <p className="text-sm text-muted-foreground">
          Customize the visual interface, color scheme, and dashboard layout of DeployX.
        </p>
      </div>

      {/* Theme Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Color Scheme</CardTitle>
          <CardDescription>
            Select your preferred interface theme or synchronize automatically with your operating system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Light Option */}
            <div
              onClick={() => setSelectedTheme("light")}
              className={`cursor-pointer flex flex-col items-center justify-between rounded-xl border-2 p-4 transition-all hover:border-primary/50 ${
                selectedTheme === "light"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/60 bg-card/60"
              }`}
            >
              <div className="w-full h-24 rounded-lg bg-[#f4f5f7] border border-border/60 p-2 flex flex-col justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-red-400" />
                  <div className="h-2 w-2 rounded-full bg-amber-400" />
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-16 bg-slate-300 rounded" />
                  <div className="h-2 w-24 bg-slate-200 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2 font-medium text-sm">
                <Sun className="h-4 w-4 text-amber-500" /> Light
              </div>
            </div>

            {/* Dark Option */}
            <div
              onClick={() => setSelectedTheme("dark")}
              className={`cursor-pointer flex flex-col items-center justify-between rounded-xl border-2 p-4 transition-all hover:border-primary/50 ${
                selectedTheme === "dark"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/60 bg-card/60"
              }`}
            >
              <div className="w-full h-24 rounded-lg bg-slate-950 border border-slate-800 p-2 flex flex-col justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-slate-700" />
                  <div className="h-2 w-2 rounded-full bg-slate-700" />
                  <div className="h-2 w-2 rounded-full bg-slate-700" />
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-16 bg-slate-800 rounded" />
                  <div className="h-2 w-24 bg-slate-800 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2 font-medium text-sm">
                <Moon className="h-4 w-4 text-primary" /> Dark
              </div>
            </div>

            {/* System Option */}
            <div
              onClick={() => setSelectedTheme("system")}
              className={`cursor-pointer flex flex-col items-center justify-between rounded-xl border-2 p-4 transition-all hover:border-primary/50 ${
                selectedTheme === "system"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/60 bg-card/60"
              }`}
            >
              <div className="w-full h-24 rounded-lg bg-gradient-to-r from-[#f4f5f7] via-slate-500 to-slate-950 border border-border/60 p-2 flex flex-col justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                </div>
                <div className="h-2 w-20 bg-slate-400 rounded" />
              </div>
              <div className="flex items-center gap-2 font-medium text-sm">
                <Laptop className="h-4 w-4 text-muted-foreground" /> System Default
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard View Preferences */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Default Projects Layout</CardTitle>
          <CardDescription>
            Choose your default layout when browsing projects on the main dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
            <div
              onClick={() => setSelectedView("grid")}
              className={`cursor-pointer flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all ${
                selectedView === "grid"
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-card/40 hover:border-border"
              }`}
            >
              <LayoutGrid className="h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold text-sm">Grid View</div>
                <div className="text-xs text-muted-foreground">Responsive project cards with status badges</div>
              </div>
            </div>

            <div
              onClick={() => setSelectedView("list")}
              className={`cursor-pointer flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all ${
                selectedView === "list"
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-card/40 hover:border-border"
              }`}
            >
              <List className="h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold text-sm">List View</div>
                <div className="text-xs text-muted-foreground">Compact table layout with quick action rows</div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-between items-center bg-muted/10">
          <p className="text-xs text-muted-foreground">Preferences are automatically saved to your account.</p>
          <Button onClick={handleSave} disabled={saving || isLoading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

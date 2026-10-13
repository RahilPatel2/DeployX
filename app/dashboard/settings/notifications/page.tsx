"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, Bell, Shield } from "lucide-react";
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

export default function NotificationsSettingsPage() {
  const { data, isLoading, mutate } = useSWR<PreferencesResponse>("/api/user/preferences", fetcher);

  const [userNotifySuccess, setUserNotifySuccess] = useState<boolean | null>(null);
  const [userNotifyFailure, setUserNotifyFailure] = useState<boolean | null>(null);
  const [userNotifyStarted, setUserNotifyStarted] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const notifyOnBuildSuccess = userNotifySuccess ?? (data?.preferences?.notifyOnBuildSuccess ?? true);
  const notifyOnBuildFailure = userNotifyFailure ?? (data?.preferences?.notifyOnBuildFailure ?? true);
  const notifyOnDeploymentStarted = userNotifyStarted ?? (data?.preferences?.notifyOnDeploymentStarted ?? false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyOnBuildSuccess,
          notifyOnBuildFailure,
          notifyOnDeploymentStarted,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to save notification preferences");
      }

      toast.success("Notification preferences saved successfully.");
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
        <h3 className="text-lg font-medium">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground">
          Control how and when DeployX sends notifications regarding your builds and account activity.
        </p>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Deployment & Build Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure alerts triggered by automated and manual deployment pipelines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/40 bg-muted/20">
              <Checkbox
                id="deploy-fail"
                checked={notifyOnBuildFailure}
                onCheckedChange={(checked) => setUserNotifyFailure(Boolean(checked))}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="deploy-fail" className="font-semibold cursor-pointer">
                  Failed Deployments
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive immediate alerts when a build encounters syntax errors, pipeline timeouts, or provider failures.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/40 bg-muted/20">
              <Checkbox
                id="deploy-success"
                checked={notifyOnBuildSuccess}
                onCheckedChange={(checked) => setUserNotifySuccess(Boolean(checked))}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="deploy-success" className="font-semibold cursor-pointer">
                  Successful Deployments
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive notifications when a production build completes and the live preview URL becomes available.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/40 bg-muted/20">
              <Checkbox
                id="deploy-start"
                checked={notifyOnDeploymentStarted}
                onCheckedChange={(checked) => setUserNotifyStarted(Boolean(checked))}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="deploy-start" className="font-semibold cursor-pointer">
                  Build Started via Webhook Push
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive notifications whenever a GitHub push event triggers an automatic build pipeline run.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/50 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Shield className="h-4 w-4 text-emerald-500" /> Account & Security Notifications
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/40 bg-muted/10 opacity-80">
              <Checkbox id="account-security" checked disabled />
              <div className="space-y-1 leading-none">
                <Label htmlFor="account-security" className="font-semibold text-muted-foreground">
                  Critical Security Alerts (Mandatory)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mandatory notifications regarding password changes, new session logins, and account modifications.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-between items-center bg-muted/10">
          <p className="text-xs text-muted-foreground">Preferences are synced across all your active devices.</p>
          <Button onClick={handleSave} disabled={saving || isLoading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

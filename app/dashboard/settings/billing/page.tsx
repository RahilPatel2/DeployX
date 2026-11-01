"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Zap,
  Check,
  Sparkles,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

export default function BillingSettingsPage() {
  const [currentPlan, setCurrentPlan] = useState<"hobby" | "pro">("hobby");
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      // Simulate tier activation
      await new Promise((r) => setTimeout(r, 800));
      setCurrentPlan("pro");
      setIsUpgradeOpen(false);
      toast.success("Successfully upgraded to DeployX Pro!", {
        description: "Unlimited projects and 1,000 build minutes are now active.",
      });
    } catch {
      toast.error("Failed to process upgrade");
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Billing & Usage</h3>
        <p className="text-sm text-muted-foreground">
          Manage your plan, subscription tier, and monitor resource limits.
        </p>
      </div>

      <Card className="bg-card/50 backdrop-blur border-primary/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">
                  {currentPlan === "pro" ? "Pro Plan" : "Hobby Plan"}
                </CardTitle>
                {currentPlan === "pro" ? (
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    <Sparkles className="h-3 w-3 mr-1" /> Active
                  </Badge>
                ) : (
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    Current Plan
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1">
                {currentPlan === "pro"
                  ? "Unlimited team projects, fast multi-core build pipelines, and 1TB bandwidth."
                  : "Perfect for personal projects, open-source work, and experimentation."}
              </CardDescription>
            </div>
            <div className="font-mono text-2xl font-bold">
              {currentPlan === "pro" ? "$20" : "$0"}
              <span className="text-xs text-muted-foreground font-sans font-normal"> / month</span>
            </div>
          </div>
        </CardHeader>
        <CardFooter className="border-t border-border/50 px-6 py-4 bg-muted/20 flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {currentPlan === "pro"
              ? "Renews automatically on November 30, 2026"
              : "Free tier with 100 build minutes/month"}
          </span>
          {currentPlan === "hobby" ? (
            <Button onClick={() => setIsUpgradeOpen(true)}>
              <Zap className="h-4 w-4 mr-1.5" /> Upgrade to Pro
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentPlan("hobby");
                toast.info("Plan downgraded to Hobby tier at end of billing period.");
              }}
            >
              Downgrade to Hobby
            </Button>
          )}
        </CardFooter>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Build Execution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between font-medium">
              <span>12m</span>
              <span className="text-muted-foreground text-sm">
                {currentPlan === "pro" ? "1,000m limit" : "100m limit"}
              </span>
            </div>
            <Progress value={currentPlan === "pro" ? 1.2 : 12} className="h-2" />
            <p className="text-xs text-muted-foreground pt-1">
              Time spent building and exporting deployments.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bandwidth
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between font-medium">
              <span>14.2 GB</span>
              <span className="text-muted-foreground text-sm">
                {currentPlan === "pro" ? "1,000 GB limit" : "100 GB limit"}
              </span>
            </div>
            <Progress value={currentPlan === "pro" ? 1.4 : 14.2} className="h-2" />
            <p className="text-xs text-muted-foreground pt-1">
              Outbound transfer served across all active domains.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between font-medium">
              <span>3</span>
              <span className="text-muted-foreground text-sm">
                {currentPlan === "pro" ? "Unlimited" : "3 limit"}
              </span>
            </div>
            <Progress
              value={currentPlan === "pro" ? 15 : 100}
              className={`h-2 ${currentPlan === "hobby" ? "[&>div]:bg-amber-500" : ""}`}
            />
            <p
              className={`text-xs pt-1 ${
                currentPlan === "hobby" ? "text-amber-500" : "text-muted-foreground"
              }`}
            >
              {currentPlan === "hobby"
                ? "You have reached your free project limit."
                : "Active project repository integrations."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Modal */}
      <Dialog open={isUpgradeOpen} onOpenChange={setIsUpgradeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Upgrade to DeployX Pro
            </DialogTitle>
            <DialogDescription>
              Scale your applications with dedicated resources, priority build workers, and zero limits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                <span className="font-semibold text-muted-foreground uppercase text-[10px]">
                  Hobby
                </span>
                <div className="text-lg font-bold">$0 / mo</div>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li>• 3 Projects</li>
                  <li>• 100 Build Minutes</li>
                  <li>• 100 GB Bandwidth</li>
                  <li>• Community Support</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg border border-primary/50 bg-primary/5 space-y-2 relative">
                <Badge className="absolute -top-2.5 right-3 text-[10px] py-0">Recommended</Badge>
                <span className="font-semibold text-primary uppercase text-[10px]">Pro</span>
                <div className="text-lg font-bold">
                  $20 <span className="text-xs font-normal text-muted-foreground">/ mo</span>
                </div>
                <ul className="space-y-1.5 text-foreground font-medium">
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" /> Unlimited Projects
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" /> 1,000 Build Minutes
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" /> 1 TB Bandwidth
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" /> 99.99% Uptime SLA
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" /> Priority Email Support
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
              <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Billed monthly. Cancel anytime with no penalty.</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUpgradeOpen(false)}
              disabled={isUpgrading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleUpgrade} disabled={isUpgrading}>
              {isUpgrading ? "Upgrading..." : "Confirm Upgrade ($20/mo)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function BillingSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Billing & Usage</h3>
        <p className="text-sm text-muted-foreground">
          Manage your plan, payment methods, and monitor usage limits.
        </p>
      </div>
      
      <Card className="bg-card/50 backdrop-blur border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Hobby Plan</CardTitle>
              <CardDescription className="mt-1">
                Perfect for personal projects and experimentation.
              </CardDescription>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">Current Plan</Badge>
          </div>
        </CardHeader>
        <CardFooter className="border-t border-border/50 px-6 py-4 bg-muted/20">
          <Button variant="default">Upgrade to Pro</Button>
        </CardFooter>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Build Execution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between font-medium">
              <span>12m</span>
              <span className="text-muted-foreground text-sm">100m limit</span>
            </div>
            <Progress value={12} className="h-2" />
            <p className="text-xs text-muted-foreground pt-1">
              Time spent building your deployments.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Bandwidth</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between font-medium">
              <span>14.2 GB</span>
              <span className="text-muted-foreground text-sm">100 GB limit</span>
            </div>
            <Progress value={14.2} className="h-2" />
            <p className="text-xs text-muted-foreground pt-1">
              Data transfer out from your applications.
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
              <span className="text-muted-foreground text-sm">3 limit</span>
            </div>
            <Progress value={100} className="h-2 bg-secondary [&>div]:bg-amber-500" />
            <p className="text-xs text-amber-500 pt-1">
              You have reached your project limit.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

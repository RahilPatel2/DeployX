"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GitFork, ExternalLink, CheckCircle2 } from "lucide-react";

export default function GithubSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">GitHub Integration</h3>
        <p className="text-sm text-muted-foreground">
          Manage your connected GitHub account and repository access.
        </p>
      </div>
      
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Connected Account</CardTitle>
          <CardDescription>
            DeployX uses this connection to import repositories and trigger deployments on push.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center border border-border/50">
                <GitFork className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <div className="font-medium flex items-center gap-2">
                  RahilPatel2
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-sm text-muted-foreground">Connected on Sep 10, 2026</div>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Manage Access <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-between items-center bg-muted/20">
          <p className="text-sm text-muted-foreground">Revoking access will break all existing deployments.</p>
          <Button variant="destructive">Disconnect</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

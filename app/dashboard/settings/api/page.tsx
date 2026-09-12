"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Box, Key, Calendar } from "lucide-react";

export default function ApiSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">API Keys</h3>
        <p className="text-sm text-muted-foreground">
          Manage API keys to authenticate with the DeployX REST API.
        </p>
      </div>
      
      <div className="flex justify-end">
        <Button>Create New Key</Button>
      </div>

      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Active Keys</CardTitle>
          <CardDescription>
            You have 1 active API key. Do not share your API keys with anyone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
                <Box className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">deployx-production</span>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Active</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="font-mono bg-muted px-1 rounded">dx_live_••••••••</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Created Sep 12, 2026</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm">Revoke</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

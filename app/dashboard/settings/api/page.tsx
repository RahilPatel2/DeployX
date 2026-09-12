"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Box, Copy, MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ApiSettingsPage() {
  const handleCreate = () => {
    toast.success("API key generated successfully", {
      description: "Make sure to copy it now. You won't be able to see it again."
    });
  };

  const handleCopy = () => {
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Manage your API keys for programmatic access to DeployX.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Key
        </Button>
      </div>
      
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Active Keys</CardTitle>
          <CardDescription>
            You have 1 active API key. Do not share your API keys with anyone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Box className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">GitHub Actions Deployment Key</div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="font-mono">dx_live_*******************</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="hidden md:block text-right">
                <div>Created Sep 1</div>
                <div>Last used 2 hrs ago</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Edit Name</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Revoke Key</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

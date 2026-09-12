"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function DangerZonePage() {
  const [loading, setLoading] = useState<"workspace" | "account" | null>(null);

  const handleDelete = (type: "workspace" | "account") => {
    setLoading(type);
    setTimeout(() => {
      setLoading(null);
      toast.error(`${type === "workspace" ? "Workspace" : "Account"} deletion requires confirmation in production.`);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> Danger Zone
        </h3>
        <p className="text-sm text-muted-foreground">
          Irreversible and destructive actions for your account.
        </p>
      </div>
      
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Workspace</CardTitle>
          <CardDescription>
            Permanently delete your workspace and all of its projects, deployments, and domains. This action is not reversible.
          </CardDescription>
        </CardHeader>
        <CardFooter className="border-t border-destructive/20 px-6 py-4 flex justify-end">
          <Button variant="destructive" onClick={() => handleDelete("workspace")} disabled={loading !== null}>
            {loading === "workspace" ? "Deleting..." : "Delete Workspace"}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your personal account and all of its data. This action is not reversible.
          </CardDescription>
        </CardHeader>
        <CardFooter className="border-t border-destructive/20 px-6 py-4 flex justify-end">
          <Button variant="destructive" onClick={() => handleDelete("account")} disabled={loading !== null}>
            {loading === "account" ? "Deleting..." : "Delete Account"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

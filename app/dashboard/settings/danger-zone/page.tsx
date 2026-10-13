"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function DangerZonePage() {
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!passwordInput && confirmInput !== "DELETE MY ACCOUNT") {
      toast.error("Please enter your account password or type 'DELETE MY ACCOUNT' to confirm.");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: passwordInput || undefined,
          confirmation: confirmInput || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to delete account");
      }

      toast.success("Account successfully deleted. Goodbye!");
      // Redirect to login after session cookie expiration
      setTimeout(() => {
        window.location.replace("/login");
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      toast.error(msg);
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> Danger Zone
        </h3>
        <p className="text-sm text-muted-foreground">
          Destructive, irreversible actions regarding your account and workspace data.
        </p>
      </div>

      {/* Account Deletion Card */}
      <Card className="border-destructive/40 bg-destructive/5 backdrop-blur">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Delete Account</CardTitle>
          </div>
          <CardDescription>
            Permanently delete your account and wipe all associated resources from DeployX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground/80 leading-relaxed">
            Deleting your account will permanently remove all your projects, deployment histories,
            registered domains, webhook connections, and profile data from our databases.
          </p>
          <div className="p-3 rounded-lg border border-border/50 bg-card/60 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Safe data retention policy:</p>
            <p>
              Your remote GitHub repositories and Cloudflare accounts will remain intact and will not be altered or deleted.
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t border-destructive/20 px-6 py-4 flex justify-between items-center bg-destructive/10">
          <p className="text-xs text-destructive/80 font-medium">This action cannot be undone.</p>
          <Button
            variant="destructive"
            onClick={() => {
              setConfirmInput("");
              setPasswordInput("");
              setDeleteAccountModalOpen(true);
            }}
          >
            Delete Account
          </Button>
        </CardFooter>
      </Card>

      {/* Confirmation Modal */}
      <Dialog open={deleteAccountModalOpen} onOpenChange={setDeleteAccountModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Confirm Account Deletion
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you absolutely sure? All your DeployX deployments, build configurations, and project bindings will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="del-pass" className="text-xs font-semibold">
                Option 1: Enter your account password
              </Label>
              <Input
                id="del-pass"
                type="password"
                placeholder="Enter password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="bg-muted/40"
              />
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-border/40" />
              <span className="flex-shrink mx-3 text-[10px] text-muted-foreground uppercase font-mono">
                Or
              </span>
              <div className="flex-grow border-t border-border/40" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="del-phrase" className="text-xs font-semibold">
                Option 2: Type <span className="font-mono text-destructive">DELETE MY ACCOUNT</span>
              </Label>
              <Input
                id="del-phrase"
                placeholder="DELETE MY ACCOUNT"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="bg-muted/40 font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteAccountModalOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting || (!passwordInput && confirmInput !== "DELETE MY ACCOUNT")}
              className="ml-2"
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {isDeleting ? "Deleting Account..." : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, AlertCircle, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AccountStatus {
  googleConnected: boolean;
  googleEmail: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ConnectedAccountsCard() {
  const { data, isLoading, mutate } = useSWR<AccountStatus>("/api/auth/mfa/status", fetcher);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const handleConnectGoogle = () => {
    window.location.href = new URL(
      "/api/auth/google/connect?mode=connect&returnTo=/dashboard/settings/security",
      window.location.origin
    ).toString();
  };

  const handleDisconnectGoogle = async () => {
    setIsDisconnectingGoogle(true);
    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "POST" });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to disconnect Google account.");
      }
      toast.success("Google account disconnected successfully.");
      setShowDisconnectModal(false);
      await mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect Google.");
    } finally {
      setIsDisconnectingGoogle(false);
    }
  };

  const isGoogleConnected = Boolean(data?.googleConnected);

  return (
    <>
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <CardTitle>Connected Social Accounts</CardTitle>
          </div>
          <CardDescription>
            Link external authentication providers to sign in quickly and securely.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Google Account Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-border/40 bg-muted/10 gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center shrink-0 border border-border/40">
                <GoogleIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">Google</span>
                  <Badge
                    variant="outline"
                    className={
                      isGoogleConnected
                        ? "text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "text-[10px] bg-muted text-muted-foreground"
                    }
                  >
                    {isGoogleConnected ? "Connected" : "Not connected"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {isGoogleConnected
                    ? `Linked identity: ${data?.googleEmail}`
                    : "Sign in with Google or link an existing Google Workspace profile."}
                </div>
              </div>
            </div>

            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
            ) : isGoogleConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDisconnectModal(true)}
                className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
              >
                <Unlink className="h-3 w-3 mr-1" />
                Disconnect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectGoogle}
                className="text-xs shrink-0"
              >
                Connect Google
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Disconnect Google Confirmation Modal */}
      <Dialog open={showDisconnectModal} onOpenChange={setShowDisconnectModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Disconnect Google Account?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to unlink your Google identity ({data?.googleEmail})? You will no longer be able to sign in with Google until you reconnect it.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDisconnectModal(false)}
              disabled={isDisconnectingGoogle}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDisconnectGoogle}
              disabled={isDisconnectingGoogle}
            >
              {isDisconnectingGoogle && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Confirm Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

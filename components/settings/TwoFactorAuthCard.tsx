"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  Download,
  AlertTriangle,
  KeyRound,
  RefreshCw,
  QrCode,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface MfaStatusResponse {
  mfaEnabled: boolean;
  enrolledAt: string | null;
  lastVerifiedAt: string | null;
  recoveryCodesRemaining: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function TwoFactorAuthCard() {
  const { data, isLoading, mutate } = useSWR<MfaStatusResponse>("/api/auth/mfa/status", fetcher);

  // Setup dialog state
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [setupStep, setSetupStep] = useState<"qr" | "recovery">("qr");
  const [enrollData, setEnrollData] = useState<{
    manualKey: string;
    qrCodeDataUrl: string;
    recoveryCodes: string[];
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Disable dialog state
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  // Regenerate codes dialog state
  const [showRegenDialog, setShowRegenDialog] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Handlers for Setup Flow
  // --------------------------------------------------------------------------
  const startSetup = async () => {
    setIsEnrolling(true);
    setSetupError(null);
    setVerificationCode("");
    setSetupStep("qr");

    try {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to start MFA enrollment.");
      }
      setEnrollData(resData);
      setShowSetupDialog(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start MFA setup.");
    } finally {
      setIsEnrolling(false);
    }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) return;

    setIsEnrolling(true);
    setSetupError(null);

    try {
      const res = await fetch("/api/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationCode }),
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Invalid verification code.");
      }

      toast.success("Two-Factor Authentication is now enabled!");
      setSetupStep("recovery");
      await mutate();
    } catch (err: unknown) {
      setSetupError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsEnrolling(false);
    }
  };

  // --------------------------------------------------------------------------
  // Handlers for Disable Flow
  // --------------------------------------------------------------------------
  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword && !disableCode) {
      setDisableError("Please enter your password or verification code.");
      return;
    }

    setIsDisabling(true);
    setDisableError(null);

    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: disablePassword || undefined,
          code: disableCode || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to disable MFA.");
      }

      toast.success("Two-Factor Authentication has been disabled.");
      setShowDisableDialog(false);
      setDisablePassword("");
      setDisableCode("");
      await mutate();
    } catch (err: unknown) {
      setDisableError(err instanceof Error ? err.message : "Failed to disable MFA.");
    } finally {
      setIsDisabling(false);
    }
  };

  // --------------------------------------------------------------------------
  // Handlers for Recovery Code Regeneration
  // --------------------------------------------------------------------------
  const handleRegenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regenPassword) {
      setRegenError("Password is required to regenerate recovery codes.");
      return;
    }

    setIsRegenerating(true);
    setRegenError(null);

    try {
      const res = await fetch("/api/auth/mfa/recovery-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: regenPassword }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to regenerate recovery codes.");
      }

      setNewRecoveryCodes(resData.recoveryCodes);
      toast.success("New recovery codes generated.");
      await mutate();
    } catch (err: unknown) {
      setRegenError(err instanceof Error ? err.message : "Regeneration failed.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const copyCodes = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join("\n"));
    setCopiedCodes(true);
    toast.success("Recovery codes copied to clipboard");
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const downloadCodes = (codes: string[]) => {
    const text = `DEPLOYX EMERGENCY RECOVERY CODES\nGenerated: ${new Date().toISOString()}\n\n${codes.join("\n")}\n\nKeep these codes in a safe place.`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deployx-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Recovery codes downloaded");
  };

  const isMfaActive = Boolean(data?.mfaEnabled);

  return (
    <>
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isMfaActive ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                )}
                <CardTitle>Two-Factor Authentication (MFA)</CardTitle>
                <Badge
                  variant="outline"
                  className={
                    isMfaActive
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs"
                      : "bg-muted text-muted-foreground text-xs"
                  }
                >
                  {isMfaActive ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <CardDescription>
                Protect your account and production deployments with TOTP authenticator apps (Google Authenticator, Authy, 1Password).
              </CardDescription>
            </div>

            {isMfaActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDisableError(null);
                  setDisablePassword("");
                  setDisableCode("");
                  setShowDisableDialog(true);
                }}
                className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs shrink-0"
              >
                Disable 2FA
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={startSetup}
                disabled={isEnrolling || isLoading}
                className="text-xs shrink-0"
              >
                {isEnrolling ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5 mr-1.5" />}
                Enable Two-Factor Authentication
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="py-4 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isMfaActive ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-border/40 bg-muted/20">
                  <span className="text-muted-foreground block mb-0.5">Enrollment Date</span>
                  <span className="font-semibold text-foreground">
                    {data?.enrolledAt ? new Date(data.enrolledAt).toLocaleDateString() : "Active"}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/40 bg-muted/20 flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Remaining Recovery Codes</span>
                    <span className="font-semibold text-foreground">
                      {data?.recoveryCodesRemaining ?? 0} unused codes
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRegenError(null);
                      setRegenPassword("");
                      setNewRecoveryCodes(null);
                      setShowRegenDialog(true);
                    }}
                    className="text-xs text-primary hover:underline h-7 px-2"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Regenerate
                  </Button>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  Your account is protected. Every new login requires your Google Authenticator six-digit code.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-border/40 bg-muted/10 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Why enable Two-Factor Authentication?</p>
              <p>
                Two-Factor Authentication prevents unauthorized access even if your password is leaked or compromised.
                DeployX enforces TOTP authentication on all new sessions once enabled.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------------------------------- */}
      {/* MFA Setup Modal Dialog */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {setupStep === "qr" ? "Set up Google Authenticator" : "Emergency Recovery Codes"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {setupStep === "qr"
                ? "Scan the QR code with your authenticator app, then enter the 6-digit verification code."
                : "Save these backup recovery codes in a secure place. They can be used to log in if you lose your phone."}
            </DialogDescription>
          </DialogHeader>

          {setupStep === "qr" && enrollData && (
            <div className="space-y-4 py-2">
              <div className="flex justify-center p-3 bg-white rounded-xl border w-fit mx-auto">
                <Image
                  src={enrollData.qrCodeDataUrl}
                  alt="MFA QR Code"
                  width={180}
                  height={180}
                  unoptimized
                  className="rounded-lg"
                />
              </div>

              <div className="bg-muted/40 p-2.5 rounded-lg border text-xs space-y-1">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Manual setup key:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(enrollData.manualKey.replace(/\s+/g, ""));
                      setCopiedKey(true);
                      toast.success("Key copied");
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    {copiedKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedKey ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="font-mono text-center font-bold tracking-wider select-all break-all py-1">
                  {enrollData.manualKey}
                </div>
              </div>

              <form onSubmit={confirmSetup} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="setupCodeInput" className="text-xs">
                    Verification Code
                  </Label>
                  <Input
                    id="setupCodeInput"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    disabled={isEnrolling}
                    className="h-10 text-center font-mono text-lg font-bold tracking-widest"
                    autoFocus
                  />
                </div>

                {setupError && (
                  <div className="p-2 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md text-center">
                    {setupError}
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowSetupDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isEnrolling || verificationCode.length !== 6}>
                    {isEnrolling ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
                    Verify & Activate
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}

          {setupStep === "recovery" && enrollData && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                <span>Each code can be used once. These codes will not be shown again.</span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg border font-mono text-xs text-center font-bold tracking-wider">
                {enrollData.recoveryCodes.map((code, idx) => (
                  <div key={idx} className="bg-card/60 py-1.5 px-2 rounded border border-border/40">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => copyCodes(enrollData.recoveryCodes)}
                >
                  {copiedCodes ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copiedCodes ? "Copied" : "Copy Codes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => downloadCodes(enrollData.recoveryCodes)}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowSetupDialog(false)}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------------------- */}
      {/* Disable MFA Modal Dialog */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Disable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm your password or enter your current authenticator code to remove 2FA protection.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDisableMfa} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="disablePass">Current Password</Label>
              <PasswordInput
                id="disablePass"
                placeholder="Enter password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                disabled={isDisabling}
              />
            </div>

            <div className="text-xs text-center text-muted-foreground uppercase font-semibold">Or</div>

            <div className="space-y-2">
              <Label htmlFor="disableCodeInput">Current Authenticator or Recovery Code</Label>
              <Input
                id="disableCodeInput"
                placeholder="e.g. 123456 or ABCD-1234"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                disabled={isDisabling}
                className="font-mono text-center uppercase"
              />
            </div>

            {disableError && (
              <div className="p-2.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md">
                {disableError}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowDisableDialog(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isDisabling || (!disablePassword && !disableCode)}
              >
                {isDisabling && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Confirm and Disable 2FA
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------------------- */}
      {/* Regenerate Recovery Codes Modal Dialog */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={showRegenDialog} onOpenChange={setShowRegenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Regenerate Recovery Codes
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generating new codes immediately invalidates any previously issued recovery codes.
            </DialogDescription>
          </DialogHeader>

          {!newRecoveryCodes ? (
            <form onSubmit={handleRegenerateCodes} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="regenPass">Confirm Password</Label>
                <PasswordInput
                  id="regenPass"
                  placeholder="Enter current password"
                  value={regenPassword}
                  onChange={(e) => setRegenPassword(e.target.value)}
                  disabled={isRegenerating}
                />
              </div>

              {regenError && (
                <div className="p-2.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md">
                  {regenError}
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowRegenDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isRegenerating || !regenPassword}>
                  {isRegenerating && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Regenerate Codes
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg border font-mono text-xs text-center font-bold tracking-wider">
                {newRecoveryCodes.map((code, idx) => (
                  <div key={idx} className="bg-card/60 py-1.5 px-2 rounded border border-border/40">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => copyCodes(newRecoveryCodes)}
                >
                  {copiedCodes ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copiedCodes ? "Copied" : "Copy Codes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => downloadCodes(newRecoveryCodes)}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              </div>

              <DialogFooter className="pt-2">
                <Button size="sm" className="w-full" onClick={() => setShowRegenDialog(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

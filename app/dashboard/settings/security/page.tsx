"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Loader2, CheckCircle2, Lock, LogOut, Laptop, Clock, Trash2, KeyRound } from "lucide-react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "sonner";
import { TwoFactorAuthCard } from "@/components/settings/TwoFactorAuthCard";
import { ConnectedAccountsCard } from "@/components/settings/ConnectedAccountsCard";

interface SessionItem {
  id: string;
  isCurrent: boolean;
  device: string;
  ip: string;
  createdAt: string;
  lastActive: string;
}

interface SessionsResponse {
  sessions: SessionItem[];
  passwordChangedAt?: string | null;
  lastLogin?: string | null;
  createdAt?: string;
  hasPassword?: boolean;
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { data: sessionData, isLoading: loadingSessions, mutate: mutateSessions } = useSWR<SessionsResponse>(
    "/api/auth/sessions",
    { revalidateOnFocus: false }
  );

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Real-time password strength checks
  const hasMinLength = newPassword.length >= 8;
  const hasMixedChars =
    /[a-zA-Z]/.test(newPassword) && /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (!newPassword) {
      toast.error("Please enter a new password.");
      return;
    }
    if (!hasMinLength) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (!hasMixedChars) {
      toast.error("New password must contain at least one letter and one number or special character.");
      return;
    }
    if (!passwordsMatch) {
      toast.error("New passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("New password must be different from your current password.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      toast.success("Password updated successfully. Other sessions have been revoked.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      await mutateSessions();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to update password";
      toast.error(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeOthers = async () => {
    setIsRevokingOthers(true);
    try {
      const res = await fetch("/api/auth/sessions/revoke-others", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to sign out other sessions");
      }

      toast.success("All other active sessions have been signed out.");
      await mutateSessions();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to revoke sessions";
      toast.error(msg);
    } finally {
      setIsRevokingOthers(false);
    }
  };

  const handleRevokeSingleSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      const res = await fetch("/api/auth/sessions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke session");
      }

      toast.success("Session signed out.");
      await mutateSessions();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to revoke session";
      toast.error(msg);
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleLogoutCurrentSession = async () => {
    setIsLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        toast.success("Logged out successfully.");
        router.push("/login");
      } else {
        toast.error("Failed to log out. Please try again.");
      }
    } catch {
      toast.error("Network error while logging out.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const formattedPasswordChange = sessionData?.passwordChangedAt
    ? new Date(sessionData.passwordChangedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Never changed";

  const otherSessions = (sessionData?.sessions || []).filter((s) => !s.isCurrent);
  const currentSession = (sessionData?.sessions || []).find((s) => s.isCurrent);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Security & Authentication</h3>
        <p className="text-sm text-muted-foreground">
          Manage your credentials, active device sessions, and authentication security policies.
        </p>
      </div>

      {/* Two-Factor Authentication Card */}
      <TwoFactorAuthCard />

      {/* Connected Accounts Card */}
      <ConnectedAccountsCard />

      {/* 1. Change Password Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle>Change Password</CardTitle>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span>Last updated: {formattedPasswordChange}</span>
            </div>
          </div>
          <CardDescription>
            Update your account password. Choosing a strong password protects your projects and automated deployments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="current-pass">Current Password</Label>
            <PasswordInput
              id="current-pass"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-pass">New Password</Label>
            <PasswordInput
              id="new-pass"
              placeholder="Enter new password (min. 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-pass">Confirm New Password</Label>
            <PasswordInput
              id="confirm-pass"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {/* Password Strength Checklist */}
          {newPassword && (
            <div className="p-3 rounded-lg border border-border/40 bg-muted/20 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    hasMinLength ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />
                <span className={hasMinLength ? "text-foreground" : "text-muted-foreground"}>
                  At least 8 characters long
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    hasMixedChars ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />
                <span className={hasMixedChars ? "text-foreground" : "text-muted-foreground"}>
                  Contains letters and numbers or symbols
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    passwordsMatch ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />
                <span className={passwordsMatch ? "text-foreground" : "text-muted-foreground"}>
                  Confirmation matches new password
                </span>
              </div>
            </div>
          )}

          <div className="p-3 rounded-lg border border-border/40 bg-muted/10 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Session policy: </span>
            Updating your password will automatically revoke and sign out all other devices and browser sessions.
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-between items-center bg-muted/10">
          <p className="text-xs text-muted-foreground">Passwords are securely salted and hashed via bcrypt.</p>
          <Button onClick={handleChangePassword} disabled={isChangingPassword}>
            {isChangingPassword ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {isChangingPassword ? "Updating..." : "Update Password"}
          </Button>
        </CardFooter>
      </Card>

      {/* 2. Active Sessions Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-500" />
                <CardTitle>Active Device Sessions</CardTitle>
              </div>
              <CardDescription>
                Devices and browsers currently authenticated to your DeployX account.
              </CardDescription>
            </div>
            {otherSessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevokeOthers}
                disabled={isRevokingOthers}
                className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs shrink-0"
              >
                {isRevokingOthers ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                )}
                Sign Out Other Sessions ({otherSessions.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingSessions && !sessionData ? (
            <div className="py-6 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Current Session Item */}
              {currentSession && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Laptop className="h-4.5 w-4.5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{currentSession.device}</span>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                          Current Device
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>IP: {currentSession.ip}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Active now
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogoutCurrentSession}
                    disabled={isLoggingOut}
                    className="h-8 text-xs shrink-0"
                  >
                    {isLoggingOut ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogOut className="mr-1.5 h-3.5 w-3.5" />}
                    Sign Out
                  </Button>
                </div>
              )}

              {/* Other Sessions */}
              {otherSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-border/40 bg-muted/10 gap-3 hover:border-border/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                      <Laptop className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-medium text-sm text-foreground">{session.device}</span>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>IP: {session.ip}</span>
                        <span>•</span>
                        <span>
                          Last active:{" "}
                          {new Date(session.lastActive).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeSingleSession(session.id)}
                    disabled={revokingSessionId === session.id}
                    className="h-8 text-xs text-muted-foreground hover:text-destructive shrink-0"
                  >
                    {revokingSessionId === session.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Danger Zone Quick Link */}
      <Card className="border-border/40 bg-card/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <div className="font-semibold text-sm">Looking for Danger Zone?</div>
              <div className="text-xs text-muted-foreground">Permanently delete your account and associated project data.</div>
            </div>
          </div>
          <Link href="/dashboard/settings/danger-zone">
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
              Go to Danger Zone
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

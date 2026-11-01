"use client";

import { useState, useRef, useEffect } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  UploadCloud,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Camera,
  Mail,
  AlertTriangle,
  RotateCcw,
  Check,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface UserProfileData {
  user?: {
    name: string;
    username: string;
    email: string;
    avatar?: string;
    phone?: string;
    bio?: string;
    pendingEmail?: string;
    emailVerified?: string | Date;
  };
}

export default function ProfileSettingsPage() {
  const { data, error, isLoading, mutate } = useSWR<UserProfileData>(
    "/api/auth/profile",
    {
      revalidateOnFocus: false,
    }
  );

  const user = data?.user;

  // Form Fields State (null indicates untouched; uses loaded value)
  const [customName, setCustomName] = useState<string | null>(null);
  const [customUsername, setCustomUsername] = useState<string | null>(null);
  const [customPhone, setCustomPhone] = useState<string | null>(null);
  const [customBio, setCustomBio] = useState<string | null>(null);

  const name = customName !== null ? customName : user?.name || "";
  const username = customUsername !== null ? customUsername : user?.username || "";
  const phone = customPhone !== null ? customPhone : user?.phone || "";
  const bio = customBio !== null ? customBio : user?.bio || "";
  const email = user?.email || "";
  const pendingEmail = user?.pendingEmail || null;

  // Photo Upload & Preview State
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [localPhotoPreview, setLocalPhotoPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email Management Modal & Verification State
  const [changeEmailModalOpen, setChangeEmailModalOpen] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailPasswordInput, setEmailPasswordInput] = useState("");
  const [isRequestingEmailChange, setIsRequestingEmailChange] = useState(false);

  const [verificationCodeInput, setVerificationCodeInput] = useState("");
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isCancellingEmailChange, setIsCancellingEmailChange] = useState(false);

  // Profile Save State
  const [savingProfile, setSavingProfile] = useState(false);

  // Clean up object URL when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (localPhotoPreview) {
        URL.revokeObjectURL(localPhotoPreview);
      }
    };
  }, [localPhotoPreview]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Check for unsaved profile text changes
  const hasTextChanges =
    user &&
    ((customName !== null && customName.trim() !== (user.name || "")) ||
      (customUsername !== null && customUsername.trim().toLowerCase() !== (user.username || "")) ||
      (customPhone !== null && customPhone.trim() !== (user.phone || "")) ||
      (customBio !== null && customBio.trim() !== (user.bio || "")));

  const handleCancelChanges = () => {
    setCustomName(null);
    setCustomUsername(null);
    setCustomPhone(null);
    setCustomBio(null);
    toast.info("Unsaved changes discarded.");
  };

  // Profile Save
  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error("Display name cannot be empty.");
      return;
    }
    if (name.trim().length > 64) {
      toast.error("Display name must be 64 characters or fewer.");
      return;
    }
    if (!username.trim()) {
      toast.error("Username cannot be empty.");
      return;
    }
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(cleanUsername)) {
      toast.error("Username must be 3-32 characters (letters, numbers, hyphens, and underscores).");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          username: cleanUsername,
          phone: phone.trim(),
          bio: bio.trim(),
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to update profile");
      }

      toast.success("Profile updated successfully.");
      setCustomName(null);
      setCustomUsername(null);
      setCustomPhone(null);
      setCustomBio(null);

      // Revalidate cache to immediately update TopNav, UserButton, etc.
      await mutate();
      await globalMutate("/api/auth/session");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  // Photo Selection & Local Preview
  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so selecting the same file triggers onChange
    e.target.value = "";

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast.error("Unsupported file format. Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file is too large. Maximum size is 2MB.");
      return;
    }

    // Revoke previous preview URL if any
    if (localPhotoPreview) {
      URL.revokeObjectURL(localPhotoPreview);
    }

    const preview = URL.createObjectURL(file);
    setSelectedPhotoFile(file);
    setLocalPhotoPreview(preview);
    toast.info("Image selected. Click 'Save Photo' to upload.");
  };

  const handleCancelPhotoPreview = () => {
    if (localPhotoPreview) {
      URL.revokeObjectURL(localPhotoPreview);
    }
    setSelectedPhotoFile(null);
    setLocalPhotoPreview(null);
  };

  // Actual Server Upload
  const handleUploadPhoto = async () => {
    if (!selectedPhotoFile) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedPhotoFile);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to upload avatar");
      }

      toast.success("Profile photo uploaded successfully.");
      handleCancelPhotoPreview();

      // Immediate global revalidation
      await mutate();
      await globalMutate("/api/auth/session");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload avatar";
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Remove Photo
  const handleRemovePhoto = async () => {
    setRemovingAvatar(true);
    try {
      const res = await fetch("/api/user/avatar", {
        method: "DELETE",
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to remove avatar");
      }

      toast.success("Profile photo removed.");
      handleCancelPhotoPreview();

      await mutate();
      await globalMutate("/api/auth/session");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove avatar";
      toast.error(msg);
    } finally {
      setRemovingAvatar(false);
    }
  };

  // Request Email Change
  const handleRequestEmailChange = async () => {
    if (!newEmailInput.trim()) {
      toast.error("Please enter a new email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmailInput.trim())) {
      toast.error("Please enter a valid email address format.");
      return;
    }
    if (newEmailInput.trim().toLowerCase() === email.toLowerCase()) {
      toast.error("New email must be different from your current email.");
      return;
    }

    setIsRequestingEmailChange(true);
    try {
      const res = await fetch("/api/auth/email/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail: newEmailInput.trim().toLowerCase(),
          password: emailPasswordInput || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to initiate email change");
      }

      toast.success(`Verification link and code sent to ${newEmailInput.trim()}`);
      setChangeEmailModalOpen(false);
      setNewEmailInput("");
      setEmailPasswordInput("");
      setResendCooldown(60);

      await mutate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change email";
      toast.error(msg);
    } finally {
      setIsRequestingEmailChange(false);
    }
  };

  // Verify Email Code
  const handleVerifyEmailCode = async () => {
    if (!verificationCodeInput.trim()) {
      toast.error("Please enter the verification code or token.");
      return;
    }

    setIsVerifyingCode(true);
    try {
      const res = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: verificationCodeInput.trim(),
          token: verificationCodeInput.trim(),
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Verification failed");
      }

      toast.success("Email address verified and updated successfully!");
      setVerificationCodeInput("");
      await mutate();
      await globalMutate("/api/auth/session");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      toast.error(msg);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Resend Email Code
  const handleResendEmailCode = async () => {
    if (resendCooldown > 0) return;

    setIsResendingCode(true);
    try {
      const res = await fetch("/api/auth/email/resend", {
        method: "POST",
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to resend code");
      }

      toast.success("A new verification code has been sent.");
      setResendCooldown(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend code";
      toast.error(msg);
    } finally {
      setIsResendingCode(false);
    }
  };

  // Cancel Email Change
  const handleCancelEmailChange = async () => {
    setIsCancellingEmailChange(true);
    try {
      const res = await fetch("/api/auth/email/change", {
        method: "DELETE",
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to cancel change");
      }

      toast.success("Pending email change cancelled.");
      setVerificationCodeInput("");
      await mutate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel change";
      toast.error(msg);
    } finally {
      setIsCancellingEmailChange(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading account profile...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="bg-destructive/5 border-destructive/20 p-6">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Unable to load profile
          </h4>
          <p className="text-xs text-muted-foreground">
            {error.message || "We encountered an issue retrieving your account details."}
          </p>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  const effectiveAvatar = localPhotoPreview || user?.avatar || "";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h3 className="text-lg font-medium">Edit Profile & Account</h3>
        <p className="text-sm text-muted-foreground">
          Update your public identity, display credentials, custom avatar, and contact email.
        </p>
      </div>

      {/* Unsaved Changes Banner */}
      {hasTextChanges && (
        <div className="sticky top-16 z-10 flex items-center justify-between p-3.5 rounded-lg border border-amber-500/40 bg-amber-500/10 backdrop-blur-md shadow-sm transition-all">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-amber-500">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>You have unsaved profile changes.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelChanges}
              disabled={savingProfile}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Discard
            </Button>
            <Button
              size="sm"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {savingProfile ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1" />
              )}
              {savingProfile ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* 1. Profile Photo Upload Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
          <CardDescription>
            Upload a custom photo or avatar. Supports JPEG, PNG, and WebP up to 2MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar Preview */}
            <div
              className="relative cursor-pointer group"
              onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
              title="Click to select a new photo"
            >
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-border/60 shadow-md">
                <AvatarImage src={effectiveAvatar} alt={name || "Avatar"} />
                <AvatarFallback className="text-xl sm:text-2xl font-bold bg-primary/10 text-primary">
                  {name ? name.substring(0, 2).toUpperCase() : "DX"}
                </AvatarFallback>
              </Avatar>

              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>

              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                ref={fileInputRef}
                onChange={handlePhotoSelected}
                disabled={uploadingAvatar}
              />
            </div>

            {/* Actions & Status */}
            <div className="space-y-3">
              {localPhotoPreview ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/30">
                      Unsaved Local Preview
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleUploadPhoto}
                      disabled={uploadingAvatar}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4 mr-2" />
                      )}
                      {uploadingAvatar ? "Uploading..." : "Save Photo"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelPhotoPreview}
                      disabled={uploadingAvatar}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4 mr-1" /> Cancel Preview
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    <UploadCloud className="h-4 w-4 mr-2" />
                    Select Image
                  </Button>

                  {user?.avatar && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleRemovePhoto}
                      disabled={removingAvatar || uploadingAvatar}
                    >
                      {removingAvatar ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Remove Photo
                    </Button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Your photo appears on deployments, git commit attribution, and the top navigation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Personal Information Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>
            Update your public profile information across DeployX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Alex Johnson"
              className="bg-muted/40 border-border/50"
              maxLength={64}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setCustomUsername(e.target.value)}
              placeholder="username"
              className="bg-muted/40 border-border/50 font-mono text-sm"
              maxLength={32}
            />
            <p className="text-xs text-muted-foreground">
              Unique handle across DeployX. Allowed: lowercase letters, numbers, hyphens, and underscores (3-32 chars).
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone">Phone (Optional)</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setCustomPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="bg-muted/40 border-border/50"
              maxLength={32}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setCustomBio(e.target.value)}
              placeholder="Full-stack engineer building modern web applications..."
              className="bg-muted/40 border-border/50 resize-none"
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-between items-center bg-muted/10">
          <p className="text-xs text-muted-foreground">
            {hasTextChanges ? "You have unsaved changes." : "Profile information is up to date."}
          </p>
          <div className="flex items-center gap-2">
            {hasTextChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelChanges}
                disabled={savingProfile}
              >
                Cancel
              </Button>
            )}
            <Button onClick={handleSaveProfile} disabled={savingProfile || !hasTextChanges}>
              {savingProfile ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {savingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* 3. Email Address & Verification Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Email Management</CardTitle>
          </div>
          <CardDescription>
            Your primary email is used for account login, password resets, and critical build notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          {/* Current Verified Email */}
          <div className="p-4 rounded-lg border border-border/50 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{email}</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                  <Check className="h-2.5 w-2.5 mr-1" /> Verified
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Primary sign-in and security notifications address.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewEmailInput("");
                setEmailPasswordInput("");
                setChangeEmailModalOpen(true);
              }}
            >
              Change Email
            </Button>
          </div>

          {/* Pending Email Verification Banner */}
          {pendingEmail && (
            <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                    Verification Pending
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEmailChange}
                  disabled={isCancellingEmailChange}
                  className="h-6 text-xs text-muted-foreground hover:text-destructive px-2"
                >
                  {isCancellingEmailChange ? "Cancelling..." : "Cancel Change"}
                </Button>
              </div>

              <p className="text-xs text-foreground/80 leading-relaxed">
                A verification link and 6-digit code was sent to{" "}
                <span className="font-mono font-semibold text-foreground">{pendingEmail}</span>. Your login
                email will remain <span className="font-semibold">{email}</span> until verified.
              </p>

              {/* Code Verification Input */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Input
                  placeholder="Enter 6-digit code or token"
                  value={verificationCodeInput}
                  onChange={(e) => setVerificationCodeInput(e.target.value)}
                  className="bg-card border-border/60 font-mono text-sm max-w-xs"
                />
                <Button
                  onClick={handleVerifyEmailCode}
                  disabled={isVerifyingCode || !verificationCodeInput.trim()}
                  size="sm"
                >
                  {isVerifyingCode ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  {isVerifyingCode ? "Verifying..." : "Verify Code"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendEmailCode}
                  disabled={isResendingCode || resendCooldown > 0}
                  className="text-xs"
                >
                  {isResendingCode ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1" />
                  )}
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Email Dialog Modal */}
      <Dialog open={changeEmailModalOpen} onOpenChange={setChangeEmailModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Change Account Email
            </DialogTitle>
            <DialogDescription className="pt-2">
              Enter your new email address. A verification link and code will be sent to confirm ownership before
              the address is updated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="modal-new-email">New Email Address</Label>
              <Input
                id="modal-new-email"
                type="email"
                placeholder="new-address@example.com"
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                className="bg-muted/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-password">Current Account Password</Label>
              <PasswordInput
                id="modal-password"
                placeholder="Enter password to confirm"
                value={emailPasswordInput}
                onChange={(e) => setEmailPasswordInput(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Required for security verification before modifying account login credentials.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setChangeEmailModalOpen(false)}
              disabled={isRequestingEmailChange}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestEmailChange}
              disabled={isRequestingEmailChange || !newEmailInput.trim()}
              className="ml-2"
            >
              {isRequestingEmailChange ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isRequestingEmailChange ? "Sending Link..." : "Send Verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

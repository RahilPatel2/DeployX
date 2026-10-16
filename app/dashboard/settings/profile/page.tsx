"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  UploadCloud,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Camera,
} from "lucide-react";
import { toast } from "sonner";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.replace("/login?redirect=/dashboard/settings/profile");
    }
    throw new Error("Unauthorized");
  }
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to fetch profile");
  }
  return json;
};

export default function ProfileSettingsPage() {
  const { data, error, isLoading, mutate } = useSWR("/api/auth/profile", fetcher, {
    revalidateOnFocus: false,
  });

  const [customName, setCustomName] = useState<string | null>(null);
  const [customUsername, setCustomUsername] = useState<string | null>(null);
  const [customPhone, setCustomPhone] = useState<string | null>(null);
  const [customBio, setCustomBio] = useState<string | null>(null);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null | undefined>(undefined);

  const name = customName ?? (data?.user?.name || "");
  const username = customUsername ?? (data?.user?.username || "");
  const email = data?.user?.email || "";
  const phone = customPhone ?? (data?.user?.phone || "");
  const bio = customBio ?? (data?.user?.bio || "");
  const avatarUrl = customAvatarUrl !== undefined ? customAvatarUrl : (data?.user?.avatar || null);

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so selecting the same file again triggers change
    e.target.value = "";

    // Client-side validations
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast.error("Unsupported file format. Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file is too large. Maximum size is 2MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to upload avatar");
      }

      setCustomAvatarUrl(resData.avatarUrl);
      toast.success("Avatar uploaded successfully.");
      await mutate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload avatar";
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setRemovingAvatar(true);
    try {
      const res = await fetch("/api/user/avatar", {
        method: "DELETE",
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to remove avatar");
      }

      setCustomAvatarUrl(null);
      toast.success("Avatar removed.");
      await mutate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove avatar";
      toast.error(msg);
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error("Display name cannot be empty.");
      return;
    }
    if (!username.trim()) {
      toast.error("Username cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase(),
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
      await mutate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (error) {
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profile Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your public identity, avatar, and personal details.
        </p>
      </div>

      {/* Avatar Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Profile Avatar</CardTitle>
          <CardDescription>
            Upload a custom photo or avatar. Supports JPEG, PNG, and WebP up to 2MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div
              className="relative cursor-pointer group"
              onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
              title="Click to upload new avatar"
            >
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-border/60 shadow-sm">
                <AvatarImage src={avatarUrl || ""} alt={name || "Avatar"} />
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
                onChange={handleFileSelected}
                disabled={uploadingAvatar}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4 mr-2" />
                  )}
                  {uploadingAvatar ? "Uploading..." : "Upload Photo"}
                </Button>

                {avatarUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleRemoveAvatar}
                    disabled={removingAvatar || uploadingAvatar}
                  >
                    {removingAvatar ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Your avatar appears in deployment logs, project authorship, and the header.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>
            Update your public profile information across DeployX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="grid gap-2">
            <Label htmlFor="name">Display Name</Label>
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
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="bg-muted/30 border-border/40 opacity-70 cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              Primary email used for sign-in and account security notifications.
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
          <p className="text-xs text-muted-foreground">Changes apply immediately upon saving.</p>
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

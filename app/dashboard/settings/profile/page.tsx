"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UploadCloud, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import useSWR from "swr";

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
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, error, isLoading, mutate } = useSWR("/api/auth/profile", fetcher, {
    revalidateOnFocus: false,
    onSuccess: (resData) => {
      if (resData?.user) {
        setName(resData.user.name || "");
        setUsername(resData.user.username || "");
        setEmail(resData.user.email || "");
        setPhone(resData.user.phone || "");
        setBio(resData.user.bio || "");
        if (resData.user.avatar) setAvatar(resData.user.avatar);
      }
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Basic size check for Base64 (limit to 100KB for safety in DB)
      if (file.size > 100 * 1024) {
         toast.error("Image too large. Please select an image under 100KB.");
         return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatar(event.target?.result as string);
        toast.success("Avatar read successfully. Remember to save changes.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar, email, phone, bio }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update profile");
      }

      toast.success("Profile updated successfully");
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
          <h4 className="text-sm font-semibold text-destructive">Unable to load profile</h4>
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
        <h3 className="text-lg font-medium">Profile</h3>
        <p className="text-sm text-muted-foreground">
          Manage your public profile and personal details.
        </p>
      </div>
      
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Avatar</CardTitle>
          <CardDescription>
            This is your avatar. Click on the avatar to upload a custom one from your files. Max size 100KB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div 
              className="relative cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className="h-24 w-24 border border-border/50">
                <AvatarImage src={avatar || ""} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {name ? name.substring(0, 2).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <UploadCloud className="h-6 w-6 text-white" />
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
            <div className="text-sm text-muted-foreground max-w-[200px]">
              An avatar is optional but strongly recommended. It will be shown across the platform.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            This information will be displayed publicly so be careful what you share.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-md bg-muted/50" 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input 
              id="username" 
              value={username}
              disabled
              className="max-w-md bg-muted/50 opacity-50 cursor-not-allowed" 
            />
            <p className="text-xs text-muted-foreground">Username cannot be changed.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-md bg-muted/50" 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input 
              id="phone" 
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="max-w-md bg-muted/50" 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea 
              id="bio" 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us a little bit about yourself" 
              className="max-w-md bg-muted/50 resize-none" 
              rows={4} 
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-between items-center bg-muted/20">
          <p className="text-sm text-muted-foreground">Please use 32 characters at maximum for your name.</p>
          <Button onClick={handleSave} disabled={saving}>
             {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
             {saving ? "Saving..." : "Save changes"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

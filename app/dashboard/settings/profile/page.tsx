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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ProfileSettingsPage() {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, error, isLoading } = useSWR("/api/auth/profile", fetcher);

  useEffect(() => {
    if (data?.user) {
      setName(data.user.name || "");
      setUsername(data.user.username || "");
      if (data.user.avatar) setAvatar(data.user.avatar);
    }
  }, [data]);

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
        body: JSON.stringify({ name, avatar }),
      });

      if (!res.ok) {
        throw new Error("Failed to update profile");
      }

      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return <div className="p-8 text-destructive">Failed to load profile.</div>;
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
            <Label htmlFor="bio">Bio</Label>
            <Textarea 
              id="bio" 
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

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UploadCloud } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

export default function ProfileSettingsPage() {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatar(event.target?.result as string);
        toast.success("Avatar uploaded successfully");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Profile updated successfully");
    }, 600);
  };

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
            This is your avatar. Click on the avatar to upload a custom one from your files.
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
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">DX</AvatarFallback>
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
              An avatar is optional but strongly recommended. Two avatars are recommended: one for light mode and one for dark mode.
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
            <Input id="name" defaultValue="Rahil Patel" className="max-w-md bg-muted/50" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" defaultValue="RahilPatel2" className="max-w-md bg-muted/50" />
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
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

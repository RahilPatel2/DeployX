"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Smartphone, Key, AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Label } from "@/components/ui/label";

export default function SecuritySettingsPage() {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Security & Privacy</h3>
        <p className="text-sm text-muted-foreground">
          Manage your account security, sessions, and authentication methods.
        </p>
      </div>

      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password associated with this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <PasswordInput placeholder="Enter current password" />
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <PasswordInput placeholder="Enter new password" />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <PasswordInput placeholder="Confirm new password" />
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4">
          <Button onClick={() => setIsChangingPassword(true)} disabled={isChangingPassword}>
            {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Update Password
          </Button>
        </CardFooter>
      </Card>

      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            Manage the devices that are currently logged in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Windows PC - Chrome</span>
                  <Badge variant="secondary" className="text-[10px]">Current</Badge>
                </div>
                <div className="text-sm text-muted-foreground">Mumbai, India • Active now</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" disabled>Log out</Button>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4">
          <Button 
            variant="secondary" 
            className="w-full sm:w-auto"
            onClick={() => setIsLoggingOut(true)}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Log out of all other devices
          </Button>
        </CardFooter>
      </Card>

      <Card className="bg-destructive/10 border-destructive/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all of your content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Once you delete your account, there is no going back. Please be certain.
            All projects, deployments, and associated data will be permanently wiped.
          </p>
        </CardContent>
        <CardFooter className="border-t border-destructive/20 px-6 py-4 bg-destructive/5 rounded-b-xl">
          <Button 
            variant="destructive" 
            onClick={() => setIsDeleting(true)}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete Account
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

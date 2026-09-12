"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function NotificationsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Notifications</h3>
        <p className="text-sm text-muted-foreground">
          Configure how you receive notifications.
        </p>
      </div>
      
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Choose what we can send to your email inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Deployments</h4>
            <div className="flex items-start space-x-3">
              <Checkbox id="deploy-success" defaultChecked />
              <div className="space-y-1 leading-none">
                <Label htmlFor="deploy-success">Successful deployments</Label>
                <p className="text-sm text-muted-foreground">
                  Receive an email when a deployment completes successfully.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox id="deploy-fail" defaultChecked />
              <div className="space-y-1 leading-none">
                <Label htmlFor="deploy-fail">Failed deployments</Label>
                <p className="text-sm text-muted-foreground">
                  Receive an email when a deployment fails to build.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4 pt-4 border-t border-border/50">
            <h4 className="text-sm font-medium text-foreground">Account Activity</h4>
            <div className="flex items-start space-x-3">
              <Checkbox id="account-security" defaultChecked disabled />
              <div className="space-y-1 leading-none">
                <Label htmlFor="account-security">Security alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Important notifications about your account security. These cannot be disabled.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox id="account-billing" defaultChecked />
              <div className="space-y-1 leading-none">
                <Label htmlFor="account-billing">Billing alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications about approaching limits and billing cycles.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-end bg-muted/20">
          <Button>Save preferences</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

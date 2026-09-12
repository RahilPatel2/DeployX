"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, AlertTriangle, Info } from "lucide-react";

export default function NotificationsPage() {
  const notifications = [
    {
      id: 1,
      title: "Deployment Successful",
      message: "Your recent deployment for 'Portfolio' has completed successfully.",
      time: "10 minutes ago",
      type: "success",
      read: false
    },
    {
      id: 2,
      title: "Billing Alert",
      message: "You have used 80% of your free tier build minutes this month.",
      time: "2 days ago",
      type: "warning",
      read: true
    },
    {
      id: 3,
      title: "Welcome to DeployX",
      message: "We're excited to have you on board. Check out the documentation to get started.",
      time: "1 week ago",
      type: "info",
      read: true
    }
  ];

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground mt-1">Stay updated on your deployments and account.</p>
        </div>
        <Button variant="outline">Mark all as read</Button>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>
            You have 1 unread notification.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-6 flex gap-4 transition-colors hover:bg-muted/30 ${!notification.read ? 'bg-primary/5' : ''}`}
              >
                <div className="shrink-0 mt-1">
                  {notification.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  {notification.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                  {notification.type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-foreground/80'}`}>
                      {notification.title}
                    </p>
                    <span className="text-xs text-muted-foreground">{notification.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {notification.message}
                  </p>
                </div>
                {!notification.read && (
                  <div className="shrink-0 flex items-center">
                    <div className="h-2 w-2 bg-primary rounded-full" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

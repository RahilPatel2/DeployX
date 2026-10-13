"use client";

import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Search, Loader2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TeamPage() {
  const { data, isLoading } = useSWR("/api/auth/profile", fetcher);
  const user = data?.user;

  const initial = user?.name ? user.name[0].toUpperCase() : "U";

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Team</h2>
          <p className="text-muted-foreground mt-1">Manage workspace members and their permissions.</p>
        </div>
        <Button>Invite Member</Button>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search members..." className="pl-8 bg-muted/50 border-border/50 max-w-sm" />
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            You have 1 member in this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {initial}
                </div>
                <div>
                  <div className="font-medium">{user?.name || "Workspace Member"}</div>
                  <div className="text-sm text-muted-foreground">{user?.email || "No email available"}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="secondary">Owner</Badge>
                <Button variant="ghost" size="icon" disabled>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  UserPlus,
  Mail,
  Trash2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface InviteItem {
  _id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  status: "pending" | "accepted" | "declined";
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { data: profileData, isLoading: isProfileLoading } = useSWR<{
    user?: { name?: string; email?: string; role?: string };
  }>("/api/auth/profile", fetcher);

  const { data: invitesData, mutate: mutateInvites } = useSWR<{ invites: InviteItem[] }>(
    "/api/team/invites",
    fetcher
  );

  const user = profileData?.user;
  const initial = user?.name ? user.name[0].toUpperCase() : "U";
  const invites = invitesData?.invites || [];

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      toast.success(`Invitation sent to ${cleanEmail}`);
      setIsInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      await mutateInvites();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string, email: string) => {
    try {
      setRevokingId(inviteId);
      const res = await fetch(`/api/team/invites?id=${inviteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke invitation");
      }

      toast.success(`Invitation for ${email} revoked`);
      await mutateInvites();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke invitation");
    } finally {
      setRevokingId(null);
    }
  };

  // Filtering
  const cleanSearch = search.toLowerCase().trim();
  const matchesOwner =
    !cleanSearch ||
    (user?.name && user.name.toLowerCase().includes(cleanSearch)) ||
    (user?.email && user.email.toLowerCase().includes(cleanSearch));

  const filteredInvites = invites.filter((inv) =>
    !cleanSearch || inv.email.toLowerCase().includes(cleanSearch) || inv.role.toLowerCase().includes(cleanSearch)
  );

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Team</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage workspace members, collaborate on projects, and manage access roles.
          </p>
        </div>
        <Button
          onClick={() => setIsInviteOpen(true)}
          className="active:scale-95 transition-transform"
        >
          <UserPlus className="h-4 w-4 mr-1.5" /> Invite Member
        </Button>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search members or pending invites..."
          className="pl-8 bg-muted/50 border-border/50 max-w-sm text-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Active Members Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Members</CardTitle>
          <CardDescription>
            Active members with access to repositories and deployments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isProfileLoading && !profileData ? (
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ) : matchesOwner ? (
            <div className="flex items-center justify-between p-4 border border-border/40 hover:bg-muted/30 transition-colors rounded-lg">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {initial}
                </div>
                <div>
                  <div className="font-medium text-sm text-foreground flex items-center gap-2">
                    {user?.name || "Workspace Member"}
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-primary/5 text-primary border-primary/20">
                      You
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {user?.email || "No email available"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Owner
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No active members match &quot;{search}&quot;
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Pending Invitations</span>
            <Badge variant="outline" className="text-xs font-mono font-normal">
              {invites.length} pending
            </Badge>
          </CardTitle>
          <CardDescription>
            Invited users who have not yet accepted their invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredInvites.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/50 rounded-lg">
              {cleanSearch
                ? `No pending invites match "${cleanSearch}"`
                : "No pending invitations. Click 'Invite Member' above to invite team members."}
            </div>
          ) : (
            filteredInvites.map((invite) => {
              const isRevoking = revokingId === invite._id;
              return (
                <div
                  key={invite._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border border-border/40 rounded-lg bg-background/50 hover:bg-muted/20 transition-all gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-foreground flex items-center gap-2">
                        {invite.email}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>Invited {new Date(invite.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Badge variant="outline" className="capitalize text-xs font-mono">
                      {invite.role}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs"
                    >
                      Pending
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isRevoking}
                      onClick={() => handleRevokeInvite(invite._id, invite.email)}
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                      title="Revoke invitation"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {isRevoking ? "Revoking..." : "Revoke"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSendInvite}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" /> Invite Team Member
              </DialogTitle>
              <DialogDescription>
                Send an invitation email to collaborate on your DeployX projects.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Email Address</label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Access Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "member" | "viewer")}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-sans focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="member">Member (Can deploy and manage projects)</option>
                  <option value="admin">Admin (Full access to settings and team)</option>
                  <option value="viewer">Viewer (Read-only access to logs and analytics)</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !inviteEmail}>
                {isSubmitting ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

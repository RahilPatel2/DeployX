"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, MoreVertical, Search, CheckCircle2, AlertCircle } from "lucide-react";

const mockDomains = [
  { id: 1, domain: "portfolio.deployx.app", project: "portfolio-nextjs", status: "active", ssl: true },
  { id: 2, domain: "api.deployx.app", project: "deployx-api", status: "active", ssl: true },
  { id: 3, domain: "www.example.com", project: "portfolio-nextjs", status: "pending", ssl: false },
];

export default function DomainsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Domains</h2>
          <p className="text-muted-foreground mt-1">Manage custom domains across all your projects.</p>
        </div>
        <Button>Add Domain</Button>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search domains..." className="pl-8 bg-muted/50 border-border/50 max-w-sm" />
      </div>

      <div className="space-y-4">
        {mockDomains.map((domain) => (
          <Card key={domain.id} className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">{domain.domain}</span>
                    {domain.status === "active" ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                        <AlertCircle className="h-3 w-3 mr-1" /> Pending Verification
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-4">
                    <span>Project: <span className="text-foreground font-medium">{domain.project}</span></span>
                    {domain.ssl && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> SSL Secured</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {domain.status === "pending" && (
                  <Button variant="secondary" size="sm">Verify DNS</Button>
                )}
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

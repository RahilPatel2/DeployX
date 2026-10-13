"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Search, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface DomainItem {
  _id: string;
  domain: string;
  status: "active" | "pending" | "error";
  projectId?: string;
  createdAt: string;
}

export default function DomainsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useSWR<{ domains: DomainItem[] }>("/api/domains", fetcher);

  const domains = data?.domains || [];
  const filteredDomains = domains.filter((d) =>
    d.domain.toLowerCase().includes(search.toLowerCase())
  );

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
        <Input 
          placeholder="Search domains..." 
          className="pl-8 bg-muted/50 border-border/50 max-w-sm" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDomains.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/50 rounded-xl bg-card/20 backdrop-blur">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No domains yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              You haven&apos;t added any custom domains yet. Connect your domains to your projects to make them accessible to the world.
            </p>
            <Button>Add Domain</Button>
          </div>
        ) : (
          filteredDomains.map((domain) => (
            <Card key={domain._id} className="bg-card/50 backdrop-blur border-border/50">
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

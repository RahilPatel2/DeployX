"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Key, MoreVertical, Search, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

const mockEnvVars: any[] = [];

export default function EnvVarsPage() {
  const [showValues, setShowValues] = useState<Record<number, boolean>>({});

  const toggleShow = (id: number) => {
    setShowValues(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Environment Variables</h2>
          <p className="text-muted-foreground mt-1">Manage secrets and configuration across all projects.</p>
        </div>
        <Button>Add Variable</Button>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search environment variables..." className="pl-8 bg-muted/50 border-border/50 max-w-sm" />
      </div>

      <div className="space-y-4">
        {mockEnvVars.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/50 rounded-xl bg-card/20 backdrop-blur">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No environment variables</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              You haven't added any environment variables yet. Add secrets and configuration to be injected into your deployments.
            </p>
            <Button>Add Variable</Button>
          </div>
        ) : (
          mockEnvVars.map((envVar) => (
            <Card key={envVar.id} className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-md bg-secondary/50 border border-border flex items-center justify-center shrink-0">
                    <Key className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">{envVar.key}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center gap-2">
                        {showValues[envVar.id] ? "sk_live_51...2aB" : "••••••••••••••••••••••••"}
                        <button onClick={() => toggleShow(envVar.id)} className="hover:text-foreground">
                          {showValues[envVar.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {envVar.envs.map((env: string) => (
                        <Badge key={env} variant="secondary" className="text-[10px] bg-secondary/50 hover:bg-secondary">
                          {env}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground ml-2">in {envVar.project}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

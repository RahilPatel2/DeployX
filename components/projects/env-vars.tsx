"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { addEnvironmentVariable, deleteEnvironmentVariable } from "@/app/dashboard/projects/[id]/actions";

interface EnvVar {
  id: string;
  key: string;
  environment: string;
  encrypted_value: string;
}

export function EnvVars({ projectId, envVars }: { projectId: string; envVars: EnvVar[] }) {
  const [loading, setLoading] = useState(false);

  // Helper to partially mask the base64 string
  const maskValue = () => {
    return "••••••••••••••••";
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md border">
        {envVars.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No environment variables configured.
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Environment</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {envVars.map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono">{v.key}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{maskValue()}</td>
                  <td className="px-4 py-3 capitalize">{v.environment}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={async () => {
                      setLoading(true);
                      await deleteEnvironmentVariable(projectId, v.id);
                      setLoading(false);
                    }}>
                      <Button type="submit" variant="ghost" size="icon" disabled={loading}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-muted/30 p-4 rounded-md border">
        <h4 className="font-semibold mb-4 text-sm">Add New Variable</h4>
        <form 
          action={async (formData) => {
            setLoading(true);
            await addEnvironmentVariable(projectId, formData);
            setLoading(false);
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input id="key" name="key" placeholder="API_KEY" required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Input id="value" name="value" placeholder="secret_value" required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="environment">Environment</Label>
            <select 
              id="environment" 
              name="environment" 
              className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            >
              <option value="all">All Environments</option>
              <option value="production">Production</option>
              <option value="preview">Preview</option>
              <option value="development">Development</option>
            </select>
          </div>
          <div>
            <Button type="submit" className="w-full" disabled={loading}>
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

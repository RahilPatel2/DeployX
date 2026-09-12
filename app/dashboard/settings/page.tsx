import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsGeneralPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">General</h3>
        <p className="text-sm text-muted-foreground">
          Update your workspace name and general configuration.
        </p>
      </div>
      
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Workspace Name</CardTitle>
          <CardDescription>
            This is your workspace&apos;s visible name within DeployX.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="workspace-name">Name</Label>
              <Input id="workspace-name" defaultValue="Rahil's Workspace" className="max-w-md bg-muted/50" />
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4 flex justify-between items-center bg-muted/20">
          <p className="text-sm text-muted-foreground">Please use 32 characters at maximum.</p>
          <Button>Save changes</Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete your workspace and all of its projects.
          </CardDescription>
        </CardHeader>
        <CardFooter className="border-t border-destructive/20 px-6 py-4 flex justify-end">
          <Button variant="destructive">Delete Workspace</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

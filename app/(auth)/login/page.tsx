import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to DeployX</h1>
          <p className="text-muted-foreground">Log in to manage your deployments</p>
        </div>
        
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/dashboard" });
          }}
        >
          <Button type="submit" className="w-full h-12 text-base">
            Continue with GitHub
          </Button>
        </form>
      </div>
    </div>
  );
}

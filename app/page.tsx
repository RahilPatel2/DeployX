import { auth } from "@/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-5xl font-bold tracking-tight text-center mb-6">DeployX</h1>
        <p className="text-xl text-center text-muted-foreground max-w-2xl mx-auto mb-10">
          Ship code. Not infrastructure. Connect your GitHub repository, deploy instantly, and watch every build happen in real time.
        </p>
        
        <div className="flex justify-center gap-4">
          {session ? (
            <Link href="/dashboard">
              <Button size="lg" className="h-12 px-8 text-base">
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 text-base">
                Start Deploying
              </Button>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

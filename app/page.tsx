export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold tracking-tight text-center mb-8">DeployX</h1>
        <p className="text-xl text-center text-muted-foreground max-w-2xl mx-auto">
          Ship code. Not infrastructure. Connect your GitHub repository, deploy instantly, and watch every build happen in real time.
        </p>
      </div>
    </main>
  );
}

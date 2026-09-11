export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
      </div>
      <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed">
        <p className="text-muted-foreground">Global settings will appear here.</p>
      </div>
    </div>
  );
}

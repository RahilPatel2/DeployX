import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export async function UserButton() {
  const session = await auth();
  
  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        {session.user.image && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={session.user.image}
            alt="Avatar"
            className="h-8 w-8 rounded-full bg-secondary"
          />
        )}
        <span className="text-sm font-medium">{session.user.name}</span>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <Button variant="outline" size="sm">
          Log out
        </Button>
      </form>
    </div>
  );
}

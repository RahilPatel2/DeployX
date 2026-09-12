// NextAuth adapter for custom JWT MongoDB sessions
import { getSession } from "@/lib/auth/session";

export async function auth() {
  const session = await getSession();
  
  if (!session || !session.userId) {
    return null;
  }

  return {
    user: {
      id: session.userId,
    }
  };
}

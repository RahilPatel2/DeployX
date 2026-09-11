import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { getSupabaseServerClient } from "@/lib/database/client";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github") {
        try {
          const supabase = getSupabaseServerClient();
          
          // Upsert the user in our Supabase database
          const { error } = await supabase
            .from("users")
            .upsert({
              github_id: profile?.id?.toString() || account.providerAccountId,
              username: profile?.login || user.name || "unknown",
              email: user.email,
              avatar_url: user.image,
            }, {
              onConflict: "github_id"
            });

          if (error) {
            console.error("Error upserting user during sign in:", error);
            // We might still want to let them sign in, or fail. For now, log the error and allow.
          }
        } catch (e) {
          console.error("Failed to sync user with database:", e);
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token?.sub) {
        // Find the user ID from our DB to attach to the session
        try {
          const supabase = getSupabaseServerClient();
          const { data, error } = await supabase
            .from("users")
            .select("id")
            .eq("github_id", token.sub)
            .single();
            
          if (data && !error) {
            session.user.id = data.id; // Our internal UUID
          }
        } catch (e) {
          // ignore
        }
      }
      return session;
    },
    async jwt({ token, profile, account }) {
      if (account && profile) {
        token.sub = profile.id?.toString() || account.providerAccountId;
      }
      return token;
    }
  },
  pages: {
    signIn: "/login",
  },
});

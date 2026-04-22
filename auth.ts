import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

/**
 * Auth.js requires a non-empty `secret` for JWT signing.
 * Set AUTH_SECRET (or NEXTAUTH_SECRET) in `.env` — see `.env.example`.
 */
function resolveAuthSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (s && s.trim().length > 0) return s.trim();
  console.warn(
    "[auth] AUTH_SECRET / NEXTAUTH_SECRET is not set — using insecure fallback. Generate one: openssl rand -base64 32"
  );
  return "dev-only-secret-min-32-chars-do-not-use-in-prod";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: resolveAuthSecret(),
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const adminEmail = process.env.ADMIN_EMAIL;
        const hash = process.env.ADMIN_PASSWORD_HASH;
        if (!adminEmail || !hash) {
          console.error("ADMIN_EMAIL or ADMIN_PASSWORD_HASH not set");
          return null;
        }
        if (email !== adminEmail) return null;
        const ok = await bcrypt.compare(password, hash);
        if (!ok) return null;

        return { id: "admin", email, name: "Admin" };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  trustHost: true,
});

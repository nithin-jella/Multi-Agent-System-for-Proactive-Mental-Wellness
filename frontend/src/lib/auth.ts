import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";


declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "BackendTokenExpired";
    user: {
      id?: string | null;
      role?: string | null;
      google_sub?: string | null;
      wallet_address?: string | null;
      ocid_username?: string | null;
    } & User;
  }

  interface User {
    role?: string | null;
    accessToken?: string;
    google_sub?: string | null;
    wallet_address?: string | null;
    ocid_username?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    accessToken?: string;
    google_sub?: string;
    wallet_address?: string;
    ocid_username?: string;
    accessTokenExpires?: number;
    error?: "BackendTokenExpired";
  }
}

type OAuthExchangeResponse = {
  access_token: string;
  token_type: string;
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
    google_sub?: string | null;
  };
};

interface NextAuthUserInfo {
  id?: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  accessToken?: string;
  image?: string | null;
}

const INTERNAL_API_URL = process.env.INTERNAL_API_URL;

const determineRoleFromEmail = (email?: string | null) => {
  if (email && email.toLowerCase().endsWith("@ugm.ac.id")) {
    return "user";
  }
  return "guest";
};

async function exchangeGoogleAccountToken(
  account: { provider: string; providerAccountId: string },
  user: { email?: string | null; name?: string | null; role?: string | null; image?: string | null },
): Promise<OAuthExchangeResponse> {
  if (!INTERNAL_API_URL) {
    throw new Error("INTERNAL_API_URL is not configured");
  }

  const response = await fetch(`${INTERNAL_API_URL}/api/v1/auth/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: account.provider,
      provider_account_id: account.providerAccountId,
      email: user?.email ?? undefined,
      name: user?.name ?? undefined,
      picture: user?.image ?? undefined,
      role: user?.role ?? determineRoleFromEmail(user?.email ?? undefined),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to exchange Google OAuth token");
  }

  return (await response.json()) as OAuthExchangeResponse;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      profile(profile) {
        const role = determineRoleFromEmail(profile.email);
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          role,
          google_sub: profile.sub,
        };
      },
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const apiUrl = process.env.INTERNAL_API_URL;
        if (!apiUrl) {
          throw new Error("INTERNAL_API_URL is not configured");
        }

        try {
          const res = await fetch(`${apiUrl}/api/v1/auth/token`, {
            method: "POST",
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
            headers: { "Content-Type": "application/json" },
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Credentials sign in failed");
          }

          const data = await res.json();

          if (data && data.user) {
            return {
              ...data.user,
              accessToken: data.access_token,
            };
          }
          return null;
        } catch (error) {
          console.error("Authorize error:", error);
          throw error;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 1 * 24 * 60 * 60, // 1 day
  },

  callbacks: {
    async jwt({ token, user, account, trigger, session: updateSession }) {
      const typedUser = (user ?? {}) as NextAuthUserInfo;

      // Handle client-side session updates (e.g. after wallet/OCID linkage).
      if (trigger === 'update' && updateSession) {
        const upd = updateSession as { wallet_address?: string; ocid_username?: string };
        if (upd.wallet_address) token.wallet_address = upd.wallet_address;
        if (upd.ocid_username) token.ocid_username = upd.ocid_username;
        return token;
      }

      if (account?.provider === "google" && account?.providerAccountId) {
        const exchange = await exchangeGoogleAccountToken(
          { provider: account.provider, providerAccountId: account.providerAccountId },
          {
            email: typedUser.email,
            name: typedUser.name,
            role: typedUser.role,
            image: typedUser.image,
          },
        );

        token.accessToken = exchange?.access_token;
        token.role = exchange?.user?.role ?? token.role;
        token.id = exchange?.user?.id ?? token.id;
        token.google_sub = exchange?.user?.google_sub ?? account.providerAccountId;
        token.email = exchange?.user?.email ?? token.email;
        
        // Store token expiry time (backend tokens typically expire in 24 hours)
        token.accessTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
      } else if (account?.provider === "credentials" && user) {
        token.id = typedUser.id ?? token.id;
        token.role = typedUser.role ?? token.role;
        token.accessToken = typedUser.accessToken ?? token.accessToken;
        
        // Store token expiry time (backend tokens typically expire in 24 hours)
        token.accessTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
      }

      // Check if the backend access token has expired
      if (token.accessTokenExpires && Date.now() > (token.accessTokenExpires as number)) {
        // Token has expired - invalidate the session
        console.warn('[NextAuth] Backend access token has expired');
        return {
          ...token,
          error: "BackendTokenExpired" as const,
        };
      }

      return token;
    },
    async session({ session, token }) {
      // Check for token expiration error
      if ('error' in token && token.error === "BackendTokenExpired") {
        // Mark session as expired but still return it
        // The client will check this and sign out
        return {
          ...session,
          error: "BackendTokenExpired",
        };
      }

      if (session.user) {
        if (token.id) {
          session.user.id = token.id;
        } else if (!session.user.id && typeof token.sub === "string") {
          session.user.id = token.sub;
        }
        session.user.role = token.role ?? session.user.role ?? null;
        session.user.google_sub = token.google_sub ?? session.user.google_sub ?? null;
        session.user.wallet_address = token.wallet_address ?? session.user.wallet_address ?? null;
        session.user.ocid_username = token.ocid_username ?? session.user.ocid_username ?? null;
      }

      if (token.accessToken) {
        session.accessToken = token.accessToken;
      }

      return session;
    },
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  debug: process.env.NODE_ENV === "development",
};



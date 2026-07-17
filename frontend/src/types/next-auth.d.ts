import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extend the built-in session types
   */
  interface Session extends DefaultSession {
    accessToken?: string;
    user: {
      id: string; // Ensure ID is always present after authentication
      role?: string; // Role assigned during authentication
      accessToken?: string; // Session-scoped access token for backend calls
      wallet_address?: string | null;
      allow_email_checkins?: boolean; // For email check-in feature
      google_sub?: string; // Add google_sub to the user object
    } & DefaultSession["user"]; // Inherit name, email, image
    jwt?: string; // The raw JWT for backend calls
  }

  // Extend the User object returned by providers (e.g., Google)
  interface User extends DefaultUser {
    role?: string;
    accessToken?: string;
    wallet_address?: string | null;
    google_sub?: string; // Add google_sub to the User object
  }
}

declare module "next-auth/jwt" {
  // Extend the token payload
  interface JWT extends DefaultJWT {
    id?: string;
    role?: string;
    accessToken?: string;
    wallet_address?: string | null;
    allow_email_checkins?: boolean;
    google_sub?: string; // Add google_sub to the JWT token
  }
}

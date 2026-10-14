/** Google OAuth 2.0 (authorization-code flow). Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. */
export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const redirectUri = (origin: string) => `${process.env.APP_URL ?? origin}/api/auth/google/callback`;

/** Only same-site relative paths are allowed as post-login destinations (prevents open redirects). */
export const safeNext = (n: string | null | undefined) =>
  n && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : null;

export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

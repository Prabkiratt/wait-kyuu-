import type { NextConfig } from "next";

/**
 * The frontend (Vercel) never touches the database. All /api/* traffic is proxied to the API server (Render),
 * which keeps requests same-origin for the browser: first-party cookies, no CORS, Google OAuth callback on this domain.
 * Live streams (SSE) go straight to the API host via NEXT_PUBLIC_API_URL (see src/lib/client.ts).
 */
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;

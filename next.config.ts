import type { NextConfig } from "next";
const config: NextConfig = {
  distDir:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "demo-skillspring"
      ? ".next-demo"
      : ".next",
  devIndicators: false,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  // Vercel's CJS instrumentation cannot require jose's ESM entry point.
  // Bundle the Auth verification chain; keep native/gRPC libraries external.
  transpilePackages: ["firebase-admin", "jwks-rsa", "jose"],
  serverExternalPackages: [
    "@google-cloud/firestore",
    "@google-cloud/storage",
    "sharp",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com; frame-src https://*.firebaseapp.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
                .replace(
                  "script-src 'self'",
                  process.env.NODE_ENV === "development"
                    ? "script-src 'self' 'unsafe-eval'"
                    : "script-src 'self'",
                )
                .replace(
                  "connect-src 'self'",
                  process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL
                    ? "connect-src 'self' http://127.0.0.1:9101 ws://localhost:*"
                    : "connect-src 'self'",
                ),
          },
        ],
      },
    ];
  },
};
export default config;

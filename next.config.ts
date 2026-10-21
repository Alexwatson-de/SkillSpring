import type { NextConfig } from "next";
const config: NextConfig = {
  distDir:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "demo-skillspring"
      ? ".next-demo"
      : ".next",
  devIndicators: false,
  poweredByHeader: false,
  serverExternalPackages: ["firebase-admin", "sharp"],
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
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com http://127.0.0.1:9101; frame-src https://*.firebaseapp.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};
export default config;

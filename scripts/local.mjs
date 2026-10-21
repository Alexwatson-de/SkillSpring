// Isolated local mode. Never silently connects to the real project.
import { spawn } from "node:child_process";
const command = process.argv[2] || "dev";
const env = {
  ...process.env,
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-skillspring.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-skillspring",
  NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
  FIREBASE_PROJECT_ID: "demo-skillspring",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9101",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9101",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8101",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3011",
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_API_KEY: "",
  CLOUDINARY_API_SECRET: "",
  GOOGLE_APPLICATION_CREDENTIALS: "",
  FIREBASE_SERVICE_ACCOUNT_JSON: "",
};
const executable =
  command === "seed" ? "tsx" : command === "test" ? "vitest" : "next";
const args =
  command === "seed"
    ? ["scripts/seed-local.ts"]
    : command === "test"
      ? ["run", ...process.argv.slice(3)]
      : command === "build"
        ? ["build", "--webpack"]
        : command === "start"
          ? ["start", "--port", "3011"]
          : ["dev", "--port", "3011"];
const p = spawn(`./node_modules/.bin/${executable}`, args, {
  env,
  stdio: "inherit",
});
process.on("SIGTERM", () => p.kill("SIGTERM"));
process.on("SIGINT", () => p.kill("SIGINT"));
p.on("exit", (code) => process.exit(code || 0));

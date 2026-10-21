"use client";
import { initializeApp, getApps } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
let emulatorConnected = false;
export function auth() {
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
    throw new Error(
      "Firebase web configuration is missing. Add the variables from .env.example.",
    );
  const app =
    getApps()[0] ||
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  const a = getAuth(app);
  if (
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL &&
    !emulatorConnected
  ) {
    connectAuthEmulator(a, process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL, {
      disableWarnings: true,
    });
    emulatorConnected = true;
  }
  return a;
}

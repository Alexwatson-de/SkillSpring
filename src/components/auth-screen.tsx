"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { ArrowUpRight, Sprout, Check } from "lucide-react";
import { auth } from "@/lib/firebase";
import { blankProfile } from "@/lib/model";
import { api, useSession } from "./provider";
import { Brand, ErrorBox } from "./ui";
export function AuthScreen({ mode }: { mode: "login" | "signup" | "reset" }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const signup = mode === "signup";
  const reset = mode === "reset";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const email = String(f.get("email")).trim();
      const password = String(f.get("password") || "");
      if (reset) {
        await sendPasswordResetEmail(auth(), email);
        setSuccess(
          "If an account exists, you’ll receive password-reset instructions. Check your inbox and spam folder.",
        );
      } else if (signup) {
        const name = String(f.get("name")).trim();
        const c = await createUserWithEmailAndPassword(auth(), email, password);
        await updateProfile(c.user, { displayName: name });
        const p = blankProfile(name);
        p.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await api("", { action: "profile", profile: p });
        try {
          await sendEmailVerification(c.user);
        } catch {
          setSuccess(
            "Account created. You can resend verification from your dashboard.",
          );
        }
        await refresh();
        router.push("/onboarding");
      } else {
        await signInWithEmailAndPassword(auth(), email, password);
        await refresh();
        router.push("/dashboard");
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        code === "auth/invalid-credential"
          ? "Email or password is incorrect."
          : code === "auth/email-already-in-use"
            ? "An account already exists with this email. Try signing in."
            : code === "auth/too-many-requests"
              ? "Too many attempts. Please wait before trying again."
              : code === "auth/weak-password"
                ? "Use at least 10 characters with a mix of letters and numbers."
                : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page" id="main">
      <div className="auth-side">
        <Brand />
        <div>
          <span className="eyebrow">A LITTLE GIVE. A LOT OF GROWTH.</span>
          <h1>
            Somewhere,
            <br />
            someone needs
            <br />
            <em>
              your kind
              <br />
              of brilliant.
            </em>
          </h1>
          <p>
            Bring what you know.
            <br />
            Leave with a little more.
          </p>
        </div>
        <span className="auth-flower">
          <Sprout size={110} />
        </span>
        <small>Knowledge is better shared.</small>
      </div>
      <section className="auth-form">
        <Link href="/" className="text-link">
          ← Back to SkillSpring
        </Link>
        <div>
          <p className="eyebrow">
            {signup
              ? "YOUR NEXT CHAPTER"
              : reset
                ? "LET’S GET YOU BACK IN"
                : "GOOD TO SEE YOU AGAIN"}
          </p>
          <h2>
            {signup
              ? "Grow from here."
              : reset
                ? "Forgot your password?"
                : "Welcome back."}
          </h2>
          <p>
            {signup
              ? "Make a little room for what’s next."
              : reset
                ? "Enter your email to request a secure reset link."
                : "Your next connection is waiting."}
          </p>
          <form onSubmit={submit}>
            {signup && (
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            {!reset && (
              <label>
                Password
                <input
                  name="password"
                  aria-label="Password"
                  type="password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                  minLength={signup ? 10 : 1}
                  maxLength={128}
                />
                {signup && (
                  <small>At least 10 characters. Use a unique password.</small>
                )}
              </label>
            )}
            {signup && (
              <label className="check">
                <input type="checkbox" required />
                <span>
                  I agree to the <Link href="/terms">Terms</Link> and{" "}
                  <Link href="/privacy">Privacy Policy</Link>.
                </span>
              </label>
            )}
            <ErrorBox message={error} />
            {success && (
              <div className="success" role="status">
                <Check size={18} />
                {success}
              </div>
            )}
            <button className="button full" disabled={busy}>
              {busy
                ? "One moment…"
                : signup
                  ? "Create your account"
                  : reset
                    ? "Send reset instructions"
                    : "Log in"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          {!reset && (
            <p className="auth-switch">
              {signup ? "Already part of the community?" : "New here?"}{" "}
              <Link href={signup ? "/login" : "/signup"}>
                {signup ? "Log in" : "Create an account"}
              </Link>
            </p>
          )}
          {!signup && (
            <Link
              className="text-link"
              href={reset ? "/login" : "/reset-password"}
            >
              {reset ? "Back to log in" : "Forgot your password?"}
            </Link>
          )}
        </div>
        <small>Your email stays private. Your curiosity is welcome.</small>
      </section>
    </main>
  );
}

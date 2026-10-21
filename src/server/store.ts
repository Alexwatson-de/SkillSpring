import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  type Transaction,
} from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { AppError, requireThat } from "@/lib/domain";
import type { Exchange, Profile } from "@/lib/model";
export function admin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId)
    throw new AppError(
      503,
      "Firebase server configuration is missing. See setup documentation.",
    );
  const existing = getApps().find((a) => a.name === "skillspring");
  return (
    existing ||
    initializeApp(
      {
        projectId,
        ...(!process.env.FIRESTORE_EMULATOR_HOST
          ? {
              credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
                ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
                : applicationDefault(),
            }
          : {}),
      },
      "skillspring",
    )
  );
}
export function db() {
  return getFirestore(admin());
}
// Dedicated namespace: never touch Forum or another application's collections.
export const table = (name: string) =>
  db().collection("skillspring").doc("main").collection(name);
export const stamp = () => FieldValue.serverTimestamp();
export async function identity(req: Request, optional = false) {
  const bearer = req.headers.get("authorization");
  if (!bearer && optional) return null;
  requireThat(bearer && bearer.startsWith("Bearer "), "Please sign in", 401);
  try {
    return await getAuth(admin()).verifyIdToken(bearer.slice(7), true);
  } catch {
    throw new AppError(401, "Your session expired. Please sign in again.");
  }
}
export async function member(req: Request) {
  const token = await identity(req);
  requireThat(token, "Sign in required", 401);
  const a = await table("accounts").doc(token.uid).get();
  requireThat(
    !["suspended", "deleted", "deleting"].includes(a.data()?.state),
    "This SkillSpring account is unavailable",
    403,
  );
  return {
    uid: token.uid,
    verified: token.email_verified === true,
    account: a.data(),
    token,
  };
}
export async function administrator(req: Request, owner = false) {
  const u = await member(req);
  requireThat(u.verified, "Verify your email first", 403);
  requireThat(
    owner
      ? u.account?.role === "owner"
      : ["admin", "owner"].includes(u.account?.role),
    "Administrator access required",
    403,
  );
  return u;
}
export function id(value: unknown) {
  requireThat(
    typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value),
    "Invalid record ID",
  );
  return value;
}
export const blockKey = (a: string, b: string) =>
  createHash("sha256").update([a, b].sort().join("|")).digest("hex");
export async function assertNotBlocked(a: string, b: string, t?: Transaction) {
  const ref = table("blocks").doc(blockKey(a, b));
  const s = t ? await t.get(ref) : await ref.get();
  requireThat(
    !s.exists || !s.data()?.blockers?.length,
    "Contact between these accounts is blocked",
    403,
  );
}
export async function participant(
  exchangeId: string,
  uid: string,
  t?: Transaction,
) {
  const ref = table("exchanges").doc(id(exchangeId));
  if (t) {
    const account = await t.get(table("accounts").doc(uid));
    requireThat(
      account.data()?.state === "active",
      "SkillSpring account is unavailable",
      403,
    );
  }
  const s = t ? await t.get(ref) : await ref.get();
  const e = s.data() as Exchange | undefined;
  requireThat(
    e &&
      e.participants.includes(uid) &&
      (e.status !== "draft" || e.sender === uid),
    "Exchange not found",
    404,
  );
  return { ref, e: { ...e, id: s.id } };
}
export function notify(
  t: Transaction,
  uid: string,
  title: string,
  href: string,
) {
  t.set(table("notifications").doc(), {
    uid,
    title,
    href,
    read: false,
    createdAt: Date.now(),
    serverCreatedAt: stamp(),
  });
}
export async function rate(uid: string, action: string, limit = 30) {
  const ref = table("limits").doc(
    createHash("sha256").update(`${uid}:${action}`).digest("hex"),
  );
  await db().runTransaction(async (t) => {
    const s = await t.get(ref);
    const d = s.data();
    const now = Date.now();
    requireThat(
      !d || d.reset < now || d.count < limit,
      "Too many attempts. Please wait a minute.",
      429,
    );
    t.set(ref, {
      count: d && d.reset > now ? d.count + 1 : 1,
      reset: d && d.reset > now ? d.reset : now + 60000,
      expiresAt: new Date(now + 86400000),
    });
  });
}
export function audit(
  t: Transaction,
  uid: string,
  action: string,
  target: string,
) {
  t.set(table("audit").doc(), {
    actor: uid,
    action,
    target,
    createdAt: Date.now(),
    serverCreatedAt: stamp(),
  });
}
export async function getProfile(uid: string, t?: Transaction) {
  const r = table("people").doc(id(uid));
  const s = t ? await t.get(r) : await r.get();
  const p = s.data() as Profile | undefined;
  requireThat(p && p.state === "active", "Member not found", 404);
  return { ...p, id: s.id };
}
export function clean<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_k, v) =>
      v && typeof v === "object" && typeof v.toMillis === "function"
        ? v.toMillis()
        : v,
    ),
  );
}

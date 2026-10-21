// Initializes taxonomy/settings and app-scoped owner membership only.
// Does not create/change an existing Firebase password or publish demo users.
import { loadEnvConfig } from "@next/env";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { admin, db, table } from "../src/server/store";
import { catalog, defaultSettings } from "../src/lib/model";
import { normalize } from "../src/lib/domain";
loadEnvConfig(process.cwd());
async function main() {
  if (
    process.env.CONFIRM_PROJECT !== "forum-d1133" ||
    process.env.FIREBASE_PROJECT_ID !== "forum-d1133" ||
    process.env.FIRESTORE_EMULATOR_HOST
  )
    throw new Error("Explicit real-project confirmation required");
  const raw = execFileSync("firebase", ["login:list", "--json"], {
    encoding: "utf8",
  });
  const cli = JSON.parse(raw.slice(raw.indexOf("{"))).result[0];
  let owner;
  try {
    owner = await getAuth(admin()).getUserByEmail(cli.user.email);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
    const r = await fetch(
      "https://identitytoolkit.googleapis.com/v1/projects/forum-d1133/accounts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cli.tokens.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cli.user.email,
          displayName: cli.user.displayName || "Platform owner",
          emailVerified: false,
        }),
      },
    );
    if (!r.ok) throw new Error(`Owner creation denied: ${r.status}`);
    const created = await r.json();
    owner = await getAuth(admin()).getUser(created.localId);
    const setup = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email: owner.email,
        }),
      },
    );
    console.log(
      "Created initial owner identity without a default password. Setup-email request:",
      setup.status,
    );
  }
  const settings = table("settings").doc("public");
  const s = await settings.get();
  if (!s.exists) await settings.create(defaultSettings);
  const groups: Record<string, string> = {
    React: "Programming",
    JavaScript: "Programming",
    TypeScript: "Programming",
    Python: "Programming",
    "Data analysis": "Data & AI",
    "Machine learning": "Data & AI",
    "UI/UX design": "Design",
    Figma: "Design",
    "Brand strategy": "Marketing",
    Entrepreneurship: "Business",
    "Digital marketing": "Marketing",
    Accounting: "Finance",
    English: "Languages",
    Spanish: "Languages",
    Photography: "Photography & Video",
    "Video editing": "Photography & Video",
    Guitar: "Music",
    Piano: "Music",
    "Creative writing": "Writing",
    "Public speaking": "Career",
    "Interview preparation": "Career",
    Excel: "Productivity",
  };
  for (const name of catalog) {
    const r = table("skills").doc(
      createHash("sha256").update(normalize(name)).digest("hex"),
    );
    if (!(await r.get()).exists)
      await r.create({
        name,
        category: groups[name] || "Other",
        status: "approved",
        createdAt: Date.now(),
      });
  }
  await db().runTransaction(async (t) => {
    const r = table("accounts").doc(owner.uid);
    const old = await t.get(r);
    t.set(
      r,
      {
        uid: owner.uid,
        name: owner.displayName || "Platform owner",
        email: owner.email,
        role: "owner",
        state: "active",
        createdAt: old.data()?.createdAt || Date.now(),
      },
      { merge: true },
    );
    t.create(table("audit").doc(), {
      actor: owner.uid,
      action: "bootstrap.owner",
      target: owner.uid,
      createdAt: Date.now(),
    });
  });
  console.log(
    "Initialized 22 catalog entries and settings. Existing Firebase user granted SkillSpring-only owner role:",
    owner.email,
  );
  console.log(
    "Existing password, email verification, public profile and other applications were not changed.",
  );
}
main().catch((e) => {
  console.error("Initialization failed:", e.code || e.message);
  process.exitCode = 1;
});

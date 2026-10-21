// Controlled live-service integration test. Creates only uniquely named synthetic
// accounts in the authorized project, and removes their application/auth records.
// Never logs passwords, bearer tokens, verification links, or credentials.
import { loadEnvConfig } from "@next/env";
import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import sharp from "sharp";
import { table, db } from "../src/server/store";
import { blankProfile, blankSkill } from "../src/lib/model";
import { eraseUser } from "../src/server/maintenance";
loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL || "http://localhost:3012";
const project = "forum-d1133";
const fixtures: {
  uid: string;
  token: string;
  email: string;
  password: string;
}[] = [];
let oauth = "";
let exchangeId = "";
let checks = 0;
function check(value: unknown, label: string) {
  if (!value) throw new Error(label);
  checks++;
  console.log("PASS:", label);
}
async function ownerApi(method: string, payload: unknown) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:${method}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oauth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!r.ok)
    throw new Error(`Synthetic auth fixture operation failed (${r.status})`);
  return r.json();
}
async function data(who: number | undefined, body?: unknown, query = "") {
  const r = await fetch(`${base}/api/data${query ? "?" + query : ""}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(who === undefined
        ? {}
        : { Authorization: `Bearer ${fixtures[who].token}` }),
      ...(body
        ? { "Content-Type": "application/json", Origin: new URL(base).origin }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  return { status: r.status, data: d };
}
async function main() {
  if (
    process.env.CONFIRM_PROJECT !== project ||
    process.env.FIREBASE_PROJECT_ID !== project ||
    process.env.FIRESTORE_EMULATOR_HOST
  )
    throw new Error(
      "Explicit production-project confirmation required; no emulator mixing",
    );
  execFileSync("firebase", ["apps:list", "--project", project, "--json"], {
    stdio: "pipe",
  });
  const raw = execFileSync("firebase", ["login:list", "--json"], {
    encoding: "utf8",
  });
  oauth = JSON.parse(raw.slice(raw.indexOf("{"))).result[0].tokens.access_token;
  const run = randomUUID().slice(0, 8);
  try {
    for (let i = 0; i < 2; i++) {
      const email = `skillspring-qa-${run}-${i}@example.test`;
      const password = randomBytes(24).toString("base64url");
      const signup = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      );
      const s = await signup.json();
      check(signup.ok, `Live email/password registration ${i + 1}`);
      fixtures.push({ uid: s.localId, token: s.idToken, email, password });
      await ownerApi("update", { localId: s.localId, emailVerified: true });
      const login = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      );
      fixtures[i].token = (await login.json()).idToken;
      check(login.ok, `Live password login ${i + 1}`);
      const p = {
        ...blankProfile(`Synthetic QA ${run} ${i}`),
        bio: "Synthetic integration test profile; removed after verification.",
        headline: "Temporary QA fixture",
        role: "QA tester",
        summary: "Not a genuine community member.",
        offered: [
          {
            ...blankSkill,
            name: i ? "Figma" : "React",
            level: "Advanced",
            description: "Synthetic skill for verifying the exchange workflow.",
          },
        ],
        wanted: [{ ...blankSkill, name: i ? "React" : "Figma" }],
        publicProfile: true,
      };
      const saved = await data(i, {
        action: "profile",
        profile: p,
        finish: true,
      });
      check(
        saved.status === 200,
        `Live Firestore profile persistence ${i + 1}`,
      );
    }
    const matches = await data(0, undefined, "kind=matches");
    check(
      matches.status === 200 &&
        matches.data.items.some(
          (v: { id: string; match: { reciprocal: boolean } }) =>
            v.id === fixtures[1].uid && v.match.reciprocal,
        ),
      "Live reciprocal match query",
    );
    const r = await data(0, {
      action: "request",
      request: {
        recipient: fixtures[1].uid,
        learn: "Figma",
        offer: "React",
        arrangement: "Reciprocal",
        goals: "Verify a real persisted exchange between synthetic accounts",
        format: "Online",
        schedule: "UTC",
        message: "Temporary integration test",
        duration: 30,
        draft: false,
      },
    });
    check(r.status === 200, "Live request transaction");
    exchangeId = r.data.id;
    check(
      (
        await data(0, {
          action: "transition",
          id: exchangeId,
          status: "accepted",
        })
      ).status === 403,
      "Sender cannot self-accept",
    );
    check(
      (
        await data(1, {
          action: "transition",
          id: exchangeId,
          status: "accepted",
        })
      ).status === 200,
      "Recipient accepts live request",
    );
    check(
      (
        await data(0, {
          action: "message",
          id: exchangeId,
          text: "Synthetic private message to verify live persistence.",
        })
      ).status === 200,
      "Live private message",
    );
    const workspace = await data(
      1,
      undefined,
      `kind=exchange&id=${exchangeId}`,
    );
    check(
      workspace.status === 200 && workspace.data.messages.length === 1,
      "Participant reads live conversation",
    );
    check(
      (await data(undefined, undefined, `kind=exchange&id=${exchangeId}`))
        .status === 401,
      "Anonymous conversation denied",
    );
    check(
      (await data(0, undefined, "kind=admin")).status === 403,
      "Live non-admin denied",
    );
    const session = {
      title: "Synthetic test session",
      local: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      timezone: "UTC",
      duration: 30,
      format: "Online",
      link: "https://example.com/test",
      location: "",
      notes: "Synthetic session, not a real meeting",
    };
    check(
      (await data(0, { action: "session", id: exchangeId, session })).status ===
        200,
      "Live session proposal",
    );
    const sessions = await table("exchanges")
      .doc(exchangeId)
      .collection("sessions")
      .get();
    const sid = sessions.docs[0].id;
    check(
      (
        await data(1, {
          action: "sessionStatus",
          id: exchangeId,
          sessionId: sid,
          status: "scheduled",
        })
      ).status === 200,
      "Live mutual schedule confirmation",
    );
    // Trusted clock fixture only on the uniquely created synthetic session.
    await sessions.docs[0].ref.update({ startsAt: Date.now() - 7200000 });
    check(
      (
        await data(0, {
          action: "sessionStatus",
          id: exchangeId,
          sessionId: sid,
          status: "completed",
        })
      ).status === 200,
      "Elapsed synthetic session completion",
    );
    check(
      (await data(0, { action: "complete", id: exchangeId })).status === 200,
      "First completion vote",
    );
    check(
      (await data(1, { action: "complete", id: exchangeId })).status === 200,
      "Second completion vote",
    );
    const review = {
      rating: 5,
      text: "Synthetic test review; removed immediately after verification.",
      communication: 5,
      preparation: 5,
      helpfulness: 5,
    };
    check(
      (await data(0, { action: "review", id: exchangeId, review })).status ===
        200,
      "Live eligible review",
    );
    check(
      (await data(0, { action: "review", id: exchangeId, review })).status ===
        409,
      "Live duplicate review denied",
    );
    const bad = new FormData();
    bad.set(
      "file",
      new Blob(["<svg><script>alert(1)</script></svg>"], { type: "image/png" }),
      "fake.png",
    );
    const rejected = await fetch(`${base}/api/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fixtures[0].token}`,
        Origin: new URL(base).origin,
      },
      body: bad,
    });
    check(
      rejected.status === 400,
      "Cloudinary upload rejects spoofed image bytes",
    );
    const bytes = await sharp({
      create: { width: 96, height: 96, channels: 3, background: "#245d43" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.set(
      "file",
      new Blob([new Uint8Array(bytes)], { type: "image/png" }),
      "synthetic.png",
    );
    const uploaded = await fetch(`${base}/api/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fixtures[0].token}`,
        Origin: new URL(base).origin,
      },
      body: form,
    });
    const image = await uploaded.json();
    check(
      uploaded.status === 200,
      "Authenticated actual Cloudinary binary upload",
    );
    const delivery = await fetch(image.url);
    check(
      delivery.ok && delivery.headers.get("content-type")?.startsWith("image/"),
      "Actual optimized image delivery",
    );
    const direct = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/skillspring/main/accounts/${fixtures[1].uid}?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      { headers: { Authorization: `Bearer ${fixtures[0].token}` } },
    );
    check(direct.status === 403, "Live direct database access denied");
    console.log(`Live integration checks passed: ${checks}.`);
  } finally {
    for (const f of fixtures) {
      if (!f.email.startsWith(`skillspring-qa-${run}-`))
        throw new Error("Cleanup scope mismatch");
      const p = await table("people").doc(f.uid).get();
      await table("deletions")
        .doc(f.uid)
        .set({
          uid: f.uid,
          state: "pending",
          createdAt: Date.now(),
          photoId: p.data()?.photoId || "",
        });
      await eraseUser(f.uid);
      if (p.data()?.username)
        await table("handles").doc(p.data()!.username).delete();
      await table("people").doc(f.uid).delete();
      await table("accounts").doc(f.uid).delete();
      await table("deletions").doc(f.uid).delete();
      await ownerApi("delete", { localId: f.uid });
    }
    if (exchangeId) {
      const reviews = await table("reviews")
        .where("exchange", "==", exchangeId)
        .get();
      for (const d of reviews.docs) await d.ref.delete();
      await db().recursiveDelete(table("exchanges").doc(exchangeId));
    }
    console.log(
      "Synthetic accounts, profiles, exchange data, reviews and uploaded avatar cleaned up.",
    );
  }
}
main().catch((e) => {
  console.error("Live verification failed:", e.message);
  process.exitCode = 1;
});

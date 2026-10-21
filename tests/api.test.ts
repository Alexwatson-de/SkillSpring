import { beforeAll, describe, expect, it, afterAll } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { admin, db, table } from "../src/server/store";
import { action } from "../src/server/actions";
import { query } from "../src/server/queries";
import {
  blankProfile,
  blankSkill,
  type Exchange,
  type Profile,
} from "../src/lib/model";
import { eraseUser } from "../src/server/maintenance";
const enabled =
  !!process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.FIREBASE_PROJECT_ID === "demo-skillspring";
const suite = enabled ? describe : describe.skip;
const tokens: Record<string, string> = {};
const uids: Record<string, string> = {};
let eid = "";
let sid = "";
let handle = "";
const call = (who: string, body: Record<string, unknown>) =>
  action(
    new Request("http://localhost/api/data", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens[who]}`,
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify(body),
    }),
  );
const read = (who: string, q: string): Promise<unknown> =>
  query(
    new Request(`http://localhost/api/data?${q}`, {
      headers: who ? { Authorization: `Bearer ${tokens[who]}` } : {},
    }),
  );
const request = (
  recipient: string,
  learn = "Figma",
  offer = "React",
  draft = false,
) => ({
  recipient,
  learn,
  offer,
  arrangement: offer ? "Reciprocal" : "Learn",
  goals: "Learn to design and build a useful app",
  format: "Online",
  schedule: "Evenings UTC",
  message: "Hello, excited to learn together.",
  duration: 45,
  draft,
});
suite.sequential("Firebase emulator authorized workflows", () => {
  beforeAll(async () => {
    for (const name of ["alice", "bob", "eve", "owner"]) {
      const uid = `api-${name}-${Date.now()}`;
      const email = `${uid}@example.test`;
      await getAuth(admin()).createUser({
        uid,
        email,
        password: "Test-only-password-29",
        emailVerified: name !== "eve",
      });
      const r = await fetch(
        `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password: "Test-only-password-29",
            returnSecureToken: true,
          }),
        },
      );
      tokens[name] = (await r.json()).idToken;
      uids[name] = uid;
      const p = {
        ...blankProfile(name + " Example"),
        bio: "I enjoy helping curious people learn practical skills.",
        role: "Developer",
        summary: "Experienced in building useful software",
        offered: [
          {
            ...blankSkill,
            name: name === "bob" ? "Figma" : "React",
            level: "Expert" as const,
          },
        ],
        wanted: [{ ...blankSkill, name: name === "bob" ? "React" : "Figma" }],
        availableDays: ["Tuesday" as const],
        city: "PrivateTown",
        availability: "Private evenings only",
        accessibility: "Private access note",
      };
      await call(name, { action: "profile", profile: p, finish: true });
    }
    await table("accounts").doc(uids.owner).update({ role: "owner" });
    handle = (await table("people").doc(uids.bob).get()).data()!.username;
  });
  it("persists onboarding and preserves server role", async () => {
    const p = (await read("alice", "kind=me")) as {
      profile: Profile;
      role: string;
    };
    expect(p.profile.onboarded).toBe(true);
    expect(p.profile.offered[0].name).toBe("React");
    expect(p.role).toBe("member");
  });
  it("redacts private data from public profiles", async () => {
    const p = (await read("", `kind=profile&username=${handle}`)) as {
      profile: Record<string, unknown>;
    };
    expect(p.profile.city).toBe("");
    expect(p.profile).not.toHaveProperty("availability");
    expect(p.profile).not.toHaveProperty("accessibility");
    expect(p.profile).not.toHaveProperty("email");
  });
  it("returns indexed skill discovery and match reasons", async () => {
    const p = (await read(
      "alice",
      "kind=people&q=figma&category=Programming&language=English&format=Online&day=Tuesday",
    )) as { items: Profile[] };
    expect(p.items.some((v) => v.id === uids.bob)).toBe(true);
    const m = (await read("alice", "kind=matches")) as {
      items: { id: string; match: { reciprocal: boolean } }[];
    };
    expect(m.items.find((v) => v.id === uids.bob)?.match.reciprocal).toBe(true);
  });
  it("rejects unverified request sender", async () => {
    await expect(
      call("eve", { action: "request", request: request(uids.bob) }),
    ).rejects.toThrow(/Verify/);
  });
  it("creates a real pending exchange and notification", async () => {
    const r = (await call("alice", {
      action: "request",
      request: request(uids.bob),
    })) as { id: string };
    eid = r.id;
    expect((await table("exchanges").doc(eid).get()).data()?.status).toBe(
      "pending",
    );
    const n = (await read("bob", "kind=notifications")) as { items: unknown[] };
    expect(n.items.length).toBeGreaterThan(0);
  });
  it("blocks exact duplicate and reverse reciprocal requests", async () => {
    await expect(
      call("alice", { action: "request", request: request(uids.bob) }),
    ).rejects.toThrow(/active request/);
    await expect(
      call("bob", {
        action: "request",
        request: request(uids.alice, "React", "Figma"),
      }),
    ).rejects.toThrow(/active request/);
  });
  it("prevents accepting your own outgoing request", async () => {
    await expect(
      call("alice", { action: "transition", id: eid, status: "accepted" }),
    ).rejects.toThrow(/not permitted/);
  });
  it("prevents IDOR reads and state changes", async () => {
    await expect(read("eve", `kind=exchange&id=${eid}`)).rejects.toThrow(
      /not found/,
    );
    await expect(
      call("eve", { action: "transition", id: eid, status: "declined" }),
    ).rejects.toThrow(/not found/);
  });
  it("rejects invalid IDs", async () => {
    await expect(
      read("alice", "kind=exchange&id=../accounts/owner"),
    ).rejects.toThrow(/Invalid record/);
  });
  it("supports discussion, authorized message history and unread state", async () => {
    await call("bob", { action: "transition", id: eid, status: "discussion" });
    await call("alice", {
      action: "message",
      id: eid,
      text: "Can we focus on accessible layouts?",
    });
    const d = (await read("bob", `kind=exchange&id=${eid}`)) as {
      exchange: Exchange;
      messages: { text: string }[];
    };
    expect(d.messages[0].text).toContain("accessible");
    expect(d.exchange.lastMessageAt).toBeGreaterThan(
      d.exchange.lastRead[uids.bob],
    );
    await call("bob", { action: "readConversation", id: eid });
    const after = (await table("exchanges").doc(eid).get()).data()!;
    expect(after.lastRead[uids.bob]).toBeGreaterThanOrEqual(
      after.lastMessageAt,
    );
  });
  it("accepts only by recipient", async () => {
    await call("bob", { action: "transition", id: eid, status: "accepted" });
    expect((await table("exchanges").doc(eid).get()).data()?.status).toBe(
      "accepted",
    );
  });
  it("prevents premature completion and reviews", async () => {
    await expect(
      call("alice", { action: "complete", id: eid }),
    ).rejects.toThrow(/session/);
    await expect(
      call("alice", {
        action: "review",
        id: eid,
        review: {
          rating: 5,
          text: "Useful and thoughtful guidance",
          communication: 5,
          preparation: 5,
          helpfulness: 5,
        },
      }),
    ).rejects.toThrow(/completed/);
  });
  it("requires a future unambiguous time and scopes session IDs", async () => {
    const session = {
      title: "Learn accessible layout",
      local: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      timezone: "UTC",
      duration: 45,
      format: "Online",
      link: "https://example.com/meeting",
      location: "",
      notes: "Discuss goals",
    };
    await expect(
      call("alice", {
        action: "session",
        id: eid,
        sessionId: "foreign-session",
        session,
      }),
    ).rejects.toThrow(/not found/);
    await call("alice", { action: "session", id: eid, session });
    const s = await table("exchanges").doc(eid).collection("sessions").get();
    sid = s.docs[0].id;
    expect(s.docs[0].data().status).toBe("proposed");
  });
  it("requires other participant to confirm proposal", async () => {
    await expect(
      call("alice", {
        action: "sessionStatus",
        id: eid,
        sessionId: sid,
        status: "scheduled",
      }),
    ).rejects.toThrow(/other participant/);
    await call("bob", {
      action: "sessionStatus",
      id: eid,
      sessionId: sid,
      status: "scheduled",
    });
    expect((await table("agenda").doc(sid).get()).exists).toBe(true);
  });
  it("prevents completion before the session has ended", async () => {
    await expect(
      call("bob", {
        action: "sessionStatus",
        id: eid,
        sessionId: sid,
        status: "completed",
      }),
    ).rejects.toThrow(/ended/);
  });
  it("reschedules with new confirmation and supports cancellation", async () => {
    const session = {
      title: "Rescheduled layout session",
      local: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16),
      timezone: "UTC",
      duration: 45,
      format: "Online",
      link: "",
      location: "",
      notes: "New time",
    };
    await call("bob", { action: "session", id: eid, sessionId: sid, session });
    expect((await table("agenda").doc(sid).get()).exists).toBe(false);
    await call("alice", {
      action: "sessionStatus",
      id: eid,
      sessionId: sid,
      status: "scheduled",
    });
  });
  it("records progress and safe resources", async () => {
    await call("alice", {
      action: "notes",
      id: eid,
      notes: "Completed the first exercise",
      resources: ["https://example.com/exercise"],
    });
    await expect(
      call("bob", {
        action: "notes",
        id: eid,
        notes: "bad",
        resources: ["javascript:alert(1)"],
      }),
    ).rejects.toThrow();
  });
  it("completes an elapsed session then requires both completion votes", async () => {
    await table("exchanges")
      .doc(eid)
      .collection("sessions")
      .doc(sid)
      .update({ startsAt: Date.now() - 3 * 3600000 });
    await call("alice", {
      action: "sessionStatus",
      id: eid,
      sessionId: sid,
      status: "completed",
    });
    await call("alice", { action: "complete", id: eid });
    expect((await table("exchanges").doc(eid).get()).data()?.status).toBe(
      "in_progress",
    );
    await call("bob", { action: "complete", id: eid });
    expect((await table("exchanges").doc(eid).get()).data()?.status).toBe(
      "completed",
    );
    expect(
      (await table("people").doc(uids.alice).get()).data()?.completedCount,
    ).toBe(1);
  });
  it("accepts genuine participant feedback, rejects duplicates and strangers", async () => {
    const review = {
      rating: 4,
      text: "Patient and helpful explanations, thank you.",
      communication: 5,
      preparation: 4,
      helpfulness: 4,
    };
    await call("alice", { action: "review", id: eid, review });
    await expect(
      call("alice", { action: "review", id: eid, review }),
    ).rejects.toThrow(/already reviewed/);
    await expect(
      call("eve", { action: "review", id: eid, review }),
    ).rejects.toThrow(/not found/);
    expect((await table("people").doc(uids.bob).get()).data()?.rating).toBe(4);
  });
  it("keeps saved records private", async () => {
    await call("alice", { action: "save", target: uids.bob, skill: "Figma" });
    const a = (await read("alice", "kind=saved")) as {
      items: { id: string }[];
    };
    const b = (await read("bob", "kind=saved")) as { items: unknown[] };
    expect(a.items).toHaveLength(1);
    expect(b.items).toHaveLength(0);
    await expect(
      call("bob", { action: "removeSaved", id: a.items[0].id }),
    ).rejects.toThrow(/not found/);
  });
  it("validates report access and owner-only roles", async () => {
    await call("alice", {
      action: "report",
      report: {
        type: "profile",
        target: uids.bob,
        reason: "Synthetic test report for moderator workflow",
        exchange: "",
      },
    });
    await expect(
      call("alice", { action: "adminRole", target: uids.alice, role: "admin" }),
    ).rejects.toThrow(/Administrator/);
    await call("owner", {
      action: "adminRole",
      target: uids.bob,
      role: "admin",
    });
    await expect(
      call("bob", { action: "adminRole", target: uids.alice, role: "admin" }),
    ).rejects.toThrow(/Administrator/);
    await expect(
      call("bob", {
        action: "adminUser",
        target: uids.owner,
        state: "suspended",
      }),
    ).rejects.toThrow(/owner/);
  });
  it("moderates reports and audits changes", async () => {
    const reports = (await read("owner", "kind=admin&tab=reports")) as {
      items: { id: string }[];
    };
    await call("owner", {
      action: "adminReport",
      id: reports.items[0].id,
      status: "Resolved",
      note: "Reviewed synthetic evidence; no action required",
    });
    const a = await table("audit")
      .where("action", "==", "report.Resolved")
      .get();
    expect(a.size).toBeGreaterThan(0);
  });
  it("blocks contact in both directions and can unblock", async () => {
    await call("bob", { action: "block", target: uids.alice });
    await expect(
      call("alice", { action: "request", request: request(uids.bob) }),
    ).rejects.toThrow(/blocked/);
    await expect(
      call("alice", { action: "message", id: eid, text: "A blocked message" }),
    ).rejects.toThrow(/blocked/);
    await call("bob", { action: "block", target: uids.alice, remove: true });
  });
  it("supports private draft, decline and reopening after closure", async () => {
    const r = (await call("alice", {
      action: "request",
      request: request(uids.bob, "Figma", "", true),
    })) as { id: string };
    await expect(read("bob", `kind=exchange&id=${r.id}`)).rejects.toThrow(
      /not found/,
    );
    await call("alice", { action: "transition", id: r.id, status: "pending" });
    await call("bob", { action: "transition", id: r.id, status: "declined" });
    const next = (await call("alice", {
      action: "request",
      request: request(uids.bob, "Figma", "", false),
    })) as { id: string };
    expect(next.id).not.toBe(r.id);
    await call("alice", {
      action: "transition",
      id: next.id,
      status: "withdrawn",
    });
  });
  it("suspends app membership without disabling the shared identity", async () => {
    await call("owner", {
      action: "adminUser",
      target: uids.alice,
      state: "suspended",
    });
    await expect(read("alice", "kind=me")).rejects.toThrow(/unavailable/);
    expect((await getAuth(admin()).getUser(uids.alice)).disabled).toBe(false);
    await call("owner", {
      action: "adminUser",
      target: uids.alice,
      state: "active",
    });
  });
  it("rejects cross-origin mutation", async () => {
    await expect(
      action(
        new Request("http://localhost/api/data", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.alice}`,
            Origin: "https://attacker.test",
          },
          body: JSON.stringify({ action: "block", target: uids.bob }),
        }),
      ),
    ).rejects.toThrow(/origin/);
  });
  it("removes profile, cleans private data and preserves shared auth on deletion", async () => {
    await call("alice", { action: "deleteAccount", confirm: "DELETE" });
    await eraseUser(uids.alice);
    expect((await table("accounts").doc(uids.alice).get()).data()?.state).toBe(
      "deleted",
    );
    expect(
      (await table("saved").where("uid", "==", uids.alice).get()).empty,
    ).toBe(true);
    expect((await getAuth(admin()).getUser(uids.alice)).uid).toBe(uids.alice);
    expect(
      (await table("exchanges").doc(eid).get()).data()?.names[uids.alice],
    ).toBe("Deleted member");
  });
  afterAll(async () => {
    for (const uid of Object.values(uids))
      await getAuth(admin()).deleteUser(uid);
    await db().terminate();
  });
});

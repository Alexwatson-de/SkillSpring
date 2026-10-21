import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import {
  activeStatuses,
  canTransition,
  normalize,
  requestLock,
  requireThat,
  searchTokens,
  sessionInstant,
} from "@/lib/domain";
import {
  blankProfile,
  profileSchema,
  requestSchema,
  sessionSchema,
  settingsSchema,
  type Session,
  type Status,
} from "@/lib/model";
import {
  administrator,
  assertNotBlocked,
  audit,
  blockKey,
  db,
  getProfile,
  id,
  member,
  notify,
  participant,
  rate,
  stamp,
  table,
} from "./store";
import { eraseUser, runMaintenance } from "./maintenance";
import { readJson } from "./body";
import { assertSameOrigin } from "./origin";
const string = z.string().trim().min(1).max(2000);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function action(req: Request) {
  assertSameOrigin(req);
  const u = await member(req);
  const body = await readJson(req);
  const op = z.string().max(40).parse(body.action);
  await rate(u.uid, op, op === "message" ? 40 : op === "request" ? 8 : 30);
  const now = Date.now();
  if (op === "profile") {
    const p = profileSchema.parse(body.profile);
    const finish = body.finish === true;
    if (finish) {
      requireThat(
        p.offered.length + p.wanted.length > 0,
        "Add a skill to share or learn",
      );
      requireThat(
        p.bio.length >= 10 && p.role.length >= 2,
        "Add a short bio and occupation",
      );
    }
    const ref = table("people").doc(u.uid);
    let username = "";
    await db().runTransaction(async (t) => {
      const s = await t.get(ref);
      const a = await t.get(table("accounts").doc(u.uid));
      requireThat(
        !["suspended", "deleted", "deleting"].includes(a.data()?.state),
        "Account unavailable",
        403,
      );
      username =
        s.data()?.username ||
        `${normalize(p.name)
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 45)}-${hash(u.uid).slice(0, 10)}`;
      const old = s.data();
      const onboarded = old?.onboarded === true || finish;
      t.set(
        ref,
        {
          ...p,
          username,
          id: u.uid,
          photo: old?.photo || "",
          onboarded,
          state: "active",
          createdAt: old?.createdAt || now,
          updatedAt: now,
          lastActive: now,
          tokens: searchTokens({
            ...p,
            city: p.publicLocation ? p.city : "",
            country: p.publicLocation ? p.country : "",
          }),
          offeredKeys: p.offered.map((v) => normalize(v.name)),
          wantedKeys: p.wanted.map((v) => normalize(v.name)),
          serverUpdatedAt: stamp(),
        },
        { merge: true },
      );
      t.set(table("handles").doc(username), { uid: u.uid });
      t.set(
        table("accounts").doc(u.uid),
        {
          uid: u.uid,
          name: p.name,
          email: u.token.email || "",
          role: a.data()?.role || "member",
          state: "active",
          createdAt: a.data()?.createdAt || now,
          lastActive: now,
        },
        { merge: true },
      );
    });
    return { username };
  }
  if (op === "activity") {
    const ref = table("people").doc(u.uid);
    const p = await ref.get();
    if (p.exists && now - (p.data()?.lastActive || 0) > 3600000)
      await ref.update({ lastActive: now });
    return { ok: true };
  }
  if (op === "proposeSkill") {
    requireThat(u.verified, "Verify your email before proposing a skill", 403);
    const d = z
      .object({
        name: z.string().trim().min(2).max(60),
        category: z.string().trim().min(2).max(60),
      })
      .parse(body.skill);
    const key = hash(normalize(d.name));
    await db().runTransaction(async (t) => {
      const ref = table("skills").doc(key);
      const s = await t.get(ref);
      requireThat(!s.exists, "That skill already exists or is under review");
      t.create(ref, {
        ...d,
        status: "pending",
        submittedBy: u.uid,
        createdAt: now,
      });
    });
    return { ok: true };
  }
  if (op === "request") {
    requireThat(u.verified, "Verify your email before contacting members", 403);
    const d = requestSchema.parse(body.request);
    id(d.recipient);
    requireThat(d.recipient !== u.uid, "Choose another member");
    const eid = table("exchanges").doc();
    const lock = requestLock(u.uid, d.recipient, d.learn, d.offer);
    await db().runTransaction(async (t) => {
      const me = await getProfile(u.uid, t);
      const target = await getProfile(d.recipient, t);
      requireThat(
        me.onboarded && target.onboarded && target.publicProfile,
        "Both profiles must be available",
      );
      await assertNotBlocked(u.uid, d.recipient, t);
      const l = await t.get(table("requestLocks").doc(lock));
      requireThat(
        !l.exists,
        "An active request already exists for these skills",
        409,
      );
      if (d.learn)
        requireThat(
          target.offered.some((s) => normalize(s.name) === normalize(d.learn)),
          "Recipient does not offer this skill",
        );
      if (d.offer)
        requireThat(
          me.offered.some((s) => normalize(s.name) === normalize(d.offer)),
          "Add the offered skill to your profile first",
        );
      if (d.arrangement === "Reciprocal")
        requireThat(
          target.arrangement !== "Mentoring",
          "This member prefers one-way mentoring",
        );
      t.create(eid, {
        ...d,
        id: eid.id,
        sender: u.uid,
        recipient: d.recipient,
        participants: [u.uid, d.recipient],
        names: { [u.uid]: me.name, [d.recipient]: target.name },
        status: d.draft ? "draft" : "pending",
        createdAt: now,
        updatedAt: now,
        completionVotes: [],
        lastRead: { [u.uid]: now, [d.recipient]: 0 },
        lock,
        serverCreatedAt: stamp(),
      });
      t.create(table("requestLocks").doc(lock), { exchange: eid.id });
      if (!d.draft)
        notify(
          t,
          d.recipient,
          `${me.name} sent an exchange request`,
          `/exchanges/${eid.id}`,
        );
    });
    return { id: eid.id };
  }
  if (op === "transition" || op === "complete") {
    const eid = id(body.id);
    const next = body.status as Status;
    await db().runTransaction(async (t) => {
      const { ref, e } = await participant(eid, u.uid, t);
      if (!["cancelled", "withdrawn", "declined"].includes(next))
        await assertNotBlocked(e.sender, e.recipient, t);
      if (op === "complete") {
        requireThat(
          ["accepted", "scheduled", "in_progress"].includes(e.status),
          "Exchange is not active",
        );
        requireThat(
          !e.completionVotes.includes(u.uid),
          "You have already confirmed completion",
          409,
        );
        const sessions = await t.get(
          ref
            .collection("sessions")
            .where("status", "==", "completed")
            .limit(1),
        );
        requireThat(
          !sessions.empty,
          "Complete at least one past session first",
        );
        const open = await t.get(
          ref
            .collection("sessions")
            .where("status", "in", ["proposed", "scheduled"])
            .limit(1),
        );
        requireThat(
          open.empty,
          "Complete or cancel remaining sessions before closing the exchange",
        );
        const people = await t.getAll(
          ...e.participants.map((v) => table("people").doc(v)),
        );
        const votes = [...new Set([...e.completionVotes, u.uid])];
        t.update(ref, {
          completionVotes: votes,
          status: votes.length === 2 ? "completed" : e.status,
          updatedAt: now,
          serverUpdatedAt: stamp(),
        });
        if (votes.length === 2) {
          t.delete(table("requestLocks").doc(e.lock));
          people.forEach((p) =>
            t.update(p.ref, {
              completedCount: (p.data()?.completedCount || 0) + 1,
            }),
          );
        }
        notify(
          t,
          e.participants.find((v) => v !== u.uid)!,
          votes.length === 2
            ? "Exchange completed. You can now leave a review."
            : "Your partner requested exchange completion. Please confirm.",
          `/exchanges/${eid}`,
        );
      } else {
        requireThat(
          canTransition(e, u.uid, next),
          "That status change is not permitted",
          403,
        );
        if (next === "pending") {
          requireThat(
            u.verified,
            "Verify your email before sending requests",
            403,
          );
          await getProfile(e.recipient, t);
        }
        const upcoming =
          next === "cancelled"
            ? await t.get(
                ref
                  .collection("sessions")
                  .where("status", "in", ["proposed", "scheduled"])
                  .limit(100),
              )
            : null;
        t.update(ref, {
          status: next,
          updatedAt: now,
          serverUpdatedAt: stamp(),
        });
        upcoming?.docs.forEach((s) => {
          t.update(s.ref, { status: "cancelled", updatedAt: now });
          t.delete(table("agenda").doc(s.id));
        });
        if (!activeStatuses.includes(next))
          t.delete(table("requestLocks").doc(e.lock));
        notify(
          t,
          e.participants.find((v) => v !== u.uid)!,
          `Exchange ${next.replace("_", " ")}`,
          `/exchanges/${eid}`,
        );
      }
    });
    return { ok: true };
  }
  if (op === "message") {
    requireThat(u.verified, "Verify your email before messaging", 403);
    const text = string.parse(body.text);
    await db().runTransaction(async (t) => {
      const { ref, e } = await participant(id(body.id), u.uid, t);
      requireThat(
        !["draft", "declined", "withdrawn", "cancelled"].includes(e.status),
        "This conversation is closed",
      );
      await assertNotBlocked(e.sender, e.recipient, t);
      const target = e.participants.find((v) => v !== u.uid)!;
      const p = await getProfile(target, t);
      t.create(ref.collection("messages").doc(), {
        sender: u.uid,
        text,
        createdAt: now,
        serverCreatedAt: stamp(),
      });
      t.update(ref, {
        lastMessage: text.slice(0, 160),
        lastMessageAt: now,
        updatedAt: now,
        [`lastRead.${u.uid}`]: now,
      });
      if (p.notifyMessages)
        notify(
          t,
          target,
          `New message from ${e.names[u.uid]}`,
          `/exchanges/${e.id}`,
        );
    });
    return { ok: true };
  }
  if (op === "readConversation") {
    const { ref } = await participant(id(body.id), u.uid);
    await ref.update({ [`lastRead.${u.uid}`]: now });
    return { ok: true };
  }
  if (op === "session") {
    const d = sessionSchema.parse(body.session);
    const startsAt = sessionInstant(d.local, d.timezone);
    requireThat(
      d.format !== "In person" || d.location.length >= 3,
      "Add a meeting location",
    );
    const sid = body.sessionId ? id(body.sessionId) : table("agenda").doc().id;
    await db().runTransaction(async (t) => {
      const { ref, e } = await participant(id(body.id), u.uid, t);
      requireThat(
        ["accepted", "scheduled", "in_progress"].includes(e.status),
        "Accept the exchange before scheduling",
      );
      await assertNotBlocked(e.sender, e.recipient, t);
      const old = await t.get(ref.collection("sessions").doc(sid));
      requireThat(
        !body.sessionId || old.exists,
        "Session not found in this exchange",
        404,
      );
      const openSessions = await t.get(
        ref
          .collection("sessions")
          .where("status", "in", ["proposed", "scheduled"])
          .limit(50),
      );
      requireThat(
        old.exists || openSessions.size < 50,
        "Finish or cancel existing sessions before adding more",
      );
      requireThat(
        !old.exists || !["completed", "cancelled"].includes(old.data()?.status),
        "Cannot reschedule a closed session",
      );
      const { local: _l, ...rest } = d;
      void _l;
      const session = {
        ...rest,
        id: sid,
        startsAt,
        status: "proposed",
        proposedBy: u.uid,
        createdAt: old.data()?.createdAt || now,
        updatedAt: now,
        serverUpdatedAt: stamp(),
      };
      t.set(ref.collection("sessions").doc(sid), session);
      t.delete(table("agenda").doc(sid));
      notify(
        t,
        e.participants.find((v) => v !== u.uid)!,
        old.exists
          ? "A new session time was proposed"
          : "A session was proposed",
        `/exchanges/${e.id}`,
      );
    });
    return { ok: true };
  }
  if (op === "sessionStatus") {
    const status = z
      .enum(["scheduled", "completed", "cancelled"])
      .parse(body.status);
    await db().runTransaction(async (t) => {
      const { ref, e } = await participant(id(body.id), u.uid, t);
      requireThat(
        ["accepted", "scheduled", "in_progress"].includes(e.status),
        "Exchange is closed",
      );
      await assertNotBlocked(e.sender, e.recipient, t);
      const sref = ref.collection("sessions").doc(id(body.sessionId));
      const snap = await t.get(sref);
      requireThat(snap.exists, "Session not found", 404);
      const s = snap.data() as Session;
      if (status === "scheduled")
        requireThat(
          s.status === "proposed" && s.proposedBy !== u.uid && s.startsAt > now,
          "Only the other participant can confirm a future proposal",
          403,
        );
      if (status === "completed")
        requireThat(
          s.status === "scheduled" && s.startsAt + s.duration * 60000 <= now,
          "Only a scheduled session that has ended can be completed",
        );
      if (status === "cancelled")
        requireThat(
          ["proposed", "scheduled"].includes(s.status),
          "Session already closed",
        );
      t.update(sref, { status, updatedAt: now });
      if (status === "scheduled")
        t.set(table("agenda").doc(s.id), {
          ...s,
          status,
          exchange: e.id,
          participants: e.participants,
        });
      else t.delete(table("agenda").doc(s.id));
      if (status !== "cancelled")
        t.update(ref, {
          status: status === "completed" ? "in_progress" : "scheduled",
          updatedAt: now,
        });
      notify(
        t,
        e.participants.find((v) => v !== u.uid)!,
        `Session ${status}`,
        `/exchanges/${e.id}`,
      );
    });
    return { ok: true };
  }
  if (op === "notes") {
    const notes = z.string().max(5000).parse(body.notes);
    const resources = z
      .array(z.url().refine((s) => new URL(s).protocol === "https:"))
      .max(20)
      .parse(body.resources);
    await db().runTransaction(async (t) => {
      const { ref, e } = await participant(id(body.id), u.uid, t);
      requireThat(
        ["accepted", "scheduled", "in_progress"].includes(e.status),
        "Exchange is not active",
      );
      await assertNotBlocked(e.sender, e.recipient, t);
      t.update(ref, { notes, resources, updatedAt: now });
    });
    return { ok: true };
  }
  if (op === "review") {
    const d = z
      .object({
        rating: z.number().int().min(1).max(5),
        text: z.string().trim().min(10).max(1500),
        communication: z.number().int().min(1).max(5),
        preparation: z.number().int().min(1).max(5),
        helpfulness: z.number().int().min(1).max(5),
      })
      .parse(body.review);
    await db().runTransaction(async (t) => {
      const { e } = await participant(id(body.id), u.uid, t);
      requireThat(
        e.status === "completed",
        "Only completed exchanges can be reviewed",
      );
      const target = e.participants.find((v) => v !== u.uid)!;
      await assertNotBlocked(u.uid, target, t);
      const r = table("reviews").doc(`${e.id}_${u.uid}`);
      const existing = await t.get(r);
      const p = await getProfile(target, t);
      const me = await getProfile(u.uid, t);
      requireThat(!existing.exists, "You already reviewed this exchange", 409);
      const count = (p.reviewCount || 0) + 1;
      const sum = (p.rating || 0) * (p.reviewCount || 0) + d.rating;
      t.create(r, {
        ...d,
        author: u.uid,
        authorName: me.name,
        target,
        exchange: e.id,
        createdAt: now,
        hidden: false,
        serverCreatedAt: stamp(),
      });
      t.update(table("people").doc(target), {
        reviewCount: count,
        rating: sum / count,
      });
      notify(
        t,
        target,
        "Your exchange partner left a review",
        `/people/${p.username}`,
      );
    });
    return { ok: true };
  }
  if (op === "save") {
    const target = id(body.target);
    requireThat(target !== u.uid, "You cannot bookmark yourself");
    await assertNotBlocked(u.uid, target);
    const p = await getProfile(target);
    requireThat(p.publicProfile, "Profile unavailable", 404);
    const skill = z
      .string()
      .max(60)
      .parse(body.skill || "");
    if (skill)
      requireThat(
        p.offered.some((s) => s.name === skill),
        "Skill unavailable",
      );
    const ref = table("saved").doc(hash(`${u.uid}|${target}|${skill}`));
    if (body.remove === true) await ref.delete();
    else await ref.set({ uid: u.uid, target, skill, createdAt: now });
    return { ok: true };
  }
  if (op === "removeSaved") {
    const ref = table("saved").doc(id(body.id));
    await db().runTransaction(async (t) => {
      const d = await t.get(ref);
      requireThat(d.data()?.uid === u.uid, "Saved record not found", 404);
      t.delete(ref);
    });
    return { ok: true };
  }
  if (op === "readNotifications") {
    const ids = z.array(z.string()).max(100).parse(body.ids);
    await db().runTransaction(async (t) => {
      const refs = ids.map((v) => table("notifications").doc(id(v)));
      const snaps = refs.length ? await t.getAll(...refs) : [];
      requireThat(
        snaps.every((s) => s.data()?.uid === u.uid),
        "Notification not found",
        404,
      );
      refs.forEach((r) => t.update(r, { read: true }));
    });
    return { ok: true };
  }
  if (op === "readAllNotifications") {
    const s = await table("notifications")
      .where("uid", "==", u.uid)
      .where("read", "==", false)
      .limit(400)
      .get();
    const b = db().batch();
    s.docs.forEach((d) => b.update(d.ref, { read: true }));
    await b.commit();
    return { more: s.size === 400 };
  }
  if (op === "block") {
    const target = id(body.target);
    requireThat(target !== u.uid, "Cannot block yourself");
    const ref = table("blocks").doc(blockKey(u.uid, target));
    await ref.set(
      {
        participants: [u.uid, target],
        blockers:
          body.remove === true
            ? FieldValue.arrayRemove(u.uid)
            : FieldValue.arrayUnion(u.uid),
        createdAt: now,
      },
      { merge: true },
    );
    return { ok: true };
  }
  if (op === "report") {
    const d = z
      .object({
        type: z.enum(["profile", "message", "review", "skill", "appeal"]),
        target: z.string().min(1).max(128),
        exchange: z.string().max(128).default(""),
        reason: z.string().trim().min(10).max(2000),
      })
      .parse(body.report);
    id(d.target);
    if (d.type === "message") {
      const { ref } = await participant(id(d.exchange), u.uid);
      requireThat(
        (await ref.collection("messages").doc(d.target).get()).exists,
        "Message not found",
      );
    } else if (d.type === "review")
      requireThat(
        (await table("reviews").doc(d.target).get()).exists,
        "Review not found",
      );
    else if (d.type === "profile") await getProfile(d.target);
    await table("reports").add({
      ...d,
      reporter: u.uid,
      status: "New",
      createdAt: now,
      serverCreatedAt: stamp(),
    });
    return { ok: true };
  }
  if (op === "adminUser") {
    const admin = await administrator(req);
    const target = id(body.target);
    const state = z.enum(["active", "suspended"]).parse(body.state);
    requireThat(target !== u.uid, "You cannot suspend yourself");
    await db().runTransaction(async (t) => {
      const r = table("accounts").doc(target);
      const a = await t.get(r);
      const p = await t.get(table("people").doc(target));
      requireThat(a.exists, "Account not found");
      requireThat(
        a.data()?.role !== "owner" &&
          (a.data()?.role !== "admin" || admin.account?.role === "owner"),
        "Only the owner can manage administrators",
        403,
      );
      t.update(r, { state });
      if (p.exists) t.update(p.ref, { state });
      audit(t, u.uid, `user.${state}`, target);
    });
    return { ok: true };
  }
  if (op === "adminRole") {
    await administrator(req, true);
    const target = id(body.target);
    const role = z.enum(["member", "admin"]).parse(body.role);
    requireThat(target !== u.uid, "Cannot change your own role");
    await db().runTransaction(async (t) => {
      const r = table("accounts").doc(target);
      const s = await t.get(r);
      requireThat(
        s.exists && s.data()?.role !== "owner",
        "Owner roles cannot be changed here",
        403,
      );
      t.update(r, { role });
      audit(t, u.uid, `role.${role}`, target);
    });
    return { ok: true };
  }
  if (op === "adminSkill") {
    await administrator(req);
    const name = z.string().trim().min(2).max(60).parse(body.name);
    const category = z.string().trim().min(2).max(60).parse(body.category);
    const status = z
      .enum(["approved", "rejected", "pending", "merged"])
      .parse(body.status);
    const key = body.id ? id(body.id) : hash(normalize(name));
    const canonical = body.canonical
      ? z.string().trim().min(2).max(60).parse(body.canonical)
      : "";
    requireThat(
      status !== "merged" ||
        (canonical && normalize(canonical) !== normalize(name)),
      "Choose a different canonical skill",
    );
    await db().runTransaction(async (t) => {
      const r = table("skills").doc(key);
      const old = await t.get(r);
      if (status === "merged") {
        const target = await t.get(
          table("skills").doc(hash(normalize(canonical))),
        );
        requireThat(
          target.exists && target.data()?.status === "approved",
          "Merge into an existing approved skill, not another alias",
        );
      }
      t.set(
        r,
        {
          name,
          category,
          status,
          canonical,
          createdAt: old.data()?.createdAt || now,
          updatedAt: now,
        },
        { merge: true },
      );
      audit(t, u.uid, `skill.${status}`, key);
    });
    if (status === "merged") await runMaintenance();
    return { ok: true };
  }
  if (op === "adminReport") {
    await administrator(req);
    const target = id(body.id);
    const status = z
      .enum(["New", "Under Review", "Action Taken", "Resolved"])
      .parse(body.status);
    const note = z.string().trim().min(5).max(2000).parse(body.note);
    await db().runTransaction(async (t) => {
      const r = table("reports").doc(target);
      const old = await t.get(r);
      requireThat(old.exists, "Report not found");
      t.update(r, { status, note, moderator: u.uid, updatedAt: now });
      audit(t, u.uid, `report.${status}`, target);
      notify(
        t,
        old.data()!.reporter,
        `Your report is ${status.toLowerCase()}`,
        "/notifications",
      );
    });
    return { ok: true };
  }
  if (op === "adminEvidence") {
    await administrator(req);
    const r = await table("reports").doc(id(body.id)).get();
    requireThat(r.exists, "Report not found");
    const d = r.data()!;
    let evidence: unknown = null;
    if (d.type === "message")
      evidence = (
        await table("exchanges")
          .doc(id(d.exchange))
          .collection("messages")
          .doc(id(d.target))
          .get()
      ).data();
    if (d.type === "profile")
      evidence = (await table("people").doc(id(d.target)).get()).data();
    if (d.type === "review")
      evidence = (await table("reviews").doc(id(d.target)).get()).data();
    await db().runTransaction(async (t) =>
      audit(t, u.uid, "report.evidence", r.id),
    );
    return { evidence };
  }
  if (op === "adminHideReview") {
    await administrator(req);
    await db().runTransaction(async (t) => {
      const r = table("reviews").doc(id(body.id));
      const s = await t.get(r);
      requireThat(s.exists, "Review not found");
      const d = s.data()!;
      const p = await t.get(table("people").doc(d.target));
      requireThat(p.exists, "Profile unavailable");
      const hidden = body.hidden === true;
      requireThat(d.hidden !== hidden, "Already in that state");
      const count = Math.max(
        0,
        (p.data()!.reviewCount || 0) + (hidden ? -1 : 1),
      );
      const sum =
        (p.data()!.rating || 0) * (p.data()!.reviewCount || 0) +
        (hidden ? -d.rating : d.rating);
      t.update(r, { hidden });
      t.update(p.ref, { reviewCount: count, rating: count ? sum / count : 0 });
      audit(t, u.uid, hidden ? "review.hide" : "review.restore", r.id);
    });
    return { ok: true };
  }
  if (op === "adminSettings") {
    await administrator(req);
    const settings = settingsSchema.parse(body.settings);
    await db().runTransaction(async (t) => {
      t.set(table("settings").doc("public"), settings);
      audit(t, u.uid, "settings.update", "public");
    });
    return { ok: true };
  }
  if (op === "adminMaintenance") {
    await administrator(req, true);
    const result = await runMaintenance();
    await db().runTransaction(async (t) =>
      audit(t, u.uid, "maintenance.run", "namespace"),
    );
    return result;
  }
  if (op === "deleteAccount") {
    requireThat(
      now / 1000 - u.token.auth_time < 300,
      "Sign in again before deleting your SkillSpring profile",
      401,
    );
    requireThat(body.confirm === "DELETE", "Type DELETE to confirm");
    requireThat(
      u.account?.role !== "owner",
      "Transfer ownership with the trusted operator before deleting the owner account",
    );
    await db().runTransaction(async (t) => {
      const p = await t.get(table("people").doc(u.uid));
      t.set(
        table("accounts").doc(u.uid),
        { state: "deleting", email: "", name: "Deleted member" },
        { merge: true },
      );
      if (p.exists) {
        t.set(p.ref, {
          ...blankProfile("Deleted member"),
          id: u.uid,
          username: p.data()!.username,
          state: "deleted",
          onboarded: false,
          createdAt: now,
          updatedAt: now,
          photo: "",
          tokens: [],
          offeredKeys: [],
          wantedKeys: [],
        });
        t.delete(table("handles").doc(p.data()!.username));
      }
      t.set(table("deletions").doc(u.uid), {
        uid: u.uid,
        state: "pending",
        createdAt: now,
        photoId: p.data()?.photoId || "",
      });
    });
    try {
      await eraseUser(u.uid);
    } catch {
      console.error("Private-data cleanup queued for operator retry");
    }
    return {
      ok: true,
      message:
        "Profile removed from public access. Shared Firebase login is preserved for other apps.",
    };
  }
  requireThat(false, "Unknown action");
}

import { FieldPath } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";
import { activeStatuses, normalize, searchTokens } from "@/lib/domain";
import type { Profile } from "@/lib/model";
import { db, table } from "./store";
// Operator-run, resumable cleanup. Namespace-bound queries; never delete a shared
// Firebase identity or another application's data. Every batch is <= 400 writes.
async function removeQuery(q: FirebaseFirestore.Query) {
  for (;;) {
    const s = await q.limit(300).get();
    if (s.empty) return;
    const b = db().batch();
    s.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
  }
}
export async function eraseUser(uid: string) {
  const job = table("deletions").doc(uid);
  const state = await job.get();
  if (!state.exists || state.data()?.state === "completed") return;
  for (const name of ["notifications", "saved", "proposals", "assetCleanup"])
    await removeQuery(table(name).where("uid", "==", uid));
  await removeQuery(table("saved").where("target", "==", uid));
  await removeQuery(
    table("blocks").where("participants", "array-contains", uid),
  );
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = table("exchanges")
      .where("participants", "array-contains", uid)
      .orderBy(FieldPath.documentId())
      .limit(50);
    if (cursor) q = q.startAfter(cursor);
    const s = await q.get();
    if (s.empty) break;
    for (const d of s.docs) {
      const e = d.data();
      await removeQuery(
        d.ref.collection("messages").where("sender", "==", uid),
      );
      let sessionCursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
      for (;;) {
        let sq = d.ref
          .collection("sessions")
          .orderBy(FieldPath.documentId())
          .limit(100);
        if (sessionCursor) sq = sq.startAfter(sessionCursor);
        const sessions = await sq.get();
        if (sessions.empty) break;
        const b = db().batch();
        sessions.docs.forEach((x) => {
          const v = x.data();
          const patch = {
            ...(v.proposedBy === uid
              ? { notes: "", location: "", link: "", title: "Session" }
              : {}),
            ...(["proposed", "scheduled"].includes(v.status)
              ? { status: "cancelled" }
              : {}),
          };
          if (Object.keys(patch).length) b.update(x.ref, patch);
          b.delete(table("agenda").doc(x.id));
        });
        await b.commit();
        sessionCursor = sessions.docs.at(-1);
      }
      const b = db().batch();
      b.update(d.ref, {
        [`names.${uid}`]: "Deleted member",
        goals: "Removed at a participant’s request",
        message: "",
        schedule: "",
        notes: "",
        resources: [],
        lastMessage: "",
        ...(activeStatuses.includes(e.status) ? { status: "cancelled" } : {}),
      });
      b.delete(table("requestLocks").doc(e.lock));
      await b.commit();
    }
    cursor = s.docs.at(-1);
  }
  // Retain rating eligibility but erase author text and identity labels.
  let reviewCursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = table("reviews")
      .where("author", "==", uid)
      .orderBy(FieldPath.documentId())
      .limit(100);
    if (reviewCursor) q = q.startAfter(reviewCursor);
    const reviews = await q.get();
    if (reviews.empty) break;
    const b = db().batch();
    reviews.docs.forEach((d) =>
      b.update(d.ref, {
        authorName: "Deleted member",
        text: "Feedback text removed at the author’s request.",
      }),
    );
    await b.commit();
    reviewCursor = reviews.docs.at(-1);
  }
  const photoId = state.data()?.photoId;
  if (
    photoId &&
    String(photoId).startsWith(`skillspring/avatars/${uid}/`) &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    await cloudinary.uploader.destroy(photoId);
  }
  await table("accounts")
    .doc(uid)
    .set({
      uid,
      state: "deleted",
      role: "member",
      name: "Deleted member",
      email: "",
      createdAt: state.data()?.createdAt || Date.now(),
      deletedAt: Date.now(),
    });
  await job.set({
    uid,
    state: "completed",
    createdAt: state.data()?.createdAt || Date.now(),
    completedAt: Date.now(),
  });
}
export async function runMaintenance() {
  const jobs = await table("deletions")
    .where("state", "==", "pending")
    .limit(10)
    .get();
  for (const j of jobs.docs) await eraseUser(j.id);
  const aliases = await table("skills")
    .where("status", "==", "merged")
    .limit(100)
    .get();
  let normalized = 0;
  for (const alias of aliases.docs) {
    const { name, canonical } = alias.data();
    if (!canonical) continue;
    for (const field of ["offeredKeys", "wantedKeys"]) {
      for (;;) {
        const profiles = await table("people")
          .where(field, "array-contains", normalize(name))
          .limit(100)
          .get();
        if (profiles.empty) break;
        const b = db().batch();
        for (const d of profiles.docs) {
          const p = d.data() as Profile;
          const offered = p.offered.map((s) =>
            normalize(s.name) === normalize(name)
              ? { ...s, name: canonical }
              : s,
          );
          const wanted = p.wanted.map((s) =>
            normalize(s.name) === normalize(name)
              ? { ...s, name: canonical }
              : s,
          );
          const next = {
            ...p,
            offered: [
              ...new Map(offered.map((s) => [normalize(s.name), s])).values(),
            ],
            wanted: [
              ...new Map(wanted.map((s) => [normalize(s.name), s])).values(),
            ],
          };
          b.update(d.ref, {
            offered: next.offered,
            wanted: next.wanted,
            offeredKeys: next.offered.map((s) => normalize(s.name)),
            wantedKeys: next.wanted.map((s) => normalize(s.name)),
            tokens: searchTokens({
              ...next,
              city: next.publicLocation ? next.city : "",
              country: next.publicLocation ? next.country : "",
            }),
            updatedAt: Date.now(),
          });
          normalized++;
        }
        await b.commit();
      }
    }
  }
  await removeQuery(table("limits").where("reset", "<", Date.now() - 86400000));
  return { erased: jobs.size, normalized };
}

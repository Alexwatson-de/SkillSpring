import { type Query } from "firebase-admin/firestore";
import { defaultSettings, type Profile } from "@/lib/model";
import { normalize, publicProfile, requireThat } from "@/lib/domain";
import { matchPeople } from "@/lib/matching";
import {
  administrator,
  assertNotBlocked,
  getProfile,
  id,
  identity,
  member,
  participant,
  table,
} from "./store";
const rows = (q: FirebaseFirestore.QuerySnapshot) =>
  q.docs.map((d) => ({ ...d.data(), id: d.id }));
// Cursors use document IDs, constrained to the exact requested collection.
async function orderedPage(
  name: string,
  p: URLSearchParams,
  q?: Query,
  size = 24,
) {
  let base = q || table(name);
  base = base.orderBy("createdAt", "desc");
  const c = p.get("cursor");
  if (c) {
    const s = await table(name).doc(id(c)).get();
    requireThat(s.exists, "Invalid cursor");
    base = base.startAfter(s);
  }
  const s = await base.limit(size + 1).get();
  return {
    items: rows(s).slice(0, size),
    next: s.size > size ? s.docs[size - 1].id : null,
  };
}
export async function query(req: Request) {
  const p = new URL(req.url).searchParams;
  const kind = p.get("kind") || "people";
  if (kind === "settings") {
    const s = await table("settings").doc("public").get();
    return { ...defaultSettings, ...s.data() };
  }
  if (kind === "catalog") {
    const s = await table("skills")
      .where("status", "==", "approved")
      .orderBy("name")
      .limit(100)
      .get();
    return { items: rows(s) };
  }
  if (kind === "people" || kind === "matches") {
    const token = await identity(req, true);
    let me: Profile | undefined;
    if (kind === "matches") {
      requireThat(token, "Sign in for matches", 401);
      me = await getProfile(token.uid);
    }
    let q: Query = table("people")
      .where("state", "==", "active")
      .where("publicProfile", "==", true)
      .where("onboarded", "==", true);
    const term = normalize(p.get("q") || "")
      .split(" ")
      .filter(Boolean);
    requireThat(term.join(" ").length <= 100, "Search is too long");
    if (term[0]) q = q.where("tokens", "array-contains", term[0]);
    else if (me && p.get("direction") === "teach" && me.offered.length)
      q = q.where(
        "wantedKeys",
        "array-contains-any",
        me.offered.map((s) => normalize(s.name)).slice(0, 15),
      );
    else if (me && me.wanted.length)
      q = q.where(
        "offeredKeys",
        "array-contains-any",
        me.wanted.map((s) => normalize(s.name)).slice(0, 15),
      );
    q = q.orderBy("updatedAt", "desc");
    const cursor = p.get("cursor");
    if (cursor) {
      const c = await table("people").doc(id(cursor)).get();
      requireThat(c.exists, "Invalid cursor");
      q = q.startAfter(c);
    }
    const s = await q.limit(49).get();
    let items = s.docs
      .slice(0, 48)
      .map((d) => ({ ...d.data(), id: d.id }) as Profile);
    items = items.filter(
      (v) =>
        v.id !== token?.uid &&
        term.every((t) =>
          normalize(
            [
              v.name,
              v.headline,
              v.bio,
              v.role,
              v.publicLocation ? v.city : "",
              ...v.offered.flatMap((x) => [x.name, x.description, x.category]),
            ].join(" "),
          ).includes(t),
        ) &&
        (!p.get("category") ||
          v.offered.some((x) => x.category === p.get("category"))) &&
        (!p.get("level") ||
          v.offered.some((x) => x.level === p.get("level"))) &&
        (!p.get("language") || v.languages.includes(p.get("language")!)) &&
        (!p.get("format") ||
          v.format === p.get("format") ||
          v.format === "Either") &&
        (!p.get("day") ||
          v.availableDays.includes(
            p.get("day")! as (typeof v.availableDays)[number],
          )) &&
        (!p.get("arrangement") ||
          v.arrangement === p.get("arrangement") ||
          v.arrangement === "Both") &&
        (!p.get("location") ||
          (v.publicLocation &&
            normalize(v.city + " " + v.country).includes(
              normalize(p.get("location")!),
            ))) &&
        (!p.get("experience") ||
          v.offered.some((x) => x.experience >= Number(p.get("experience")))) &&
        (!p.get("rating") ||
          (!!v.reviewCount && (v.rating || 0) >= Number(p.get("rating")))),
    );
    if (token) {
      const visible = await Promise.all(
        items.map(async (v) => {
          try {
            await assertNotBlocked(token.uid, v.id);
            return v;
          } catch {
            return null;
          }
        }),
      );
      items = visible.filter(Boolean) as Profile[];
    }
    if (p.get("sort") === "name")
      items.sort((a, b) => a.name.localeCompare(b.name));
    if (p.get("sort") === "rating")
      items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const result = items.map((v) => {
      const {
        tokens: _t,
        offeredKeys: _o,
        wantedKeys: _w,
        serverUpdatedAt: _u,
        ...rest
      } = v as Profile & Record<string, unknown>;
      void _t;
      void _o;
      void _w;
      void _u;
      return {
        ...publicProfile(rest as Profile),
        ...(me ? { match: matchPeople(me, v) } : {}),
      };
    });
    if (me)
      result.sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0));
    return {
      items: me
        ? result.filter(
            (v) =>
              v.match?.score &&
              (p.get("direction") !== "reciprocal" || v.match.reciprocal),
          )
        : result,
      next: s.size > 48 ? s.docs[47].id : null,
      scope:
        "Filters and sorting apply to this indexed page (up to 48 candidates). Continue for more results.",
    };
  }
  if (kind === "profile") {
    const username = p.get("username") || "";
    requireThat(/^[a-z0-9-]{3,100}$/.test(username), "Invalid profile address");
    const h = await table("handles").doc(username).get();
    requireThat(h.exists, "Profile not found", 404);
    const v = await getProfile(h.data()!.uid);
    const token = await identity(req, true);
    requireThat(
      (v.onboarded && v.publicProfile) || token?.uid === v.id,
      "Profile not found",
      404,
    );
    if (token && token.uid !== v.id) await assertNotBlocked(token.uid, v.id);
    const reviews = await table("reviews")
      .where("target", "==", v.id)
      .where("hidden", "==", false)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();
    const {
      tokens: _t,
      offeredKeys: _o,
      wantedKeys: _w,
      ...safe
    } = v as Profile & Record<string, unknown>;
    void _t;
    void _o;
    void _w;
    return { profile: publicProfile(safe as Profile), reviews: rows(reviews) };
  }
  const u = await member(req);
  if (kind === "me") {
    const s = await table("people").doc(u.uid).get();
    return {
      profile: s.exists ? { ...s.data(), id: s.id } : null,
      role: u.account?.role || "member",
      verified: u.verified,
    };
  }
  if (kind === "exchanges") {
    const result = await orderedPage(
      "exchanges",
      p,
      table("exchanges").where("participants", "array-contains", u.uid),
    );
    return {
      ...result,
      items: result.items.filter(
        (e: Record<string, unknown>) =>
          e.status !== "draft" || e.sender === u.uid,
      ),
    };
  }
  if (kind === "dashboard") {
    const [ex, notifications, saved, unread] = await Promise.all([
      table("exchanges")
        .where("participants", "array-contains", u.uid)
        .orderBy("updatedAt", "desc")
        .limit(30)
        .get(),
      table("notifications")
        .where("uid", "==", u.uid)
        .where("read", "==", false)
        .orderBy("createdAt", "desc")
        .limit(8)
        .get(),
      table("saved").where("uid", "==", u.uid).count().get(),
      table("notifications")
        .where("uid", "==", u.uid)
        .where("read", "==", false)
        .count()
        .get(),
    ]);
    const exchanges = rows(ex).filter(
      (e: Record<string, unknown>) =>
        e.status !== "draft" || e.sender === u.uid,
    );
    const sessions = await table("agenda")
      .where("participants", "array-contains", u.uid)
      .where("startsAt", ">", Date.now())
      .orderBy("startsAt")
      .limit(12)
      .get();
    return {
      exchanges,
      notifications: rows(notifications),
      sessions: rows(sessions),
      saved: saved.data().count,
      unread: unread.data().count,
      scope: "Recent 30 exchanges",
    };
  }
  if (kind === "exchange") {
    const { e } = await participant(p.get("id") || "", u.uid);
    // Blocking stops new contact, not access to a participant's own history or cancellation.
    let blocked = false;
    try {
      await assertNotBlocked(e.sender, e.recipient);
    } catch {
      blocked = true;
    }
    const [messages, sessions, reviews] = await Promise.all([
      table("exchanges")
        .doc(e.id)
        .collection("messages")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get(),
      table("exchanges")
        .doc(e.id)
        .collection("sessions")
        .orderBy("startsAt", "desc")
        .limit(50)
        .get(),
      table("reviews").where("exchange", "==", e.id).get(),
    ]);
    return {
      exchange: e,
      blocked,
      messages: rows(messages).reverse(),
      sessions: rows(sessions),
      reviews: rows(reviews),
      moreMessages: messages.size === 50,
    };
  }
  if (kind === "messages") {
    const { ref } = await participant(p.get("id") || "", u.uid);
    let q: Query = ref.collection("messages").orderBy("createdAt", "desc");
    if (p.get("before")) {
      const n = Number(p.get("before"));
      requireThat(Number.isFinite(n), "Invalid timestamp");
      q = q.where("createdAt", "<", n);
    }
    const s = await q.limit(50).get();
    return { items: rows(s).reverse(), more: s.size === 50 };
  }
  if (kind === "notifications")
    return orderedPage(
      "notifications",
      p,
      table("notifications").where("uid", "==", u.uid),
    );
  if (kind === "saved") {
    const result = await orderedPage(
      "saved",
      p,
      table("saved").where("uid", "==", u.uid),
    );
    return {
      ...result,
      items: await Promise.all(
        result.items.map(async (s: Record<string, unknown>) => {
          try {
            await assertNotBlocked(u.uid, String(s.target));
            const v = await getProfile(String(s.target));
            return { ...s, profile: v.publicProfile ? publicProfile(v) : null };
          } catch {
            return { ...s, profile: null };
          }
        }),
      ),
    };
  }
  if (kind === "blocks") {
    const s = await table("blocks")
      .where("blockers", "array-contains", u.uid)
      .limit(100)
      .get();
    return {
      items: rows(s).map((b: Record<string, unknown>) => ({
        id: b.id,
        target: (b.participants as string[]).find((v) => v !== u.uid),
      })),
    };
  }
  if (kind === "admin") {
    await administrator(req);
    const tab = p.get("tab") || "overview";
    if (tab === "overview") {
      const names = ["accounts", "people", "skills", "exchanges", "reports"];
      const counts = await Promise.all(
        names.map(async (name) => [
          name,
          (await table(name).count().get()).data().count,
        ]),
      );
      const active = (
        await table("people")
          .where("lastActive", ">", Date.now() - 30 * 86400000)
          .where("state", "==", "active")
          .count()
          .get()
      ).data().count;
      const complete = (
        await table("exchanges")
          .where("status", "==", "completed")
          .count()
          .get()
      ).data().count;
      const pending = (
        await table("skills").where("status", "==", "pending").count().get()
      ).data().count;
      return { counts: Object.fromEntries(counts), active, complete, pending };
    }
    requireThat(
      ["accounts", "skills", "reports", "audit"].includes(tab),
      "Unknown admin tab",
    );
    let q: Query = table(tab);
    if (p.get("filter"))
      q = q.where(
        tab === "accounts" ? "state" : "status",
        "==",
        p.get("filter"),
      );
    if (p.get("q") && tab === "accounts")
      q = q.where("email", "==", p.get("q")!.trim().toLowerCase());
    return orderedPage(tab, p, q);
  }
  throw new Error("Unknown query");
}

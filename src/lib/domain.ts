import { DateTime } from "luxon";
import { createHash } from "node:crypto";
import type { Exchange, Profile, ProfileInput, Status } from "./model";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireThat(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new AppError(status, message);
}
export const normalize = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s+#.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function searchTokens(p: ProfileInput) {
  const words = normalize(
    [
      p.name,
      p.headline,
      p.bio,
      p.role,
      p.city,
      p.country,
      ...p.offered.flatMap((s) => [s.name, s.category, s.description]),
    ].join(" "),
  ).split(" ");
  return [
    ...new Set(
      words.flatMap((w) =>
        Array.from({ length: Math.min(w.length, 24) }, (_, i) =>
          w.slice(0, i + 1),
        ),
      ),
    ),
  ].slice(0, 2200);
}
export function publicProfile(p: Profile) {
  const {
    availability: _a,
    accessibility: _b,
    notifyMessages: _c,
    ...safe
  } = p;
  void _a;
  void _b;
  void _c;
  return {
    ...safe,
    completedCount: p.publicHistory ? p.completedCount : undefined,
    city: p.publicLocation ? p.city : "",
    country: p.publicLocation ? p.country : "",
    offered: p.offered.map((s) => ({ ...s, availability: "" })),
  };
}
export function canTransition(e: Exchange, uid: string, next: Status) {
  if (!e.participants.includes(uid)) return false;
  const pending = ["pending", "discussion"];
  if (next === "pending") return e.status === "draft" && uid === e.sender;
  if (next === "discussion") return pending.includes(e.status);
  if (next === "accepted" || next === "declined")
    return uid === e.recipient && pending.includes(e.status);
  if (next === "withdrawn")
    return uid === e.sender && ["draft", ...pending].includes(e.status);
  if (next === "cancelled")
    return ["accepted", "scheduled", "in_progress"].includes(e.status);
  return false;
}
export const activeStatuses = [
  "draft",
  "pending",
  "discussion",
  "accepted",
  "scheduled",
  "in_progress",
];
export function requestLock(
  a: string,
  b: string,
  learn: string,
  offer: string,
) {
  return createHash("sha256")
    .update(
      [
        [a, normalize(offer)],
        [b, normalize(learn)],
      ]
        .sort((x, y) => x[0].localeCompare(y[0]))
        .flat()
        .join("|"),
    )
    .digest("hex");
}
export function sessionInstant(local: string, zone: string, now = Date.now()) {
  const d = DateTime.fromISO(local, { zone });
  requireThat(d.isValid, "Invalid date or time zone");
  requireThat(
    d.toFormat("yyyy-MM-dd'T'HH:mm") === local.slice(0, 16),
    "This local time does not exist because of daylight saving time",
  );
  requireThat(
    d.getPossibleOffsets().length === 1,
    "This time occurs twice because of daylight saving time. Choose an unambiguous time.",
  );
  requireThat(d.toMillis() > now, "Choose a future session time");
  requireThat(
    d.toMillis() < now + 366 * 86400000,
    "Schedule within the next year",
  );
  return d.toMillis();
}
export function profileCompletion(p: ProfileInput) {
  return Math.round(
    ([
      p.name,
      p.bio,
      p.role,
      p.summary,
      p.languages.length,
      p.offered.length,
      p.wanted.length,
      p.availableDays.length,
      p.headline,
      p.timezone,
    ].filter(Boolean).length /
      10) *
      100,
  );
}

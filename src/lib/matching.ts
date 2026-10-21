import type { Profile } from "./model";
import { levels } from "./model";
// Defined points, not a probability. A reciprocal match is weighted most highly.
export const matchWeights = {
  learn: 30,
  teach: 30,
  level: 10,
  language: 10,
  format: 5,
  days: 5,
  goals: 5,
  experience: 5,
};
const key = (v: string) => v.trim().toLowerCase();
export function matchPeople(me: Profile, other: Profile) {
  const learn = other.offered.filter((s) =>
    me.wanted.some((w) => key(w.name) === key(s.name)),
  );
  const teach = me.offered.filter((s) =>
    other.wanted.some((w) => key(w.name) === key(s.name)),
  );
  const reasons: string[] = [];
  let score = 0;
  if (learn.length) {
    score += matchWeights.learn;
    reasons.push(
      `Learn ${learn.map((s) => s.name).join(", ")} from ${other.name.split(" ")[0]}`,
    );
  }
  if (teach.length) {
    score += matchWeights.teach;
    reasons.push(`Share ${teach.map((s) => s.name).join(", ")}`);
  }
  if (!learn.length && !teach.length)
    return { score: 0, reasons, learn, teach, reciprocal: false };
  if (
    learn.some((s) =>
      me.wanted.some(
        (w) =>
          key(w.name) === key(s.name) &&
          levels.indexOf(s.level) >= levels.indexOf(w.desiredLevel),
      ),
    )
  ) {
    score += matchWeights.level;
    reasons.push("Teaching level supports your target");
  }
  if (me.languages.some((l) => other.languages.includes(l))) {
    score += matchWeights.language;
    reasons.push("A shared language");
  }
  if (
    me.format === other.format ||
    me.format === "Either" ||
    other.format === "Either"
  )
    score += matchWeights.format;
  if (me.availableDays.some((d) => other.availableDays.includes(d))) {
    score += matchWeights.days;
    reasons.push("Available on a common day (times still need agreement)");
  }
  const goals = me.wanted
    .flatMap((s) => s.description.toLowerCase().split(/\W+/))
    .filter((s) => s.length > 4);
  if (
    learn.some((s) =>
      goals.some((w) => s.description.toLowerCase().includes(w)),
    )
  )
    score += matchWeights.goals;
  if (learn.some((s) => s.experience >= 2)) score += matchWeights.experience;
  return {
    score,
    reasons,
    learn,
    teach,
    reciprocal: !!learn.length && !!teach.length,
  };
}

import { describe, expect, it } from "vitest";
import {
  blankProfile,
  blankSkill,
  profileSchema,
  requestSchema,
  type Exchange,
  type Profile,
  type Status,
} from "../src/lib/model";
import {
  canTransition,
  publicProfile,
  requestLock,
  searchTokens,
  sessionInstant,
  profileCompletion,
} from "../src/lib/domain";
import { matchPeople } from "../src/lib/matching";
const profile = (id: string, offered: string, wanted: string): Profile => ({
  ...blankProfile(id),
  id,
  username: id,
  offered: [{ ...blankSkill, name: offered, level: "Expert", experience: 4 }],
  wanted: [{ ...blankSkill, name: wanted }],
  onboarded: true,
  state: "active",
  createdAt: 1,
  updatedAt: 1,
  lastActive: 1,
});
const exchange = (status: Status): Exchange => ({
  id: "e",
  sender: "a",
  recipient: "b",
  participants: ["a", "b"],
  names: { a: "A", b: "B" },
  learn: "Figma",
  offer: "React",
  arrangement: "Reciprocal",
  goals: "Build something",
  format: "Online",
  schedule: "",
  message: "",
  duration: 45,
  status,
  createdAt: 1,
  updatedAt: 1,
  completionVotes: [],
  lastRead: {},
  lock: "lock",
});
describe("authorization state machine", () => {
  it.each([
    ["pending", "b", "accepted", true],
    ["pending", "a", "accepted", false],
    ["pending", "b", "declined", true],
    ["pending", "a", "declined", false],
    ["draft", "b", "pending", false],
    ["draft", "a", "pending", true],
    ["accepted", "a", "cancelled", true],
    ["completed", "a", "accepted", false],
    ["pending", "stranger", "discussion", false],
    ["pending", "a", "completed", false],
    ["scheduled", "a", "completed", false],
    ["pending", "a", "withdrawn", true],
    ["accepted", "a", "withdrawn", false],
  ] as [Status, string, Status, boolean][])(
    "%s %s → %s = %s",
    (old, uid, next, allowed) =>
      expect(canTransition(exchange(old), uid, next)).toBe(allowed),
  );
});
describe("transparent matching", () => {
  it("scores reciprocal matches and explains both directions", () => {
    const a = profile("A", "React", "Figma");
    const b = profile("B", "Figma", "React");
    const m = matchPeople(a, b);
    expect(m.reciprocal).toBe(true);
    expect(m.score).toBe(90);
    expect(m.reasons[0]).toContain("Figma");
  });
  it("allows one-way learning", () =>
    expect(
      matchPeople(
        profile("A", "React", "Figma"),
        profile("B", "Figma", "Guitar"),
      ).reciprocal,
    ).toBe(false));
  it("does not invent a match for unrelated people", () =>
    expect(
      matchPeople(
        profile("A", "React", "Figma"),
        profile("B", "Spanish", "Guitar"),
      ).score,
    ).toBe(0));
  it("adds defined common-day points", () => {
    const a = profile("A", "React", "Figma");
    const b = profile("B", "Figma", "React");
    a.availableDays = ["Tuesday"];
    b.availableDays = ["Tuesday"];
    expect(matchPeople(a, b).score).toBe(95);
  });
});
describe("timezone safety", () => {
  it("normalizes equivalent local times", () => {
    expect(
      sessionInstant("2027-01-10T18:00", "Asia/Kolkata", Date.UTC(2026, 2, 1)),
    ).toBe(sessionInstant("2027-01-10T12:30", "UTC", 0 + Date.UTC(2026, 2, 1)));
  });
  it("rejects invalid zone", () =>
    expect(() => sessionInstant("2027-01-01T10:00", "Bad/Zone")).toThrow());
  it("rejects DST gap", () =>
    expect(() =>
      sessionInstant(
        "2027-03-14T02:30",
        "America/New_York",
        Date.UTC(2027, 0, 1),
      ),
    ).toThrow(/does not exist/));
  it("rejects ambiguous DST fold", () =>
    expect(() =>
      sessionInstant(
        "2027-11-07T01:30",
        "America/New_York",
        Date.UTC(2027, 0, 1),
      ),
    ).toThrow(/twice/));
  it("rejects past appointments", () =>
    expect(() => sessionInstant("2020-01-01T10:00", "UTC")).toThrow(/future/));
});
describe("input and privacy", () => {
  it("rejects forged profile roles", () =>
    expect(
      profileSchema.safeParse({
        ...blankProfile("Alex"),
        roleAssignment: "admin",
      }).success,
    ).toBe(false));
  it("rejects unsafe URLs", () =>
    expect(
      profileSchema.safeParse({
        ...blankProfile("Alex"),
        links: ["javascript:alert(1)"],
      }).success,
    ).toBe(false));
  it("requires reciprocal offer", () =>
    expect(
      requestSchema.safeParse({
        recipient: "b",
        learn: "React",
        offer: "",
        arrangement: "Reciprocal",
        goals: "Learn React together",
        format: "Online",
        schedule: "",
        message: "",
        duration: 45,
      }).success,
    ).toBe(false));
  it("redacts private availability and location", () => {
    const p = profile("Alex", "React", "Figma");
    p.city = "Private city";
    p.availability = "Door code and times";
    p.accessibility = "Private access note";
    const safe = publicProfile(p);
    expect(safe.city).toBe("");
    expect(safe).not.toHaveProperty("availability");
    expect(safe).not.toHaveProperty("accessibility");
  });
  it("canonicalizes reciprocal duplicate locks in either direction", () =>
    expect(requestLock("a", "b", "Figma", "React")).toBe(
      requestLock("b", "a", "react", "figma"),
    ));
  it("indexes searchable prefixes", () =>
    expect(searchTokens(blankProfile("Alex Rivera"))).toContain("riv"));
  it("derives completion from actual fields", () =>
    expect(profileCompletion(blankProfile("Alex"))).toBe(30));
});

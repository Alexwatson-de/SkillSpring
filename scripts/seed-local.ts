import { getAuth } from "firebase-admin/auth";
import { admin, table } from "../src/server/store";
import {
  blankProfile,
  blankSkill,
  catalog,
  defaultSettings,
  type Profile,
} from "../src/lib/model";
import { normalize, searchTokens } from "../src/lib/domain";
import { createHash } from "node:crypto";
async function main() {
  if (
    process.env.FIREBASE_PROJECT_ID !== "demo-skillspring" ||
    !process.env.FIRESTORE_EMULATOR_HOST
  )
    throw new Error("Demo seeding is emulator-only");
  const people = [
    {
      id: "demo-alex",
      name: "Alex Rivera",
      role: "Frontend developer",
      offered: "React",
      wanted: "UI/UX design",
      category: "Programming",
      bio: "I turn ideas into friendly, accessible interfaces. Happy to help you build your first React project, and curious to get better at design.",
    },
    {
      id: "demo-jamie",
      name: "Jamie Chen",
      role: "Product designer",
      offered: "UI/UX design",
      wanted: "React",
      category: "Design",
      bio: "Designing thoughtful digital experiences. I can help you go from a rough idea to a polished Figma prototype. Let’s learn by making.",
    },
    {
      id: "demo-sam",
      name: "Sam Taylor",
      role: "Photographer & storyteller",
      offered: "Photography",
      wanted: "Spanish",
      category: "Photography & Video",
      bio: "Finding stories in everyday moments. I’d love to share camera basics and composition, and practice conversational Spanish.",
    },
    {
      id: "demo-maya",
      name: "Maya Patel",
      role: "Data analyst",
      offered: "Python",
      wanted: "Public speaking",
      category: "Data & AI",
      bio: "Making numbers tell a useful story. Let’s explore data with Python and build your confidence one practical exercise at a time.",
    },
  ];
  for (const d of people) {
    const email = `${d.id}@example.test`;
    try {
      await getAuth(admin()).getUser(d.id);
    } catch {
      await getAuth(admin()).createUser({
        uid: d.id,
        email,
        password: "Demo-Only-SkillSpring-29",
        displayName: d.name,
        emailVerified: true,
      });
    }
    const p: Profile = {
      ...blankProfile(d.name),
      id: d.id,
      username: d.id,
      bio: d.bio,
      headline: d.role,
      role: d.role,
      summary: "Demonstration profile for local testing only.",
      city: "London",
      country: "United Kingdom",
      publicLocation: true,
      timezone: "Europe/London",
      availableDays: ["Tuesday", "Thursday", "Saturday"],
      offered: [
        {
          ...blankSkill,
          name: d.offered,
          category: d.category,
          level: "Advanced",
          description: d.bio,
          experience: 4,
        },
      ],
      wanted: [
        {
          ...blankSkill,
          name: d.wanted,
          category: d.wanted === "React" ? "Programming" : "Other",
          description: `I want to learn ${d.wanted} through practical sessions.`,
        },
      ],
      onboarded: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActive: Date.now(),
      state: "active",
      demo: true,
    };
    await table("people")
      .doc(d.id)
      .set({
        ...p,
        tokens: searchTokens(p),
        offeredKeys: [normalize(d.offered)],
        wantedKeys: [normalize(d.wanted)],
      });
    await table("handles").doc(d.id).set({ uid: d.id });
    await table("accounts")
      .doc(d.id)
      .set({
        uid: d.id,
        name: d.name,
        email,
        role: d.id === "demo-alex" ? "owner" : "member",
        state: "active",
        createdAt: Date.now(),
      });
  }
  for (const name of catalog) {
    const key = createHash("sha256").update(normalize(name)).digest("hex");
    await table("skills")
      .doc(key)
      .set({
        name,
        category: "Other",
        status: "approved",
        createdAt: Date.now(),
      });
  }
  await table("settings").doc("public").set(defaultSettings);
  console.log(
    "Created 4 clearly labelled emulator-only profiles. Login: demo-alex@example.test (owner), demo-jamie@example.test. Password: Demo-Only-SkillSpring-29. No real project was modified.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

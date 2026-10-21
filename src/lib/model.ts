import { z } from "zod";
import { DateTime } from "luxon";
export const categories = [
  "Programming",
  "Data & AI",
  "Design",
  "Business",
  "Marketing",
  "Finance",
  "Languages",
  "Photography & Video",
  "Music",
  "Writing",
  "Career",
  "Productivity",
  "Other",
];
export const catalog = [
  "React",
  "JavaScript",
  "TypeScript",
  "Python",
  "Data analysis",
  "Machine learning",
  "UI/UX design",
  "Figma",
  "Brand strategy",
  "Entrepreneurship",
  "Digital marketing",
  "Accounting",
  "English",
  "Spanish",
  "Photography",
  "Video editing",
  "Guitar",
  "Piano",
  "Creative writing",
  "Public speaking",
  "Interview preparation",
  "Excel",
];
export const levels = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;
export const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const text = (n = 200) => z.string().trim().max(n);
export const safeUrl = z.union([
  z.literal(""),
  z.url().refine((v) => new URL(v).protocol === "https:", "Use an HTTPS link"),
]);
export const skillSchema = z
  .object({
    name: text(60).min(2),
    category: text(60).min(2),
    level: z.enum(levels),
    desiredLevel: z.enum(levels).default("Intermediate"),
    experience: z.coerce.number().min(0).max(80).default(0),
    description: text(1200),
    format: z.enum(["Online", "In person", "Either"]).default("Online"),
    priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
    targetDate: text(10).default(""),
    link: safeUrl.default(""),
    availability: text(200).default(""),
  })
  .strict();
export const profileSchema = z
  .object({
    name: text(80).min(2),
    headline: text(120),
    bio: text(1600),
    city: text(80),
    country: text(80),
    timezone: z
      .string()
      .refine(
        (v) => DateTime.now().setZone(v).isValid,
        "Choose a valid IANA time zone",
      ),
    languages: z.array(text(40).min(2)).min(1).max(10),
    interests: text(200),
    role: text(100),
    industry: text(80),
    company: text(100),
    education: text(200),
    experience: z.enum(levels),
    summary: text(1600),
    links: z.array(safeUrl).max(5),
    offered: z
      .array(skillSchema)
      .max(15)
      .refine(
        (v) => new Set(v.map((s) => s.name.toLowerCase())).size === v.length,
        "Remove duplicate offered skills",
      ),
    wanted: z
      .array(skillSchema)
      .max(15)
      .refine(
        (v) => new Set(v.map((s) => s.name.toLowerCase())).size === v.length,
        "Remove duplicate learning skills",
      ),
    format: z.enum(["Online", "In person", "Either"]),
    availableDays: z
      .array(
        z.enum([
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ]),
      )
      .max(7),
    availability: text(200),
    duration: z.coerce.number().int().min(15).max(180),
    arrangement: z.enum(["Reciprocal", "Mentoring", "Both"]),
    accessibility: text(400),
    publicLocation: z.boolean(),
    publicHistory: z.boolean(),
    publicProfile: z.boolean(),
    notifyMessages: z.boolean(),
    step: z.number().int().min(1).max(5),
  })
  .strict();
export type Skill = z.infer<typeof skillSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type Profile = ProfileInput & {
  id: string;
  username: string;
  photo?: string;
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
  lastActive: number;
  state: "active" | "suspended" | "deleted";
  demo?: boolean;
  rating?: number;
  reviewCount?: number;
  completedCount?: number;
};
export const blankSkill: Skill = {
  name: "",
  category: "Programming",
  level: "Intermediate",
  desiredLevel: "Advanced",
  experience: 0,
  description: "",
  format: "Online",
  priority: "Medium",
  targetDate: "",
  link: "",
  availability: "",
};
export function blankProfile(name = ""): ProfileInput {
  return {
    name,
    headline: "",
    bio: "",
    city: "",
    country: "",
    timezone: "UTC",
    languages: ["English"],
    interests: "",
    role: "",
    industry: "",
    company: "",
    education: "",
    experience: "Intermediate",
    summary: "",
    links: [],
    offered: [],
    wanted: [],
    format: "Online",
    availableDays: [],
    availability: "",
    duration: 45,
    arrangement: "Both",
    accessibility: "",
    publicLocation: false,
    publicHistory: false,
    publicProfile: true,
    notifyMessages: true,
    step: 1,
  };
}
export const statuses = [
  "draft",
  "pending",
  "discussion",
  "accepted",
  "scheduled",
  "in_progress",
  "completed",
  "declined",
  "withdrawn",
  "cancelled",
] as const;
export type Status = (typeof statuses)[number];
export type Exchange = {
  id: string;
  sender: string;
  recipient: string;
  participants: string[];
  names: Record<string, string>;
  learn: string;
  offer: string;
  arrangement: "Reciprocal" | "Learn" | "Teach";
  goals: string;
  format: string;
  schedule: string;
  message: string;
  duration: number;
  status: Status;
  createdAt: number;
  updatedAt: number;
  completionVotes: string[];
  lastMessage?: string;
  lastMessageAt?: number;
  lastRead: Record<string, number>;
  notes?: string;
  resources?: string[];
  lock: string;
};
export type Session = {
  id: string;
  title: string;
  startsAt: number;
  timezone: string;
  duration: number;
  format: string;
  link: string;
  location: string;
  notes: string;
  status: "proposed" | "scheduled" | "completed" | "cancelled";
  proposedBy: string;
  createdAt: number;
  updatedAt: number;
};
export type Message = {
  id: string;
  sender: string;
  text: string;
  createdAt: number;
};
export type Notice = {
  id: string;
  title: string;
  href: string;
  read: boolean;
  createdAt: number;
};
export type Review = {
  id: string;
  author: string;
  authorName: string;
  target: string;
  exchange: string;
  rating: number;
  text: string;
  communication: number;
  preparation: number;
  helpfulness: number;
  createdAt: number;
  hidden: boolean;
};
export const requestSchema = z
  .object({
    recipient: text(128).min(1),
    learn: text(60),
    offer: text(60),
    arrangement: z.enum(["Reciprocal", "Learn", "Teach"]),
    goals: text(1200).min(10),
    format: z.enum(["Online", "In person"]),
    schedule: text(300),
    message: text(1500),
    duration: z.coerce.number().int().min(15).max(180),
    draft: z.boolean().default(false),
  })
  .strict()
  .superRefine((d, c) => {
    if (d.arrangement !== "Teach" && !d.learn)
      c.addIssue({
        code: "custom",
        message: "Choose a skill to learn",
        path: ["learn"],
      });
    if (d.arrangement !== "Learn" && !d.offer)
      c.addIssue({
        code: "custom",
        message: "Choose a skill to offer",
        path: ["offer"],
      });
  });
export const sessionSchema = z
  .object({
    title: text(120).min(3),
    local: text(30).min(10),
    timezone: text(80),
    duration: z.coerce.number().int().min(15).max(180),
    format: z.enum(["Online", "In person"]),
    link: safeUrl,
    location: text(200),
    notes: text(1500),
  })
  .strict();
export const settingsSchema = z
  .object({
    brand: text(40).min(2),
    tagline: text(120),
    supportEmail: z.union([z.literal(""), z.email()]),
    categories: z.array(text(60).min(2)).min(1).max(30),
    languages: z.array(text(40).min(2)).min(1).max(30),
    durations: z.array(z.number().int().min(15).max(180)).min(1).max(10),
    guidelines: text(8000),
    faq: z
      .array(z.object({ q: text(200).min(2), a: text(1000).min(2) }))
      .max(20),
    termsUrl: safeUrl,
    privacyUrl: safeUrl,
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  brand: "SkillSpring",
  tagline: "A little of what you know. A world of what you could.",
  supportEmail: "",
  categories,
  languages: ["English", "Spanish", "French", "Hindi", "German", "Portuguese"],
  durations: [30, 45, 60, 90],
  guidelines:
    "Be respectful. Agree on goals, boundaries and session arrangements before meeting. Never request payment credentials or sensitive personal information. Report harassment, spam or misleading profiles. Moderators review context and may hide content or suspend access; participants may appeal through the reporting workflow.",
  faq: [
    {
      q: "Do I have to teach something in return?",
      a: "No. Choose a reciprocal exchange, ask to learn, or offer one-way mentoring. Both people agree before any session is scheduled.",
    },
    {
      q: "Do I need to be an expert?",
      a: "Not at all. Be honest about your experience and what you can help someone learn. A little practical knowledge can make a big difference.",
    },
    {
      q: "Where do sessions happen?",
      a: "Online through a meeting link you agree on, or in person. Exact schedules and meeting details are visible only to participants.",
    },
    {
      q: "Is there a payment system?",
      a: "SkillSpring does not process payments. The core experience is knowledge exchange and volunteer mentoring.",
    },
  ],
  termsUrl: "",
  privacyUrl: "",
};

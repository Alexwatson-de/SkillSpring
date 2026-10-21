"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, ArrowRight, Check, Upload } from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  blankProfile,
  blankSkill,
  catalog,
  categories,
  days,
  levels,
  profileSchema,
  type ProfileInput,
  type Skill,
  type Settings,
} from "@/lib/model";
import { api, useData, useSession } from "./provider";
import { Avatar, ErrorBox, PageTitle } from "./ui";
const steps = [
  "About you",
  "Your experience",
  "Skills to share",
  "Skills to learn",
  "Your preferences",
];
export function Onboarding({ edit = false }: { edit?: boolean }) {
  const { me, user, refresh, toast } = useSession();
  const { data: settings } = useData<Settings>("kind=settings");
  const router = useRouter();
  const [p, setP] = useState<ProfileInput>(() => {
    const parsed = profileSchema.safeParse(
      me?.profile
        ? Object.fromEntries(
            Object.keys(blankProfile()).map((k) => [
              k,
              me.profile![k as keyof ProfileInput],
            ]),
          )
        : blankProfile(user?.displayName || ""),
    );
    return parsed.success ? parsed.data : blankProfile(user?.displayName || "");
  });
  const [step, setStep] = useState(edit ? 1 : p.step);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [upload, setUpload] = useState(0);
  const [photo, setPhoto] = useState(me?.profile?.photo || "");
  const [restored, setRestored] = useState(false);
  const { data: extra } = useData<{ items: { name: string }[] }>(
    "kind=catalog",
  );
  useEffect(() => {
    const raw = localStorage.getItem(`skillspring.draft.${user?.uid}`);
    if (raw) {
      try {
        const parsed = profileSchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          setP(parsed.data);
          setStep(edit ? 1 : parsed.data.step);
        }
      } catch {}
    }
    setRestored(true);
  }, [user?.uid, edit]);
  useEffect(() => {
    if (restored)
      try {
        localStorage.setItem(
          `skillspring.draft.${user?.uid}`,
          JSON.stringify({ ...p, step }),
        );
      } catch {}
  }, [p, step, user?.uid, restored]);
  function set<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setP((old) => ({ ...old, [key]: value }));
    setSaved("");
  }
  async function persist(next: number, finish = false) {
    setBusy(true);
    setError("");
    try {
      const parsed = profileSchema.parse({ ...p, step: next });
      await api("", { action: "profile", profile: parsed, finish });
      setStep(next);
      setSaved("Progress saved");
      await refresh();
      if (finish) {
        localStorage.removeItem(`skillspring.draft.${user?.uid}`);
        toast(
          edit
            ? "Profile updated"
            : "Your profile is ready. Let’s find your people.",
        );
        router.push("/dashboard");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function next(e: FormEvent) {
    e.preventDefault();
    await persist(Math.min(5, step + 1), step === 5);
  }
  function changeSkill(
    which: "offered" | "wanted",
    index: number,
    key: keyof Skill,
    value: string | number,
  ) {
    set(
      which,
      p[which].map((s, i) => (i === index ? { ...s, [key]: value } : s)),
    );
  }
  async function uploadPhoto(file?: File) {
    if (!file) return;
    setError("");
    try {
      const token = await auth().currentUser?.getIdToken();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload");
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setUpload(Math.round((e.loaded / e.total) * 99));
        };
        xhr.onload = () => {
          try {
            const d = JSON.parse(xhr.responseText);
            if (xhr.status !== 200) reject(new Error(d.error));
            else {
              setPhoto(d.url);
              resolve();
            }
          } catch {
            reject(new Error("Upload failed"));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        const form = new FormData();
        form.set("file", file);
        xhr.send(form);
      });
      setUpload(100);
      toast("Profile photo updated");
    } catch (e) {
      setError((e as Error).message);
      setUpload(0);
    }
  }
  const fields = (
    list: {
      key: keyof ProfileInput;
      label: string;
      area?: boolean;
      required?: boolean;
      placeholder?: string;
    }[],
  ) =>
    list.map((f) => (
      <label key={f.key}>
        {f.label}
        {f.area ? (
          <textarea
            value={String(p[f.key])}
            onChange={(e) => set(f.key, e.target.value as never)}
            required={f.required}
            maxLength={1600}
          />
        ) : (
          <input
            value={String(p[f.key])}
            onChange={(e) => set(f.key, e.target.value as never)}
            required={f.required}
            placeholder={f.placeholder}
            maxLength={200}
          />
        )}
      </label>
    ));
  const skillForm = (which: "offered" | "wanted") => (
    <>
      <datalist id="skills-list">
        {[
          ...new Set([...catalog, ...(extra?.items.map((s) => s.name) || [])]),
        ].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p className="muted">
        {which === "offered"
          ? "You don’t need to know everything. Be specific about what you can help someone do."
          : "A little direction goes a long way. Tell people what you’d like to achieve."}
      </p>
      {p[which].map((s, i) => (
        <div className="skill-editor" key={i}>
          <div className="row between">
            <h3>
              {which === "offered" ? "Share" : "Learn"} skill {i + 1}
            </h3>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove skill ${i + 1}`}
              onClick={() =>
                set(
                  which,
                  p[which].filter((_, n) => n !== i),
                )
              }
            >
              <Trash2 size={18} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Skill name
              <input
                list="skills-list"
                value={s.name}
                required
                minLength={2}
                maxLength={60}
                onChange={(e) => changeSkill(which, i, "name", e.target.value)}
              />
            </label>
            <label>
              Category
              <select
                aria-label="Category"
                value={s.category}
                onChange={(e) =>
                  changeSkill(which, i, "category", e.target.value)
                }
              >
                {(settings?.categories || categories).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              {which === "offered" ? "Proficiency" : "Current level"}
              <select
                value={s.level}
                onChange={(e) => changeSkill(which, i, "level", e.target.value)}
              >
                {levels.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            {which === "wanted" ? (
              <label>
                Desired level
                <select
                  value={s.desiredLevel}
                  onChange={(e) =>
                    changeSkill(which, i, "desiredLevel", e.target.value)
                  }
                >
                  {levels.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Years of experience (optional)
                <input
                  type="number"
                  min={0}
                  max={80}
                  value={s.experience}
                  onChange={(e) =>
                    changeSkill(which, i, "experience", Number(e.target.value))
                  }
                />
              </label>
            )}
            <label className="span-two">
              {which === "offered"
                ? "What can you teach?"
                : "Your learning goals"}
              <textarea
                value={s.description}
                maxLength={1200}
                onChange={(e) =>
                  changeSkill(which, i, "description", e.target.value)
                }
              />
            </label>
            <label>
              Preferred format
              <select
                value={s.format}
                onChange={(e) =>
                  changeSkill(which, i, "format", e.target.value)
                }
              >
                {["Online", "In person", "Either"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            {which === "wanted" ? (
              <>
                <label>
                  Priority
                  <select
                    value={s.priority}
                    onChange={(e) =>
                      changeSkill(which, i, "priority", e.target.value)
                    }
                  >
                    {["High", "Medium", "Low"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Target date (optional)
                  <input
                    type="date"
                    value={s.targetDate}
                    onChange={(e) =>
                      changeSkill(which, i, "targetDate", e.target.value)
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Portfolio link (optional)
                  <input
                    type="url"
                    placeholder="https://"
                    value={s.link}
                    onChange={(e) =>
                      changeSkill(which, i, "link", e.target.value)
                    }
                  />
                </label>
                <label>
                  Availability notes (private)
                  <input
                    value={s.availability}
                    maxLength={200}
                    onChange={(e) =>
                      changeSkill(which, i, "availability", e.target.value)
                    }
                  />
                </label>
              </>
            )}
          </div>
          {s.name && !catalog.includes(s.name) && (
            <button
              type="button"
              className="text-button"
              onClick={async () => {
                try {
                  await api("", {
                    action: "proposeSkill",
                    skill: { name: s.name, category: s.category },
                  });
                  toast("Skill submitted for catalog moderation");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Propose “{s.name}” for the shared catalog
            </button>
          )}
        </div>
      ))}
      <button
        className="button secondary"
        type="button"
        disabled={p[which].length >= 15}
        onClick={() => set(which, [...p[which], { ...blankSkill }])}
      >
        <Plus size={17} />
        Add a skill to {which === "offered" ? "share" : "learn"}
      </button>
      <p className="caption">
        Custom profile skills are allowed. Shared catalog additions are
        moderated.
      </p>
    </>
  );
  return (
    <div className="onboarding">
      <datalist id="preferred-durations">
        {(settings?.durations || [30, 45, 60, 90]).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <PageTitle
        eyebrow={edit ? "KEEP GROWING" : "LET’S GET TO KNOW YOU"}
        title={
          edit ? "Your profile, your way." : "Make room for your next chapter."
        }
        text="Share what feels right. You can update everything later."
      />
      <div className="onboarding-layout">
        <aside className="step-nav">
          {steps.map((s, i) => (
            <div
              className={step === i + 1 ? "active" : step > i + 1 ? "done" : ""}
              key={s}
            >
              <span>{step > i + 1 ? <Check size={15} /> : i + 1}</span>
              <div>
                {s}
                <small>Step {i + 1} of 5</small>
              </div>
            </div>
          ))}
          <p>
            Your progress is saved on this device as you type and to your
            account when you continue.
          </p>
        </aside>
        <form className="panel onboarding-form" onSubmit={next}>
          <div className="progress-track">
            <motion.div animate={{ width: `${(step / 5) * 100}%` }} />
          </div>
          <div className="row between">
            <h2>{steps[step - 1]}</h2>
            <span className="muted">{step} / 5</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              {step === 1 && (
                <>
                  <div className="row photo-row">
                    <Avatar person={{ name: p.name, photo }} size="large" />
                    <label className="upload-label">
                      <Upload size={16} />
                      Add profile photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => void uploadPhoto(e.target.files?.[0])}
                      />
                      <small>Optional · JPEG, PNG, WebP · 4 MB max</small>
                    </label>
                    {upload > 0 && (
                      <span role="status">
                        {upload === 100 ? "Uploaded" : `${upload}%`}
                      </span>
                    )}
                  </div>
                  <div className="form-grid">
                    {fields([
                      { key: "name", label: "Full name", required: true },
                      {
                        key: "headline",
                        label: "Professional headline (optional)",
                      },
                      { key: "city", label: "City (optional)" },
                      { key: "country", label: "Country (optional)" },
                    ])}
                    <label>
                      Time zone
                      <select
                        aria-label="Time zone"
                        value={p.timezone}
                        onChange={(e) => set("timezone", e.target.value)}
                      >
                        {[
                          ...new Set([
                            "UTC",
                            "Asia/Kolkata",
                            p.timezone,
                            ...Intl.supportedValuesOf("timeZone"),
                          ]),
                        ].map((z) => (
                          <option key={z}>{z}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Languages (comma separated)
                      <input
                        required
                        value={p.languages.join(", ")}
                        onChange={(e) =>
                          set(
                            "languages",
                            e.target.value.split(",").map((s) => s.trim()),
                          )
                        }
                      />
                    </label>
                  </div>
                  {fields([
                    {
                      key: "bio",
                      label: "A little about you",
                      area: true,
                      required: true,
                    },
                    { key: "interests", label: "Areas of interest" },
                  ])}
                </>
              )}
              {step === 2 && (
                <>
                  <div className="form-grid">
                    {fields([
                      {
                        key: "role",
                        label: "Current role or occupation",
                        required: true,
                      },
                      { key: "industry", label: "Industry" },
                      {
                        key: "company",
                        label: "Company or organization (optional)",
                      },
                      { key: "education", label: "Education (optional)" },
                    ])}
                    <label>
                      Experience level
                      <select
                        value={p.experience}
                        onChange={(e) =>
                          set(
                            "experience",
                            e.target.value as ProfileInput["experience"],
                          )
                        }
                      >
                        {levels.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {fields([
                    {
                      key: "summary",
                      label: "Professional summary",
                      area: true,
                    },
                  ])}
                  <label>
                    Portfolio / GitHub / LinkedIn links (one HTTPS URL per line)
                    <textarea
                      value={p.links.join("\n")}
                      onChange={(e) =>
                        set("links", e.target.value.split("\n").filter(Boolean))
                      }
                    />
                  </label>
                </>
              )}
              {step === 3 && skillForm("offered")}
              {step === 4 && skillForm("wanted")}
              {step === 5 && (
                <>
                  <div className="form-grid">
                    <label>
                      Learning format
                      <select
                        value={p.format}
                        onChange={(e) =>
                          set(
                            "format",
                            e.target.value as ProfileInput["format"],
                          )
                        }
                      >
                        {["Online", "In person", "Either"].map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Exchange preference
                      <select
                        value={p.arrangement}
                        onChange={(e) =>
                          set(
                            "arrangement",
                            e.target.value as ProfileInput["arrangement"],
                          )
                        }
                      >
                        {["Both", "Reciprocal", "Mentoring"].map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Session duration (minutes)
                      <input
                        type="number"
                        min={15}
                        max={180}
                        step={15}
                        value={p.duration}
                        list="preferred-durations"
                        onChange={(e) =>
                          set("duration", Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      Private availability notes
                      <input
                        placeholder="e.g. evenings after 18:00"
                        value={p.availability}
                        maxLength={200}
                        onChange={(e) => set("availability", e.target.value)}
                      />
                    </label>
                  </div>
                  <fieldset>
                    <legend>
                      Available days (public summary, not a booking commitment)
                    </legend>
                    <div className="days">
                      {days.map((d) => (
                        <label className="check" key={d}>
                          <input
                            type="checkbox"
                            checked={p.availableDays.includes(
                              d as (typeof p.availableDays)[number],
                            )}
                            onChange={(e) =>
                              set(
                                "availableDays",
                                e.target.checked
                                  ? [
                                      ...p.availableDays,
                                      d as (typeof p.availableDays)[number],
                                    ]
                                  : p.availableDays.filter((x) => x !== d),
                              )
                            }
                          />
                          {d}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {fields([
                    {
                      key: "accessibility",
                      label: "Accessibility preferences (private)",
                      area: true,
                    },
                  ])}
                  <fieldset>
                    <legend>Privacy & notifications</legend>
                    {(
                      [
                        {
                          key: "publicProfile",
                          label: "Make my profile discoverable",
                        },
                        {
                          key: "publicLocation",
                          label: "Show my city and country publicly",
                        },
                        {
                          key: "publicHistory",
                          label: "Show my completed exchange count publicly",
                        },
                        {
                          key: "notifyMessages",
                          label: "Notify me about new messages",
                        },
                      ] as const
                    ).map((x) => (
                      <label className="check" key={x.key}>
                        <input
                          type="checkbox"
                          checked={p[x.key]}
                          onChange={(e) => set(x.key, e.target.checked)}
                        />
                        {x.label}
                      </label>
                    ))}
                  </fieldset>
                  <div className="summary-box">
                    <h3>Looking good, {p.name.split(" ")[0]}.</h3>
                    <p>
                      <b>Sharing:</b>{" "}
                      {p.offered.map((s) => s.name).join(", ") ||
                        "No skills yet"}
                    </p>
                    <p>
                      <b>Learning:</b>{" "}
                      {p.wanted.map((s) => s.name).join(", ") ||
                        "No skills yet"}
                    </p>
                    <p>
                      {p.languages.join(", ")} · {p.timezone} · {p.duration}
                      -minute sessions
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
          <ErrorBox message={error} />
          <div className="form-footer">
            <button
              type="button"
              className="button secondary"
              disabled={step === 1 || busy}
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
            <span role="status" className="caption">
              {saved}
            </span>
            <button className="button" disabled={busy}>
              {busy
                ? "Saving…"
                : step === 5
                  ? edit
                    ? "Save profile"
                    : "Let’s start growing"
                  : "Save & continue"}
              <ArrowRight size={17} />
            </button>
          </div>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => void persist(step)}
          >
            Save progress
          </button>
        </form>
      </div>
    </div>
  );
}

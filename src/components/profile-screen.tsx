"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Bookmark,
  Share2,
  Flag,
  Ban,
  Globe,
  MapPin,
  ArrowUpRight,
  Star,
} from "lucide-react";
import type { Profile, Review } from "@/lib/model";
import { api, useData, useSession } from "./provider";
import { Avatar, Empty, ErrorBox, Modal, Skeleton, Tag, dateTime } from "./ui";
import { RequestModal } from "./discovery";
export function ReportModal({
  type,
  target,
  exchange = "",
  onClose,
}: {
  type: "profile" | "message" | "review" | "skill" | "appeal";
  target: string;
  exchange?: string;
  onClose: () => void;
}) {
  const { toast } = useSession();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("", {
        action: "report",
        report: {
          type,
          target,
          exchange,
          reason: String(new FormData(e.currentTarget).get("reason")),
        },
      });
      toast("Report submitted privately to the moderation team");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Help keep this a good place." onClose={onClose}>
      <form onSubmit={submit}>
        <p>
          Tell us what happened. Reports are private and reviewed with relevant
          context. Immediate safety concerns should be directed to local
          emergency services.
        </p>
        <label>
          Reason for reporting
          <textarea name="reason" minLength={10} maxLength={2000} required />
        </label>
        <ErrorBox message={error} />
        <button className="button" disabled={busy}>
          {busy ? "Sending…" : "Submit report"}
        </button>
      </form>
    </Modal>
  );
}
export function ProfileScreen({ username }: { username: string }) {
  const { user, toast } = useSession();
  const router = useRouter();
  const { data, error, loading, reload } = useData<{
    profile: Profile;
    reviews: Review[];
  }>(`kind=profile&username=${encodeURIComponent(username)}`);
  const [tab, setTab] = useState("Overview");
  const [request, setRequest] = useState<
    "Learn" | "Teach" | "Reciprocal" | null
  >(null);
  const [skill, setSkill] = useState("");
  const [report, setReport] = useState<{
    type: "profile" | "review";
    target: string;
  } | null>(null);
  const [block, setBlock] = useState(false);
  async function save(skill = "") {
    try {
      await api("", { action: "save", target: data!.profile.id, skill });
      toast(skill ? "Skill saved" : "Profile saved");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  function connect(type: typeof request, skill = "") {
    if (!user) {
      router.push("/signup");
      return;
    }
    setSkill(skill);
    setRequest(type);
  }
  if (loading) return <Skeleton />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!data) return null;
  const p = data.profile;
  return (
    <>
      <Link href="/discover" className="text-link">
        ← Back to discovery
      </Link>
      <section className="profile-hero panel">
        <div className="profile-banner">
          <span>EVERYONE HAS SOMETHING TO SHARE.</span>
          <span>✳</span>
        </div>
        <div className="profile-heading">
          <Avatar person={p} size="xl" />
          <div>
            <div className="row">
              <h1>{p.name}</h1>
              {p.demo && <Tag>Demo profile</Tag>}
            </div>
            <p>{p.headline || p.role}</p>
            <div className="row muted">
              <span>
                <Globe size={14} />
                {p.languages.join(", ")}
              </span>
              {p.city && (
                <span>
                  <MapPin size={14} />
                  {p.city}, {p.country}
                </span>
              )}
            </div>
          </div>
          <div className="profile-actions">
            {user?.uid === p.id ? (
              <Link href="/profile/edit" className="button">
                Edit profile
              </Link>
            ) : (
              <button className="button" onClick={() => connect("Learn")}>
                Let’s connect <ArrowUpRight size={17} />
              </button>
            )}
            <div className="row">
              <button
                className="icon-button"
                aria-label="Save profile"
                onClick={() => void save()}
              >
                <Bookmark size={19} />
              </button>
              <button
                className="icon-button"
                aria-label="Share profile"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(location.href);
                    toast("Profile link copied");
                  } catch {
                    toast(
                      "Copy the profile address from your browser to share it.",
                    );
                  }
                }}
              >
                <Share2 size={19} />
              </button>
              {user && user.uid !== p.id && (
                <>
                  <button
                    className="icon-button"
                    aria-label="Report profile"
                    onClick={() => setReport({ type: "profile", target: p.id })}
                  >
                    <Flag size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Block member"
                    onClick={() => setBlock(true)}
                  >
                    <Ban size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="tabs">
          {[
            "Overview",
            "Skills offered",
            "Skills wanted",
            "Portfolio",
            "Reviews",
            "Exchange history",
          ].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </section>
      <div className="profile-layout">
        <div className="panel">
          {tab === "Overview" && (
            <>
              <p className="eyebrow">A LITTLE ABOUT {p.name.split(" ")[0]}</p>
              <h2>Curious minds welcome.</h2>
              <p className="prose">{p.bio}</p>
              <h3>Experience & perspective</h3>
              <p>
                {p.role}
                {p.company && ` at ${p.company}`} · {p.industry} ·{" "}
                {p.experience}
              </p>
              <p className="prose">
                {p.summary || "Professional summary not added yet."}
              </p>
              {p.education && (
                <p>
                  <b>Education:</b> {p.education}
                </p>
              )}
              {p.interests && (
                <p>
                  <b>Interests:</b> {p.interests}
                </p>
              )}
              <div className="two-columns">
                <div>
                  <small>HAPPY TO SHARE</small>
                  <div className="tags">
                    {p.offered.map((s) => (
                      <Tag tone="green" key={s.name}>
                        {s.name}
                      </Tag>
                    ))}
                  </div>
                </div>
                <div>
                  <small>CURIOUS ABOUT</small>
                  <div className="tags">
                    {p.wanted.map((s) => (
                      <Tag key={s.name}>{s.name}</Tag>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
          {(tab === "Skills offered" || tab === "Skills wanted") && (
            <>
              <h2>
                {tab === "Skills offered"
                  ? "A little of what I know."
                  : "A world of what I could."}
              </h2>
              {(tab === "Skills offered" ? p.offered : p.wanted).map((s) => (
                <article className="profile-skill" key={s.name}>
                  <div className="row between">
                    <h3>{s.name}</h3>
                    <Tag>{s.category}</Tag>
                  </div>
                  <p>{s.description || "Discuss learning goals together."}</p>
                  <p className="caption">
                    {s.level}
                    {tab === "Skills wanted"
                      ? ` → ${s.desiredLevel} · ${s.priority} priority`
                      : ` · ${s.experience} years experience`}{" "}
                    · {s.format}
                  </p>
                  {s.targetDate && <p>Target date: {s.targetDate}</p>}
                  {s.link && (
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link"
                    >
                      Supporting work <ArrowUpRight size={15} />
                    </a>
                  )}
                  <div className="row">
                    <button
                      className="button small secondary"
                      onClick={() =>
                        connect(
                          tab === "Skills offered" ? "Learn" : "Teach",
                          tab === "Skills offered" ? s.name : "",
                        )
                      }
                    >
                      {tab === "Skills offered"
                        ? "Request to learn"
                        : "Offer to teach"}
                      <ArrowUpRight size={14} />
                    </button>
                    {tab === "Skills offered" && (
                      <button
                        className="icon-button"
                        aria-label={`Save ${s.name}`}
                        onClick={() => void save(s.name)}
                      >
                        <Bookmark size={18} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {!(tab === "Skills offered" ? p.offered : p.wanted).length && (
                <Empty
                  title="Still exploring."
                  text="This member hasn’t added skills to this section yet."
                />
              )}
            </>
          )}
          {tab === "Portfolio" && (
            <>
              <h2>Work worth sharing.</h2>
              {p.links.length ? (
                p.links.map((l) => (
                  <a
                    key={l}
                    className="resource-link"
                    href={l}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {new URL(l).hostname}
                    <ArrowUpRight size={18} />
                  </a>
                ))
              ) : (
                <Empty
                  title="A story still unfolding."
                  text="No portfolio links shared yet."
                />
              )}
            </>
          )}
          {tab === "Reviews" && (
            <>
              <h2>From their learning partners.</h2>
              {data.reviews.length ? (
                data.reviews.map((r) => (
                  <article className="review" key={r.id}>
                    <div className="row between">
                      <b>{r.authorName}</b>
                      <Tag>
                        <Star size={13} />
                        {r.rating}/5
                      </Tag>
                    </div>
                    <p>{r.text}</p>
                    <div className="row between">
                      <small>
                        Verified completed exchange · {dateTime(r.createdAt)}
                      </small>
                      {user && (
                        <button
                          className="icon-button"
                          aria-label="Report review"
                          onClick={() =>
                            setReport({ type: "review", target: r.id })
                          }
                        >
                          <Flag size={14} />
                        </button>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <Empty
                  title="A fresh start."
                  text="Reviews appear after a completed exchange. No made-up stars here."
                />
              )}
            </>
          )}
          {tab === "Exchange history" && (
            <>
              <h2>Learning along the way.</h2>
              <p>
                {p.publicHistory
                  ? `${p.completedCount || 0} completed exchanges. Participant identities and private session details are never shared here.`
                  : "This member keeps their exchange history private."}
              </p>
            </>
          )}
        </div>
        <aside>
          <div className="panel">
            <p className="eyebrow">LET’S FIND A GOOD RHYTHM</p>
            <h3>Learning preferences</h3>
            <dl>
              <dt>Format</dt>
              <dd>{p.format}</dd>
              <dt>Arrangement</dt>
              <dd>
                {p.arrangement === "Both"
                  ? "Exchange or one-way mentoring"
                  : p.arrangement}
              </dd>
              <dt>Typical session</dt>
              <dd>{p.duration} minutes</dd>
              <dt>Languages</dt>
              <dd>{p.languages.join(", ")}</dd>
              <dt>Available days</dt>
              <dd>{p.availableDays.join(", ") || "Discuss together"}</dd>
              <dt>Time zone</dt>
              <dd>{p.timezone}</dd>
            </dl>
            <p className="caption">
              Exact availability and meeting details are private. Agree on times
              in your exchange workspace.
            </p>
            <button
              className="button secondary full"
              onClick={() => connect("Reciprocal")}
            >
              Propose a skill exchange
            </button>
            <button className="text-button" onClick={() => connect("Teach")}>
              Offer one-way mentoring
            </button>
          </div>
        </aside>
      </div>
      {request && (
        <RequestModal
          person={p}
          initial={request}
          skill={skill}
          onClose={() => setRequest(null)}
        />
      )}{" "}
      {report && <ReportModal {...report} onClose={() => setReport(null)} />}{" "}
      {block && (
        <Modal title={`Block ${p.name}?`} onClose={() => setBlock(false)}>
          <p>
            This prevents new contact and hides your profiles from each other
            while signed in. Public pages may still be viewed when signed out.
            You can unblock them in Settings.
          </p>
          <button
            className="button danger"
            onClick={async () => {
              try {
                await api("", { action: "block", target: p.id });
                toast("Member blocked");
                router.push("/settings");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            Block member
          </button>
        </Modal>
      )}
    </>
  );
}

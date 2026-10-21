"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ChevronRight,
  ArrowRight,
  Bookmark,
  Repeat2,
  Search,
  SlidersHorizontal,
  Globe,
  Star,
  X,
} from "lucide-react";
import {
  categories,
  days,
  levels,
  type Profile,
  type Settings,
} from "@/lib/model";
import { matchPeople } from "@/lib/matching";
import { api, useData, useSession } from "./provider";
import {
  Avatar,
  Empty,
  ErrorBox,
  Modal,
  PageTitle,
  Reveal,
  Skeleton,
  Tag,
} from "./ui";
type Match = ReturnType<typeof matchPeople>;
export type MatchedProfile = Profile & { match?: Match };
export function RequestModal({
  person,
  onClose,
  initial = "Learn",
  skill = "",
}: {
  person: Profile;
  onClose: () => void;
  initial?: "Learn" | "Teach" | "Reciprocal";
  skill?: string;
}) {
  const { me, toast } = useSession();
  const router = useRouter();
  const [arrangement, setArrangement] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const draft =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "draft";
    try {
      const r = await api<{ id: string }>("", {
        action: "request",
        request: {
          recipient: person.id,
          learn: String(f.get("learn") || ""),
          offer: String(f.get("offer") || ""),
          arrangement,
          goals: String(f.get("goals")),
          format: String(f.get("format")),
          schedule: String(f.get("schedule")),
          message: String(f.get("message")),
          duration: Number(f.get("duration")),
          draft,
        },
      });
      toast(
        draft
          ? "Draft saved privately"
          : "Request sent. Your partner can now review it.",
      );
      onClose();
      router.push(`/exchanges/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Connect with ${person.name.split(" ")[0]}`}
      onClose={onClose}
    >
      <form onSubmit={send}>
        <p className="muted">
          A thoughtful first step. Agree on the details together before
          scheduling.
        </p>
        <label>
          Arrangement
          <select
            value={arrangement}
            onChange={(e) =>
              setArrangement(e.target.value as typeof arrangement)
            }
          >
            <option value="Learn">I’d like to learn</option>
            <option value="Reciprocal">Exchange skills with each other</option>
            <option value="Teach">I’d like to offer mentoring</option>
          </select>
        </label>
        {arrangement !== "Teach" && (
          <label>
            Skill you want to learn
            <select
              name="learn"
              defaultValue={skill || person.offered[0]?.name}
              required
            >
              <option value="">Choose a skill</option>
              {person.offered.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
        {arrangement !== "Learn" && (
          <label>
            Skill you can offer
            <select name="offer" required>
              <option value="">Choose a skill</option>
              {me?.profile?.offered.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
            {!me?.profile?.offered.length && (
              <small>Add a skill to share in your profile first.</small>
            )}
          </label>
        )}
        <label>
          What would you like to achieve?
          <textarea
            name="goals"
            required
            minLength={10}
            maxLength={1200}
            placeholder="A clear goal is a great place to start…"
          />
        </label>
        <div className="form-grid">
          <label>
            Preferred format
            <select name="format">
              <option>Online</option>
              <option>In person</option>
            </select>
          </label>
          <label>
            Session length (minutes)
            <input
              name="duration"
              type="number"
              min={15}
              max={180}
              defaultValue={me?.profile?.duration || 45}
              required
            />
          </label>
        </div>
        <label>
          Suggested availability
          <input
            name="schedule"
            maxLength={300}
            placeholder={`e.g. Tuesday evenings (${me?.profile?.timezone || "your time zone"})`}
          />
        </label>
        <label>
          A personal hello (optional)
          <textarea name="message" maxLength={1500} />
        </label>
        <ErrorBox message={error} />
        <div className="row">
          <button className="button" disabled={busy} value="send">
            {busy ? "Saving…" : "Send request"}
            <ChevronRight size={16} />
          </button>
          <button className="button secondary" value="draft" disabled={busy}>
            Save draft
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function PersonCard({
  person,
  onRequest,
}: {
  person: MatchedProfile;
  onRequest: (p: Profile) => void;
}) {
  const { user, toast } = useSession();
  async function save() {
    try {
      await api("", { action: "save", target: person.id });
      toast("Profile saved to your collection");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <Reveal className="member-card">
      <div className="row between">
        <Link href={`/people/${person.username}`} className="row">
          <Avatar person={person} />
          <div>
            <h3>{person.name}</h3>
            <p>{person.headline || person.role}</p>
          </div>
        </Link>
        {user && (
          <button
            className="icon-button"
            aria-label={`Save ${person.name}`}
            onClick={save}
          >
            <Bookmark size={18} />
          </button>
        )}
      </div>
      {person.demo && <Tag>Demo member</Tag>}
      <p className="member-bio">{person.bio}</p>
      <small>CAN SHARE</small>
      <div className="skill-offers">
        {person.offered.slice(0, 3).map((s) => (
          <div key={s.name}>
            <Tag tone="green">{s.name}</Tag>
            <span>{s.level}</span>
          </div>
        ))}
      </div>
      <small>WANTS TO LEARN</small>
      <p className="wanted-list">
        {person.wanted.map((s) => s.name).join(" · ") ||
          "Open to sharing knowledge"}
      </p>
      {person.match && (
        <div className="match-box">
          <b>
            <Repeat2 size={15} />
            {person.match.reciprocal
              ? "A two-way connection"
              : "A place to start"}{" "}
            · {person.match.score} points
          </b>
          {person.match.reasons.slice(0, 3).map((r) => (
            <span key={r}>{r}</span>
          ))}
        </div>
      )}
      <div className="card-meta">
        <span>
          <Globe size={14} />
          {person.format}
        </span>
        <span>
          {person.availableDays
            .slice(0, 2)
            .map((d) => d.slice(0, 3))
            .join(" · ") || "Ask about availability"}
        </span>
        {!!person.reviewCount && (
          <span>
            <Star size={13} />
            {person.rating?.toFixed(1)} ({person.reviewCount})
          </span>
        )}
      </div>
      <div className="card-footer">
        <Link href={`/people/${person.username}`} className="text-link">
          View profile <ChevronRight size={16} />
        </Link>
        <button
          className="button small secondary"
          onClick={() => onRequest(person)}
        >
          Connect <ArrowRight size={14} />
        </button>
      </div>
    </Reveal>
  );
}
export function Discovery({ matches = false }: { matches?: boolean }) {
  const { data: settings } = useData<Settings>("kind=settings");
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const [search, setSearch] = useState(params.get("q") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);
  const query = `kind=${matches ? "matches" : "people"}&${params.toString()}`;
  const { data, error, loading, reload } = useData<{
    items: MatchedProfile[];
    next: string | null;
    scope: string;
  }>(query);
  function filter(k: string, v: string) {
    const q = new URLSearchParams(params);
    q.delete("cursor");
    if (v) q.set(k, v);
    else q.delete(k);
    router.replace(`${matches ? "/matches" : "/discover"}?${q.toString()}`, {
      scroll: false,
    });
  }
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== (params.get("q") || "")) {
        const q = new URLSearchParams(params);
        q.delete("cursor");
        if (search) q.set("q", search);
        else q.delete("q");
        router.replace(`${matches ? "/matches" : "/discover"}?${q}`, {
          scroll: false,
        });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, params, router, matches]);
  function request(p: Profile) {
    if (!user) router.push("/signup");
    else setSelected(p);
  }
  const active = [...params.entries()].filter(
    ([k]) => !["sort", "cursor", "direction"].includes(k),
  );
  const select = (k: string, label: string, values: string[]) => (
    <label>
      {label}
      <select
        value={params.get(k) || ""}
        onChange={(e) => filter(k, e.target.value)}
      >
        <option value="">Any {label.toLowerCase()}</option>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <PageTitle
        eyebrow={matches ? "GOOD TOGETHER" : "FOLLOW YOUR CURIOSITY"}
        title={
          matches
            ? "Find your learning counterpart."
            : "A world of skills. Your kind of people."
        }
        text={
          matches
            ? "Real skill overlaps, clear explanations, and room for one-way mentoring."
            : "Find someone to learn with, teach, or trade a little know-how."
        }
      />
      {matches && (
        <>
          <div className="tabs">
            {[
              ["", "Best matches"],
              ["learn", "I want to learn"],
              ["teach", "I can teach"],
              ["reciprocal", "Reciprocal"],
            ].map(([v, label]) => (
              <button
                className={
                  (params.get("direction") || "") === v ? "active" : ""
                }
                onClick={() => filter("direction", v)}
                key={v}
              >
                {label}
              </button>
            ))}
          </div>
          <details className="scoring">
            <summary>How matching points work</summary>
            <p>
              Up to 100 defined points: skills you can learn (30), skills you
              can share (30), target proficiency (10), shared language (10),
              compatible format (5), a common available day (5), goal-keyword
              overlap (5), and relevant experience of 2+ years (5). Points are
              not a probability. Exact times must be agreed in conversation.
            </p>
          </details>
        </>
      )}
      <div className="search-bar">
        <div>
          <Search size={20} />
          <input
            aria-label="Search skills or people"
            placeholder="Try React, photography, or a member’s name…"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X size={17} />
            </button>
          )}
        </div>
        <button
          className={`button secondary ${showFilters ? "selected" : ""}`}
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal size={17} />
          Filters{active.length > 0 && ` (${active.length})`}
        </button>
      </div>
      {!search && (
        <div className="suggestions">
          <small>A LITTLE INSPIRATION</small>
          {["React", "UI/UX design", "Spanish", "Photography"].map((s) => (
            <button key={s} onClick={() => setSearch(s)}>
              {s}
              <ChevronRight size={12} />
            </button>
          ))}
        </div>
      )}
      {showFilters && (
        <div className="panel filters form-grid">
          {select("category", "Category", settings?.categories || categories)}
          {select("level", "Proficiency", Array.from(levels))}
          {select(
            "language",
            "Language",
            settings?.languages || [
              "English",
              "Spanish",
              "French",
              "Hindi",
              "German",
              "Portuguese",
            ],
          )}
          {select("format", "Format", ["Online", "In person"])}
          {select("day", "Day", days)}
          {select("arrangement", "Arrangement", ["Reciprocal", "Mentoring"])}
          <label>
            Location (public profiles only)
            <input
              value={params.get("location") || ""}
              onChange={(e) => filter("location", e.target.value)}
            />
          </label>
          <label>
            Teaching experience
            <select
              value={params.get("experience") || ""}
              onChange={(e) => filter("experience", e.target.value)}
            >
              <option value="">Any experience</option>
              <option value="2">2+ years</option>
              <option value="5">5+ years</option>
            </select>
          </label>
          <label>
            Genuine review rating
            <select
              value={params.get("rating") || ""}
              onChange={(e) => filter("rating", e.target.value)}
            >
              <option value="">Any rating / not yet rated</option>
              <option value="4">4+ stars</option>
            </select>
          </label>
        </div>
      )}
      {active.length > 0 && (
        <div className="tags active-filters">
          {active.map(([k, v]) => (
            <button
              key={k}
              className="tag"
              onClick={() => {
                if (k === "q") setSearch("");
                filter(k, "");
              }}
            >
              {k}: {v}
              <X size={13} />
            </button>
          ))}
          <button
            className="text-button"
            onClick={() => {
              setSearch("");
              router.replace(matches ? "/matches" : "/discover");
            }}
          >
            Clear all
          </button>
        </div>
      )}
      <div className="results-heading">
        <span>
          {loading
            ? "Finding possibilities…"
            : `${data?.items.length || 0} people on this page`}
        </span>
        <label>
          Sort by
          <select
            aria-label="Sort results"
            value={params.get("sort") || "recent"}
            onChange={(e) => filter("sort", e.target.value)}
          >
            {!matches && (
              <>
                <option value="recent">Recently updated</option>
                <option value="name">Name</option>
                <option value="rating">Review rating</option>
              </>
            )}
            {matches && <option value="recent">Match points</option>}
          </select>
        </label>
      </div>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Skeleton />
      ) : data?.items.length ? (
        <div className="people-grid">
          {data.items.map((p) => (
            <PersonCard person={p} onRequest={request} key={p.id} />
          ))}
        </div>
      ) : (
        !error && (
          <Empty
            title="There’s room for a new connection."
            text="No people match on this page. Try fewer filters, continue to the next page, or invite someone to join."
          />
        )
      )}
      {data?.next && (
        <button
          className="button secondary next-page"
          onClick={() => {
            const q = new URLSearchParams(params);
            q.set("cursor", data.next!);
            router.push(`${matches ? "/matches" : "/discover"}?${q}`);
          }}
        >
          Next page <ArrowRight size={16} />
        </button>
      )}
      <p className="caption">{data?.scope}</p>
      {selected && (
        <RequestModal
          person={selected}
          onClose={() => setSelected(null)}
          initial={matches ? "Reciprocal" : "Learn"}
        />
      )}
    </>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Repeat2,
  CalendarDays,
  Bookmark,
  Bell,
  MessageCircle,
} from "lucide-react";
import type { Exchange, Notice, Profile, Session } from "@/lib/model";
import { api, useData, useSession } from "./provider";
import { Empty, ErrorBox, PageTitle, Skeleton, Tag, dateTime } from "./ui";
import { ExchangeRow } from "./exchanges";
import { PersonCard, RequestModal, type MatchedProfile } from "./discovery";
export function Dashboard() {
  const { me, user } = useSession();
  const p = me?.profile;
  const { data, error, loading, reload } = useData<{
    exchanges: Exchange[];
    sessions: (Session & { exchange: string })[];
    notifications: Notice[];
    saved: number;
    unread: number;
    scope: string;
  }>("kind=dashboard", 30000);
  const { data: matches } = useData<{ items: MatchedProfile[] }>(
    "kind=matches",
  );
  const [selected, setSelected] = useState<Profile | null>(null);
  const pending =
    data?.exchanges.filter(
      (e) =>
        e.recipient === user?.uid &&
        ["pending", "discussion"].includes(e.status),
    ) || [];
  const active =
    data?.exchanges.filter((e) =>
      ["accepted", "scheduled", "in_progress"].includes(e.status),
    ) || [];
  const completion = p
    ? Math.round(
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
      )
    : 0;
  return (
    <>
      <PageTitle
        eyebrow="YOUR DAILY DOSE OF POSSIBILITY"
        title={`A little growth looks good on you, ${p?.name.split(" ")[0] || "friend"}.`}
        text="What will you share, learn, or discover today?"
        action={
          <Link href="/discover" className="button">
            Discover people <ArrowUpRight size={17} />
          </Link>
        }
      />
      <ErrorBox message={error} retry={reload} />
      {loading && !data ? (
        <Skeleton />
      ) : (
        <>
          <div className="dashboard-stats">
            {[
              {
                name: "Decisions to make",
                value: pending.length,
                icon: Repeat2,
                href: "/exchanges",
              },
              {
                name: "Active exchanges",
                value: active.length,
                icon: MessageCircle,
                href: "/exchanges",
              },
              {
                name: "Upcoming sessions",
                value: data?.sessions.length || 0,
                icon: CalendarDays,
                href: "/sessions",
              },
              {
                name: "Saved possibilities",
                value: data?.saved || 0,
                icon: Bookmark,
                href: "/saved",
              },
            ].map((s) => (
              <Link key={s.name} href={s.href} className="stat">
                <s.icon size={20} />
                <strong>{s.value}</strong>
                <span>{s.name}</span>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </div>
          <p className="caption">
            Exchange counts reflect your latest 30 records. Upcoming sessions
            show the next 12.
          </p>
          <div className="dashboard-grid">
            <section>
              <div className="dashboard-skill-pair">
                <div className="panel teach-panel">
                  <span className="eyebrow">A LITTLE OF WHAT YOU KNOW</span>
                  <div className="row between">
                    <h2>Ready to share.</h2>
                    <Link
                      href="/profile/edit"
                      className="icon-button"
                      aria-label="Add a skill to teach"
                    >
                      <Plus size={19} />
                    </Link>
                  </div>
                  <div className="tags">
                    {p?.offered.length ? (
                      p.offered.map((s) => <Tag key={s.name}>{s.name}</Tag>)
                    ) : (
                      <p>No offered skills yet.</p>
                    )}
                  </div>
                  <Link href="/matches?direction=teach" className="text-link">
                    Find someone to teach <ArrowUpRight size={15} />
                  </Link>
                </div>
                <div className="panel learn-panel">
                  <span className="eyebrow">A WORLD OF WHAT YOU COULD</span>
                  <div className="row between">
                    <h2>Curious about.</h2>
                    <Link
                      href="/profile/edit"
                      className="icon-button"
                      aria-label="Add a skill to learn"
                    >
                      <Plus size={19} />
                    </Link>
                  </div>
                  <div className="tags">
                    {p?.wanted.length ? (
                      p.wanted.map((s) => <Tag key={s.name}>{s.name}</Tag>)
                    ) : (
                      <p>No learning goals yet.</p>
                    )}
                  </div>
                  <Link href="/matches?direction=learn" className="text-link">
                    Find someone to learn from <ArrowUpRight size={15} />
                  </Link>
                </div>
              </div>
              <div className="row between section-mini-heading">
                <h2>Connections in the making.</h2>
                <Link href="/exchanges" className="text-link">
                  All exchanges <ArrowUpRight size={16} />
                </Link>
              </div>
              {pending.length ? (
                pending
                  .slice(0, 3)
                  .map((e) => <ExchangeRow exchange={e} key={e.id} />)
              ) : active.length ? (
                active
                  .slice(0, 3)
                  .map((e) => <ExchangeRow exchange={e} key={e.id} />)
              ) : (
                <div className="panel">
                  <Empty
                    title="Your next connection is one hello away."
                    text="Explore people whose skills meet your curiosity. A thoughtful request is all it takes to start."
                    href="/discover"
                  />
                </div>
              )}
              <div className="row between section-mini-heading">
                <h2>A good place to start.</h2>
                <Link href="/matches" className="text-link">
                  All matches <ArrowUpRight size={16} />
                </Link>
              </div>
              {matches?.items.length ? (
                <div className="two-columns">
                  {matches.items.slice(0, 2).map((person) => (
                    <PersonCard
                      person={person}
                      onRequest={setSelected}
                      key={person.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="panel">
                  <p>
                    No matches yet. Keep your learning goals current as the
                    community grows.
                  </p>
                  <Link href="/profile/edit" className="text-link">
                    Update your skills <ArrowUpRight size={15} />
                  </Link>
                </div>
              )}
            </section>
            <aside className="dashboard-aside">
              <div className="panel profile-progress">
                <div className="row between">
                  <span className="eyebrow">LET PEOPLE KNOW YOU</span>
                  <b>{completion}%</b>
                </div>
                <h3>A profile with a little personality.</h3>
                <div className="progress-track">
                  <div style={{ width: `${completion}%` }} />
                </div>
                <p>A clearer picture helps the right people find you.</p>
                <Link href="/profile/edit" className="text-link">
                  Polish your profile <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="panel">
                <div className="row between">
                  <h3>On the horizon.</h3>
                  <CalendarDays size={19} />
                </div>
                {data?.sessions.length ? (
                  data.sessions.slice(0, 3).map((s) => (
                    <Link
                      href={`/exchanges/${s.exchange}?tab=sessions`}
                      className="upcoming-item"
                      key={s.id}
                    >
                      <b>{s.title}</b>
                      <span>{dateTime(s.startsAt, p?.timezone)}</span>
                      <small>
                        {s.duration} minutes · {s.format}
                      </small>
                    </Link>
                  ))
                ) : (
                  <p className="muted">
                    A little breathing room. Schedule a session after your next
                    request is accepted.
                  </p>
                )}
                <Link href="/sessions" className="text-link">
                  Your schedule <ArrowUpRight size={15} />
                </Link>
              </div>
              <div className="panel">
                <div className="row between">
                  <h3>The latest.</h3>
                  <Bell size={19} />
                </div>
                {data?.notifications.length ? (
                  data.notifications.map((n) => (
                    <Link className="activity-item" href={n.href} key={n.id}>
                      <span className="live-dot" />
                      <div>
                        {n.title}
                        <small>{dateTime(n.createdAt, p?.timezone)}</small>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="muted">
                    You’re all caught up. New requests, messages, and session
                    updates will appear here.
                  </p>
                )}
                <Link href="/notifications" className="text-link">
                  All updates <ArrowUpRight size={15} />
                </Link>
              </div>
            </aside>
          </div>
        </>
      )}
      {selected && (
        <RequestModal
          person={selected}
          onClose={() => setSelected(null)}
          initial="Reciprocal"
        />
      )}
    </>
  );
}
export function Notifications() {
  const { toast } = useSession();
  const [cursor, setCursor] = useState("");
  const { data, error, loading, reload } = useData<{
    items: Notice[];
    next: string | null;
  }>(`kind=notifications&cursor=${cursor}`, 20000);
  async function markAll() {
    try {
      let more = true;
      while (more) {
        const r = await api<{ more: boolean }>("", {
          action: "readAllNotifications",
        });
        more = r.more;
      }
      reload();
      toast("All notifications marked as read");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="IN THE LOOP"
        title="Your community, in motion."
        text="Meaningful updates, without the noise."
        action={
          <button className="button secondary" onClick={markAll}>
            Mark all as read
          </button>
        }
      />
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Skeleton />
      ) : data?.items.length ? (
        <div className="panel notification-list">
          {data.items.map((n) => (
            <div className={n.read ? "" : "unread"} key={n.id}>
              <Bell size={19} />
              <Link
                href={n.href}
                onClick={() =>
                  void api("", { action: "readNotifications", ids: [n.id] })
                    .then(reload)
                    .catch(() => {})
                }
              >
                <b>{n.title}</b>
                <small>{dateTime(n.createdAt)}</small>
              </Link>
              {!n.read && (
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await api("", {
                        action: "readNotifications",
                        ids: [n.id],
                      });
                      reload();
                    } catch (e) {
                      toast((e as Error).message);
                    }
                  }}
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="All quiet, in a good way."
          text="New requests, messages, sessions, and reviews will show up here."
        />
      )}
      {data?.next && (
        <button
          className="button secondary"
          onClick={() => setCursor(data.next!)}
        >
          Older updates <ArrowRight size={16} />
        </button>
      )}
    </>
  );
}
export function Saved() {
  const { toast } = useSession();
  const [cursor, setCursor] = useState("");
  const [tab, setTab] = useState("All");
  const { data, error, loading, reload } = useData<{
    items: { id: string; skill: string; profile: Profile | null }[];
    next: string | null;
  }>(`kind=saved&cursor=${cursor}`);
  const items = data?.items.filter(
    (i) =>
      tab === "All" ||
      (tab === "People" && !i.skill) ||
      (tab === "Skills" && !!i.skill),
  );
  return (
    <>
      <PageTitle
        eyebrow="KEEP A LITTLE POSSIBILITY CLOSE"
        title="Your collection."
        text="People and skills you’d like to come back to. Only visible to you."
      />
      <div className="tabs">
        {["All", "People", "Skills"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t}
          </button>
        ))}
      </div>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Skeleton />
      ) : items?.length ? (
        <div className="people-grid">
          {items.map((i) => (
            <div className="panel" key={i.id}>
              <Bookmark size={24} />
              <h3>{i.skill || i.profile?.name || "Unavailable profile"}</h3>
              <p>
                {i.profile?.headline ||
                  "This member may no longer be available."}
              </p>
              {i.profile && (
                <Link
                  className="text-link"
                  href={`/people/${i.profile.username}`}
                >
                  View {i.profile.name}
                  <ArrowUpRight size={16} />
                </Link>
              )}
              <button
                className="text-button danger-text"
                onClick={async () => {
                  try {
                    await api("", { action: "removeSaved", id: i.id });
                    reload();
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                Remove from saved
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Save a little inspiration."
          text="Bookmark a profile or skill as you explore, and find it here when you’re ready."
          href="/discover"
        />
      )}
      {data?.next && (
        <button
          className="button secondary"
          onClick={() => setCursor(data.next!)}
        >
          More saved items
        </button>
      )}
    </>
  );
}
export function Sessions() {
  const { me } = useSession();
  const { data, error, loading, reload } = useData<{
    sessions: (Session & { exchange: string })[];
  }>("kind=dashboard");
  return (
    <>
      <PageTitle
        eyebrow="MAKE TIME FOR WHAT’S NEXT"
        title="Your learning calendar."
        text={`Upcoming confirmed sessions · ${me?.profile?.timezone || "Your local time"}. Open an exchange to propose or reschedule.`}
        action={
          <Link href="/exchanges" className="button">
            Manage exchanges <ArrowUpRight size={17} />
          </Link>
        }
      />
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Skeleton />
      ) : data?.sessions.length ? (
        <div className="people-grid">
          {data.sessions.map((s) => (
            <Link
              href={`/exchanges/${s.exchange}?tab=sessions`}
              className="panel"
              key={s.id}
            >
              <CalendarDays size={25} />
              <h3>{s.title}</h3>
              <p>{dateTime(s.startsAt, me?.profile?.timezone)}</p>
              <Tag>
                {s.duration} minutes · {s.format}
              </Tag>
              <p className="text-link">
                Open exchange <ArrowUpRight size={16} />
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="Make space for something good."
          text="Accepted exchanges can have sessions. Propose a time and let your partner confirm it."
          href="/exchanges"
          label="Review exchanges"
        />
      )}
    </>
  );
}

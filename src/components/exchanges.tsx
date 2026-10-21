"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DateTime } from "luxon";
import {
  ArrowUpRight,
  Send,
  CalendarPlus,
  Flag,
  Check,
  Clock,
  MessageCircle,
  Repeat2,
} from "lucide-react";
import type { Exchange, Message, Review, Session } from "@/lib/model";
import { api, useData, useSession } from "./provider";
import {
  Empty,
  ErrorBox,
  Modal,
  PageTitle,
  Skeleton,
  Tag,
  dateTime,
} from "./ui";
import { ReportModal } from "./profile-screen";
export function ExchangeList({ messages = false }: { messages?: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const { data, error, loading, reload } = useData<{
    items: Exchange[];
    next: string | null;
  }>(`kind=exchanges&${params.toString()}`, 20000);
  const [tab, setTab] = useState("All");
  const items =
    data?.items.filter(
      (e) =>
        tab === "All" ||
        (tab === "Incoming" && e.recipient === user?.uid) ||
        (tab === "Outgoing" && e.sender === user?.uid) ||
        (tab === "Active" &&
          ["accepted", "scheduled", "in_progress"].includes(e.status)) ||
        (tab === "Completed" && e.status === "completed"),
    ) || [];
  return (
    <>
      <PageTitle
        eyebrow={
          messages ? "KEEP THE CONVERSATION GROWING" : "A LITTLE GIVE AND TAKE"
        }
        title={messages ? "Your conversations." : "Your exchanges."}
        text={
          messages
            ? "Private conversations, connected to a real learning goal."
            : "Turn a good connection into something you learn together."
        }
        action={
          <Link href="/discover" className="button">
            Find a connection <ArrowUpRight size={17} />
          </Link>
        }
      />
      <div className="tabs">
        {["All", "Incoming", "Outgoing", "Active", "Completed"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={t === tab ? "active" : ""}
          >
            {t}
          </button>
        ))}
      </div>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Skeleton />
      ) : items.length ? (
        <div className="exchange-list">
          {items.map((e) => (
            <ExchangeRow exchange={e} key={e.id} messages={messages} />
          ))}
        </div>
      ) : (
        <Empty
          title={
            messages
              ? "A good conversation starts with a hello."
              : "Your next exchange is out there."
          }
          text="Discover someone with a skill you’re curious about and send a thoughtful request."
          href="/discover"
        />
      )}
      {data?.next && (
        <button
          className="button secondary"
          onClick={() =>
            router.push(
              `${messages ? "/messages" : "/exchanges"}?cursor=${data.next}`,
            )
          }
        >
          Next page
        </button>
      )}
    </>
  );
}
export function ExchangeRow({
  exchange: e,
  messages = false,
}: {
  exchange: Exchange;
  messages?: boolean;
}) {
  const { user } = useSession();
  const other = e.participants.find((x) => x !== user?.uid) || "";
  const unread = (e.lastMessageAt || 0) > (e.lastRead?.[user?.uid || ""] || 0);
  return (
    <Link
      href={`/exchanges/${e.id}${messages ? "?tab=conversation" : ""}`}
      className="exchange-row"
    >
      <span className="exchange-icon">
        {messages ? <MessageCircle size={23} /> : <Repeat2 size={23} />}
      </span>
      <div>
        <h3>
          {e.names[other] || "Exchange partner"}{" "}
          {messages && unread && <span className="unread-dot" />}
        </h3>
        <p>
          {messages
            ? e.lastMessage || "Start the conversation"
            : `${e.learn || "Mentoring"}${e.offer ? " ↔ " + e.offer : ""}`}
        </p>
        <small>{dateTime(e.updatedAt)}</small>
      </div>
      <Tag tone={e.status === "completed" ? "green" : ""}>
        {e.status.replace("_", " ")}
      </Tag>
      <ArrowUpRight size={19} />
    </Link>
  );
}
export function SessionModal({
  exchangeId,
  session,
  onClose,
  onDone,
}: {
  exchangeId: string;
  session?: Session;
  onClose: () => void;
  onDone: () => void;
}) {
  const { me, toast } = useSession();
  const [zone, setZone] = useState(
    session?.timezone ||
      me?.profile?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [format, setFormat] = useState(session?.format || "Online");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("", {
        action: "session",
        id: exchangeId,
        sessionId: session?.id,
        session: {
          title: String(f.get("title")),
          local: String(f.get("local")),
          timezone: zone,
          duration: Number(f.get("duration")),
          format,
          link: String(f.get("link") || ""),
          location: String(f.get("location") || ""),
          notes: String(f.get("notes")),
        },
      });
      toast("Time proposed. Your partner needs to confirm it.");
      onDone();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={session ? "Propose a new time" : "Make time to grow."}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          Session title
          <input
            name="title"
            required
            minLength={3}
            maxLength={120}
            defaultValue={session?.title || "Our learning session"}
          />
        </label>
        <label>
          Time zone
          <select
            aria-label="Time zone"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          >
            {["UTC", ...Intl.supportedValuesOf("timeZone")].map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Date & time in {zone}
            <input
              name="local"
              type="datetime-local"
              required
              defaultValue={
                session
                  ? DateTime.fromMillis(session.startsAt)
                      .setZone(zone)
                      .toFormat("yyyy-MM-dd'T'HH:mm")
                  : ""
              }
            />
          </label>
          <label>
            Duration (minutes)
            <input
              name="duration"
              type="number"
              required
              min={15}
              max={180}
              defaultValue={session?.duration || me?.profile?.duration || 45}
            />
          </label>
        </div>
        <label>
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option>Online</option>
            <option>In person</option>
          </select>
        </label>
        {format === "Online" ? (
          <label>
            Meeting link (optional)
            <input
              type="url"
              name="link"
              placeholder="https://"
              defaultValue={session?.link}
            />
          </label>
        ) : (
          <label>
            Agreed meeting location
            <input
              name="location"
              required
              minLength={3}
              maxLength={200}
              defaultValue={session?.location}
            />
          </label>
        )}
        <label>
          Notes
          <textarea
            name="notes"
            maxLength={1500}
            defaultValue={session?.notes}
          />
        </label>
        <p className="caption">
          Your partner sees this in their own time zone. Ambiguous
          daylight-saving times must be changed. No meeting provider or calendar
          account is required.
        </p>
        <ErrorBox message={error} />
        <button className="button" disabled={busy}>
          {busy ? "Saving…" : "Send time proposal"}
          <CalendarPlus size={17} />
        </button>
      </form>
    </Modal>
  );
}
export function ExchangeWorkspace({ id }: { id: string }) {
  const { user, me, toast } = useSession();
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "overview");
  const { data, error, loading, reload } = useData<{
    exchange: Exchange;
    messages: Message[];
    sessions: Session[];
    reviews: Review[];
    moreMessages: boolean;
  }>(`kind=exchange&id=${id}`, 12000);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [schedule, setSchedule] = useState<Session | "new" | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [older, setOlder] = useState<Message[]>([]);
  const [more, setMore] = useState(true);
  const [close, setClose] = useState(false);
  const e = data?.exchange;
  const uid = user?.uid || "";
  const zone = me?.profile?.timezone || "UTC";
  const closed =
    e && ["completed", "cancelled", "declined", "withdrawn"].includes(e.status);
  const active =
    e && ["accepted", "scheduled", "in_progress"].includes(e.status);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const lastMessageAt = e?.lastMessageAt;
  useEffect(() => {
    if (tab === "conversation")
      void api("", { action: "readConversation", id }).catch(() => {});
  }, [lastMessageAt, id, tab]);
  async function act(body: Record<string, unknown>, message = "Updated") {
    setBusy(true);
    setActionError("");
    try {
      await api("", { ...body, id });
      toast(message);
      reload();
      return true;
    } catch (e) {
      setActionError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function message(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const text = String(new FormData(form).get("text"));
    if (await act({ action: "message", text }, "Message sent")) form.reset();
  }
  async function olderMessages() {
    try {
      const first = older[0] || data?.messages[0];
      if (!first) return;
      const d = await api<{ items: Message[]; more: boolean }>(
        `kind=messages&id=${id}&before=${first.createdAt}`,
      );
      setOlder((v) => [...d.items, ...v]);
      setMore(d.more);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  if (loading && !data) return <Skeleton />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!e || !data) return null;
  const other = e.participants.find((x) => x !== uid)!;
  const allMessages = [
    ...new Map([...older, ...data.messages].map((m) => [m.id, m])).values(),
  ].sort((a, b) => a.createdAt - b.createdAt);
  return (
    <>
      <Link href="/exchanges" className="text-link">
        ← All exchanges
      </Link>
      <PageTitle
        eyebrow={`YOUR EXCHANGE WITH ${e.names[other]}`}
        title={`${e.learn || e.offer}${e.learn && e.offer ? " ↔ " + e.offer : ""}`}
        text={
          e.arrangement === "Reciprocal"
            ? "Two perspectives. A shared opportunity."
            : "One-way learning, with room to grow."
        }
        action={<Tag tone="green">{e.status.replace("_", " ")}</Tag>}
      />
      <div className="tabs">
        {["overview", "conversation", "sessions", "resources", "feedback"].map(
          (t) => (
            <button
              key={t}
              className={t === tab ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ),
        )}
      </div>
      <ErrorBox message={actionError} />
      {["pending", "discussion"].includes(e.status) && (
        <div className="decision-banner">
          <div>
            <h3>
              {e.recipient === uid
                ? "A new possibility. What do you think?"
                : "Your request is with your learning partner."}
            </h3>
            <p>Discuss goals and expectations before agreeing.</p>
          </div>
          <div className="row">
            {e.recipient === uid ? (
              <>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    act(
                      { action: "transition", status: "accepted" },
                      "Request accepted",
                    )
                  }
                >
                  Accept request <Check size={16} />
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    act(
                      { action: "transition", status: "declined" },
                      "Request declined",
                    )
                  }
                >
                  Decline
                </button>
              </>
            ) : (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  act(
                    { action: "transition", status: "withdrawn" },
                    "Request withdrawn",
                  )
                }
              >
                Withdraw request
              </button>
            )}
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                if (
                  await act(
                    { action: "transition", status: "discussion" },
                    "Discussion opened",
                  )
                )
                  setTab("conversation");
              }}
            >
              Discuss first
            </button>
          </div>
        </div>
      )}
      {e.status === "draft" && (
        <div className="decision-banner">
          <p>This draft is private. Your recipient hasn’t been notified.</p>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              act({ action: "transition", status: "pending" }, "Request sent")
            }
          >
            Send draft <ArrowUpRight size={16} />
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              act(
                { action: "transition", status: "withdrawn" },
                "Draft withdrawn",
              )
            }
          >
            Discard draft
          </button>
        </div>
      )}
      {tab === "overview" && (
        <div className="workspace-grid">
          <div className="panel">
            <p className="eyebrow">THE REASON WE’RE HERE</p>
            <h2>What we’re working toward.</h2>
            <p className="prose">{e.goals}</p>
            <h3>A personal hello</h3>
            <p className="prose">
              {e.message || "Start your conversation to introduce yourselves."}
            </p>
            <div className="two-columns">
              <div>
                <small>LEARNING</small>
                <h3>{e.learn || "One-way mentoring"}</h3>
                <p>{e.names[e.sender]}</p>
              </div>
              <div>
                <small>SHARING IN RETURN</small>
                <h3>{e.offer || "No reciprocal skill required"}</h3>
                <p>{e.names[e.recipient]}</p>
              </div>
            </div>
            <button
              className="button secondary"
              onClick={() => setTab("conversation")}
            >
              Go to conversation <MessageCircle size={16} />
            </button>
          </div>
          <div className="panel">
            <h3>The arrangement</h3>
            <dl>
              <dt>Format</dt>
              <dd>{e.format}</dd>
              <dt>Session length</dt>
              <dd>{e.duration} minutes</dd>
              <dt>Suggested availability</dt>
              <dd>{e.schedule || "To be discussed"}</dd>
              <dt>Started</dt>
              <dd>{dateTime(e.createdAt, zone)}</dd>
            </dl>
            {active && (
              <>
                <button
                  className="button full"
                  onClick={() => setSchedule("new")}
                >
                  <CalendarPlus size={17} />
                  Propose a session
                </button>
                <button
                  className="button secondary full"
                  disabled={busy || e.completionVotes.includes(uid)}
                  onClick={() =>
                    act(
                      { action: "complete" },
                      "Completion confirmation recorded",
                    )
                  }
                >
                  {e.completionVotes.includes(uid)
                    ? "Waiting for partner confirmation"
                    : "Confirm exchange complete"}
                </button>
                <p className="caption">
                  After at least one completed session, both participants must
                  confirm to close the exchange and unlock reviews.
                </p>
                <button
                  className="text-button danger-text"
                  onClick={() => setClose(true)}
                >
                  Cancel exchange
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {tab === "conversation" && (
        <div className="panel conversation">
          <div className="row between">
            <h3>A conversation with {e.names[other]}</h3>
            <Tag>Participants only</Tag>
          </div>
          {data.moreMessages && more && (
            <button className="text-button" onClick={olderMessages}>
              Load earlier messages
            </button>
          )}
          <div
            className="message-history"
            role="log"
            aria-live="polite"
            aria-label="Exchange messages"
          >
            {allMessages.length ? (
              allMessages.map((m) => (
                <div
                  key={m.id}
                  className={`message ${m.sender === uid ? "mine" : ""}`}
                >
                  <b>{e.names[m.sender]}</b>
                  <p>{m.text}</p>
                  <div>
                    <small>
                      {dateTime(m.createdAt, zone)}
                      {m.sender === uid && e.lastRead?.[other] >= m.createdAt
                        ? " · Read"
                        : ""}
                    </small>
                    {m.sender !== uid && (
                      <button
                        className="icon-button"
                        aria-label="Report message"
                        onClick={() => setReport(m.id)}
                      >
                        <Flag size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <Empty
                title="Start with a hello."
                text="Introduce yourself, ask a question, or suggest a learning goal."
              />
            )}
          </div>
          {!["draft", "cancelled", "declined", "withdrawn"].includes(
            e.status,
          ) && (
            <form className="message-composer" onSubmit={message}>
              <label className="sr-only" htmlFor="message-text">
                Your message
              </label>
              <textarea
                id="message-text"
                name="text"
                required
                minLength={1}
                maxLength={2000}
                placeholder="A question, an idea, a friendly hello…"
              />
              <button
                className="button"
                disabled={busy}
                aria-label="Send message"
              >
                <Send size={19} />
              </button>
            </form>
          )}
        </div>
      )}
      {tab === "sessions" && (
        <div className="panel">
          <div className="row between">
            <div>
              <h2>Time well spent.</h2>
              <p className="muted">Displayed in {zone}.</p>
            </div>
            {active && (
              <button className="button" onClick={() => setSchedule("new")}>
                <CalendarPlus size={17} />
                Propose a session
              </button>
            )}
          </div>
          {data.sessions.length ? (
            data.sessions.map((s) => (
              <article className="session-card" key={s.id}>
                <div className="row between">
                  <h3>{s.title}</h3>
                  <Tag>{s.status}</Tag>
                </div>
                <p>
                  <Clock size={16} /> {dateTime(s.startsAt, zone)} ·{" "}
                  {s.duration} minutes
                </p>
                <p>
                  {s.format}
                  {s.location ? ` · ${s.location}` : ""}
                </p>
                {s.link && (
                  <a
                    className="text-link"
                    href={s.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open meeting link <ArrowUpRight size={15} />
                  </a>
                )}
                <p className="prose">{s.notes}</p>
                <div className="row">
                  {active &&
                    s.status === "proposed" &&
                    s.proposedBy !== uid && (
                      <button
                        className="button small"
                        disabled={busy}
                        onClick={() =>
                          act(
                            {
                              action: "sessionStatus",
                              sessionId: s.id,
                              status: "scheduled",
                            },
                            "Session confirmed",
                          )
                        }
                      >
                        Confirm time
                      </button>
                    )}
                  {active &&
                    s.status === "proposed" &&
                    s.proposedBy === uid && (
                      <small>Waiting for your partner to confirm.</small>
                    )}
                  {active && s.status === "scheduled" && (
                    <button
                      className="button small"
                      disabled={busy || s.startsAt + s.duration * 60000 > now}
                      onClick={() =>
                        act(
                          {
                            action: "sessionStatus",
                            sessionId: s.id,
                            status: "completed",
                          },
                          "Session completed",
                        )
                      }
                    >
                      Mark session completed
                    </button>
                  )}
                  {active && ["proposed", "scheduled"].includes(s.status) && (
                    <>
                      <button
                        className="button secondary small"
                        onClick={() => setSchedule(s)}
                      >
                        Propose another time
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          act(
                            {
                              action: "sessionStatus",
                              sessionId: s.id,
                              status: "cancelled",
                            },
                            "Session cancelled",
                          )
                        }
                      >
                        Cancel session
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))
          ) : (
            <Empty
              title="Find your rhythm."
              text={
                active
                  ? "Propose a time. Your partner confirms it before it becomes a scheduled session."
                  : "Sessions unlock once the request is accepted."
              }
            />
          )}
        </div>
      )}
      {tab === "resources" && (
        <div className="panel">
          <h2>A shared space for your progress.</h2>
          <form
            key={`${id}-${tab}`}
            onSubmit={(event) => {
              event.preventDefault();
              const f = new FormData(event.currentTarget);
              void act(
                {
                  action: "notes",
                  notes: String(f.get("notes")),
                  resources: String(f.get("resources"))
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
                "Progress and resources saved",
              );
            }}
          >
            <label>
              Progress notes
              <textarea
                name="notes"
                maxLength={5000}
                rows={7}
                defaultValue={e.notes}
                disabled={!active}
              />
            </label>
            <label>
              Shared HTTPS resources (one per line)
              <textarea
                name="resources"
                rows={4}
                defaultValue={e.resources?.join("\n")}
                disabled={!active}
              />
            </label>
            {active && (
              <button className="button" disabled={busy}>
                Save shared notes
              </button>
            )}
          </form>
          <div className="resource-list">
            {e.resources?.map((r) => (
              <a href={r} rel="noopener noreferrer" target="_blank" key={r}>
                {r}
                <ArrowUpRight size={14} />
              </a>
            ))}
          </div>
        </div>
      )}
      {tab === "feedback" && (
        <div className="panel">
          <h2>A little feedback goes a long way.</h2>
          {e.status !== "completed" ? (
            <Empty
              title="Reflect when you’re ready."
              text="Both partners must confirm exchange completion before reviews unlock."
            />
          ) : data.reviews.some((r) => r.author === uid) ? (
            <div className="success">
              <Check />
              Thank you. Your verified exchange feedback is recorded.
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const f = new FormData(event.currentTarget);
                void act(
                  {
                    action: "review",
                    review: {
                      rating: Number(f.get("rating")),
                      text: String(f.get("text")),
                      communication: Number(f.get("communication")),
                      preparation: Number(f.get("preparation")),
                      helpfulness: Number(f.get("helpfulness")),
                    },
                  },
                  "Thank you for your honest feedback",
                );
              }}
            >
              <div className="form-grid">
                {["rating", "communication", "preparation", "helpfulness"].map(
                  (name) => (
                    <label key={name}>
                      {name === "rating"
                        ? "Overall rating"
                        : name[0].toUpperCase() + name.slice(1)}
                      <select
                        aria-label={
                          name === "rating"
                            ? "Overall rating"
                            : name[0].toUpperCase() + name.slice(1)
                        }
                        name={name}
                        required
                        defaultValue=""
                      >
                        <option value="">Choose a rating</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} / 5
                          </option>
                        ))}
                      </select>
                    </label>
                  ),
                )}
              </div>
              <label>
                Your feedback
                <textarea
                  name="text"
                  minLength={10}
                  maxLength={1500}
                  required
                />
              </label>
              <button className="button" disabled={busy}>
                Share verified review
              </button>
            </form>
          )}
        </div>
      )}
      {closed && (
        <p className="caption">
          This exchange is {e.status}. Past sessions and notes remain available
          to participants.
        </p>
      )}
      {schedule && (
        <SessionModal
          exchangeId={id}
          session={schedule === "new" ? undefined : schedule}
          onClose={() => setSchedule(null)}
          onDone={reload}
        />
      )}{" "}
      {report && (
        <ReportModal
          type="message"
          target={report}
          exchange={id}
          onClose={() => setReport(null)}
        />
      )}{" "}
      {close && (
        <Modal title="Cancel this exchange?" onClose={() => setClose(false)}>
          <p>
            This closes the exchange and cancels upcoming session entries. Both
            participants keep their history.
          </p>
          <button
            className="button danger"
            disabled={busy}
            onClick={async () => {
              if (
                await act(
                  { action: "transition", status: "cancelled" },
                  "Exchange cancelled",
                )
              )
                setClose(false);
            }}
          >
            Cancel exchange
          </button>
        </Modal>
      )}
    </>
  );
}

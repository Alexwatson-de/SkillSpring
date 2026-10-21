"use client";
import { useState, type FormEvent } from "react";
import { ShieldCheck, ChevronRight, Search } from "lucide-react";
import { api, useData, useSession } from "./provider";
import { defaultSettings, type Settings } from "@/lib/model";
import {
  Empty,
  ErrorBox,
  Modal,
  PageTitle,
  Skeleton,
  Tag,
  dateTime,
} from "./ui";
type AdminRow = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  state?: string;
  status?: string;
  category?: string;
  canonical?: string;
  createdAt: number;
  type?: string;
  target?: string;
  reason?: string;
  note?: string;
  reporter?: string;
  action?: string;
  actor?: string;
};
export function AdminScreen() {
  const { me, toast } = useSession();
  const [tab, setTab] = useState("overview");
  const [cursor, setCursor] = useState("");
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminRow | null>(null);
  const [evidence, setEvidence] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useData<{
    counts?: Record<string, number>;
    active?: number;
    complete?: number;
    pending?: number;
    items?: AdminRow[];
    next?: string;
  }>(
    tab === "settings"
      ? null
      : `kind=admin&tab=${tab}&cursor=${cursor}&filter=${filter}&q=${encodeURIComponent(query)}`,
  );
  const { data: settings, reload: reloadSettings } =
    useData<Settings>("kind=settings");
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ evidence?: unknown }>("", body);
      if (body.action === "adminEvidence") setEvidence(r.evidence);
      else {
        toast("Administrative change recorded");
        reload();
        reloadSettings();
        setSelected(null);
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!["admin", "owner"].includes(me?.role || ""))
    return (
      <Empty
        title="This area is for administrators."
        text="Access is checked on the server, not just in this interface."
        href="/dashboard"
        label="Return to dashboard"
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="A COMMUNITY WORTH CARING FOR"
        title="The stewardship desk."
        text="Keep the community useful, welcoming, and safe. Every sensitive action is audited."
        action={
          <Tag>
            <ShieldCheck size={15} />
            {me?.role}
          </Tag>
        }
      />
      <div className="tabs">
        {[
          ["overview", "Overview"],
          ["accounts", "People"],
          ["skills", "Skill catalog"],
          ["reports", "Reports"],
          ["audit", "Audit log"],
          ["settings", "Platform settings"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={tab === v ? "active" : ""}
            onClick={() => {
              setTab(v);
              setCursor("");
              setFilter("");
              setQuery("");
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <ErrorBox message={error || loadError} retry={reload} />
      {loading && tab !== "settings" ? (
        <Skeleton />
      ) : (
        <>
          {tab === "overview" && (
            <>
              <div className="dashboard-stats">
                {[
                  {
                    name: "Registered SkillSpring accounts",
                    n: data?.counts?.accounts,
                  },
                  { name: "Active in the last 30 days", n: data?.active },
                  { name: "Catalog skills", n: data?.counts?.skills },
                  { name: "Pending skill submissions", n: data?.pending },
                  { name: "Exchange requests", n: data?.counts?.exchanges },
                  { name: "Completed exchanges", n: data?.complete },
                  { name: "Reports (all statuses)", n: data?.counts?.reports },
                ].map((x) => (
                  <div className="stat" key={x.name}>
                    <strong>{x.n ?? 0}</strong>
                    <span>{x.name}</span>
                  </div>
                ))}
              </div>
              <p className="caption">
                Active means an active SkillSpring member with a recorded visit
                or profile update in the preceding 30 days. Shared Firebase
                users who have not joined SkillSpring are not counted.
              </p>
              {me?.role === "owner" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => act({ action: "adminMaintenance" })}
                >
                  Retry privacy cleanup & catalog maintenance
                </button>
              )}
            </>
          )}
          {["accounts", "skills", "reports", "audit"].includes(tab) && (
            <>
              <div className="row between admin-toolbar">
                {tab === "accounts" && (
                  <form
                    className="search-bar"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setCursor("");
                      setQuery(
                        String(new FormData(e.currentTarget).get("email")),
                      );
                    }}
                  >
                    <input
                      name="email"
                      type="email"
                      placeholder="Search exact email"
                      aria-label="Search users by exact email"
                    />
                    <button className="icon-button" aria-label="Search users">
                      <Search size={18} />
                    </button>
                  </form>
                )}
                {tab !== "audit" && (
                  <label>
                    Filter
                    <select
                      value={filter}
                      onChange={(e) => {
                        setFilter(e.target.value);
                        setCursor("");
                      }}
                    >
                      <option value="">All</option>
                      {(tab === "accounts"
                        ? ["active", "suspended"]
                        : tab === "skills"
                          ? ["pending", "approved", "rejected", "merged"]
                          : ["New", "Under Review", "Action Taken", "Resolved"]
                      ).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                )}
                {tab === "skills" && (
                  <button
                    className="button"
                    onClick={() =>
                      setSelected({ id: "", createdAt: 0, status: "approved" })
                    }
                  >
                    Add catalog skill
                  </button>
                )}
              </div>
              <div className="panel table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{tab === "audit" ? "Action" : "Record"}</th>
                      <th>Details</th>
                      <th>State</th>
                      <th>Date</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items?.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <b>{r.name || r.action || r.type}</b>
                          <small>{r.email || r.id}</small>
                        </td>
                        <td>
                          {r.category ||
                            r.role ||
                            r.reason?.slice(0, 110) ||
                            r.target}
                          <small>{r.actor}</small>
                        </td>
                        <td>
                          <Tag>{r.status || r.state || "Recorded"}</Tag>
                        </td>
                        <td>{dateTime(r.createdAt)}</td>
                        <td>
                          {tab !== "audit" && (
                            <button
                              className="text-button"
                              onClick={() => {
                                setSelected(r);
                                setEvidence(null);
                              }}
                            >
                              Manage <ChevronRight size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data?.items?.length && (
                  <Empty
                    title="Nothing needs attention here."
                    text="Records will appear as the community grows."
                  />
                )}
              </div>
              {data?.next && (
                <button
                  className="button secondary"
                  onClick={() => setCursor(data.next!)}
                >
                  Next page
                </button>
              )}
            </>
          )}
          {tab === "settings" && (
            <SettingsForm
              key={JSON.stringify(settings || defaultSettings)}
              value={settings || defaultSettings}
              busy={busy}
              onSave={(value) =>
                act({ action: "adminSettings", settings: value })
              }
            />
          )}
        </>
      )}
      {selected && (
        <Modal
          title={
            tab === "accounts"
              ? "Manage community access"
              : tab === "reports"
                ? "Review this report"
                : "Manage catalog skill"
          }
          onClose={() => setSelected(null)}
        >
          {tab === "accounts" && (
            <>
              <p>
                <b>{selected.name}</b> · {selected.email}
              </p>
              <p>
                Suspension affects SkillSpring only. It does not disable the
                shared Firebase account or access to other applications.
              </p>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  act({
                    action: "adminUser",
                    target: selected.id,
                    state:
                      selected.state === "suspended" ? "active" : "suspended",
                  })
                }
              >
                {selected.state === "suspended"
                  ? "Reinstate SkillSpring access"
                  : "Suspend SkillSpring access"}
              </button>
              {me?.role === "owner" && selected.role !== "owner" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    act({
                      action: "adminRole",
                      target: selected.id,
                      role: selected.role === "admin" ? "member" : "admin",
                    })
                  }
                >
                  {selected.role === "admin"
                    ? "Remove administrator role"
                    : "Grant administrator role"}
                </button>
              )}
            </>
          )}
          {tab === "skills" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act({
                  action: "adminSkill",
                  id: selected.id || undefined,
                  name: String(f.get("name")),
                  category: String(f.get("category")),
                  status: String(f.get("status")),
                  canonical: String(f.get("canonical")),
                });
              }}
            >
              <label>
                Skill name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={60}
                  defaultValue={selected.name}
                />
              </label>
              <label>
                Category
                <select name="category" defaultValue={selected.category}>
                  {(settings || defaultSettings).categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue={selected.status}>
                  {["approved", "pending", "rejected", "merged"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Canonical name (required when merging)
                <input name="canonical" defaultValue={selected.canonical} />
              </label>
              <p className="caption">
                Merged catalog entries become aliases. Existing member skill
                records are normalized by the trusted maintenance worker.
              </p>
              <button className="button" disabled={busy}>
                Save catalog entry
              </button>
            </form>
          )}
          {tab === "reports" && (
            <>
              <p>
                <b>{selected.type}</b> · {selected.target}
              </p>
              <p className="prose">{selected.reason}</p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  act({ action: "adminEvidence", id: selected.id })
                }
              >
                View relevant evidence (audited)
              </button>
              {evidence !== null && (
                <pre className="evidence">
                  {JSON.stringify(evidence, null, 2)}
                </pre>
              )}
              {selected.type === "review" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    act({
                      action: "adminHideReview",
                      id: selected.target,
                      hidden: true,
                    })
                  }
                >
                  Hide reported review
                </button>
              )}
              {selected.type === "profile" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    act({
                      action: "adminUser",
                      target: selected.target,
                      state: "suspended",
                    })
                  }
                >
                  Suspend reported member
                </button>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act({
                    action: "adminReport",
                    id: selected.id,
                    status: String(f.get("status")),
                    note: String(f.get("note")),
                  });
                }}
              >
                <label>
                  Report status
                  <select name="status" defaultValue={selected.status}>
                    {["New", "Under Review", "Action Taken", "Resolved"].map(
                      (s) => (
                        <option key={s}>{s}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Moderation decision and rationale
                  <textarea
                    name="note"
                    required
                    minLength={5}
                    maxLength={2000}
                    defaultValue={selected.note}
                  />
                </label>
                <button className="button" disabled={busy}>
                  Record decision
                </button>
              </form>
            </>
          )}
          <ErrorBox message={error} />
        </Modal>
      )}
    </>
  );
}
function SettingsForm({
  value,
  busy,
  onSave,
}: {
  value: Settings;
  busy: boolean;
  onSave: (v: Settings) => Promise<boolean>;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await onSave({
      brand: String(f.get("brand")),
      tagline: String(f.get("tagline")),
      supportEmail: String(f.get("supportEmail")),
      categories: String(f.get("categories"))
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      languages: String(f.get("languages"))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      durations: String(f.get("durations")).split(",").map(Number),
      guidelines: String(f.get("guidelines")),
      faq: String(f.get("faq"))
        .split("\n")
        .filter(Boolean)
        .map((s) => {
          const [q, ...a] = s.split("|");
          return { q: q.trim(), a: a.join("|").trim() };
        }),
      termsUrl: String(f.get("termsUrl")),
      privacyUrl: String(f.get("privacyUrl")),
    });
  }
  return (
    <form className="panel settings-form" onSubmit={submit}>
      <h2>A consistent community experience.</h2>
      <div className="form-grid">
        <label>
          Brand name
          <input name="brand" required defaultValue={value.brand} />
        </label>
        <label>
          Tagline
          <input name="tagline" defaultValue={value.tagline} />
        </label>
        <label>
          Support email
          <input
            type="email"
            name="supportEmail"
            defaultValue={value.supportEmail}
          />
        </label>
        <label>
          Supported languages (comma separated)
          <input name="languages" defaultValue={value.languages.join(", ")} />
        </label>
        <label>
          Default durations (comma separated minutes)
          <input name="durations" defaultValue={value.durations.join(", ")} />
        </label>
      </div>
      <label>
        Categories (one per line)
        <textarea
          name="categories"
          rows={6}
          defaultValue={value.categories.join("\n")}
        />
      </label>
      <label>
        Community guidelines
        <textarea name="guidelines" rows={5} defaultValue={value.guidelines} />
      </label>
      <label>
        FAQ (one question | answer per line)
        <textarea
          name="faq"
          rows={7}
          defaultValue={value.faq.map((f) => `${f.q} | ${f.a}`).join("\n")}
        />
      </label>
      <div className="form-grid">
        <label>
          Optional reviewed Terms URL
          <input type="url" name="termsUrl" defaultValue={value.termsUrl} />
        </label>
        <label>
          Optional reviewed Privacy URL
          <input type="url" name="privacyUrl" defaultValue={value.privacyUrl} />
        </label>
      </div>
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : "Save platform settings"}
      </button>
    </form>
  );
}

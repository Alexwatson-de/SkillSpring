"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api, useData, useSession } from "./provider";
import { ErrorBox, Modal, PageTitle, Empty } from "./ui";
export function SettingsScreen() {
  const { user, me, toast, logout } = useSession();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, reload } = useData<{ items: { id: string; target: string }[] }>(
    "kind=blocks",
  );
  return (
    <>
      <PageTitle
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your settings."
        text="Your privacy, your preferences, your pace."
      />
      <div className="settings-layout">
        <section className="panel">
          <h2>Profile & preferences</h2>
          <p>
            Manage your skills, public visibility, available days, languages,
            and message notification preferences.
          </p>
          <Link className="button secondary" href="/profile/edit">
            Edit profile & preferences
          </Link>
        </section>
        <section className="panel">
          <h2>Account security</h2>
          <p>
            Signed in as {user?.email}. This email is private and is never
            included in public profiles.
          </p>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await sendPasswordResetEmail(auth(), user!.email!);
                toast("Password-reset instructions requested");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            Send password-reset email
          </button>
          <p className="caption">
            Authentication is shared with other apps in this Firebase project.
            Changing your password changes that shared sign-in.
          </p>
        </section>
        <section className="panel">
          <h2>Blocked accounts</h2>
          {data?.items.length ? (
            data.items.map((b) => (
              <div className="row between" key={b.id}>
                <span>Blocked member · {b.target.slice(0, 8)}</span>
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await api("", {
                        action: "block",
                        target: b.target,
                        remove: true,
                      });
                      reload();
                      toast("Member unblocked");
                    } catch (e) {
                      toast((e as Error).message);
                    }
                  }}
                >
                  Unblock
                </button>
              </div>
            ))
          ) : (
            <p>No blocked accounts.</p>
          )}
        </section>
        <section className="panel danger-panel">
          <h2>Leave SkillSpring</h2>
          <p>
            Remove your public profile and request private-data erasure. Shared
            exchange history is anonymized, while limited moderation and audit
            records may be retained. Your shared Firebase login is preserved so
            other applications are not affected.
          </p>
          <button
            className="button secondary danger-text"
            disabled={me?.role === "owner"}
            onClick={() => setDeleting(true)}
          >
            Delete my SkillSpring account
          </button>
          {me?.role === "owner" && (
            <p className="caption">
              The owner must transfer ownership through the trusted operator
              first.
            </p>
          )}
        </section>
      </div>
      {deleting && (
        <Modal title="Leave SkillSpring?" onClose={() => setDeleting(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("", {
                  action: "deleteAccount",
                  confirm: String(new FormData(e.currentTarget).get("confirm")),
                });
                localStorage.removeItem(`skillspring.draft.${user?.uid}`);
                await logout();
                toast(
                  "Your profile is no longer public. Your data-erasure request has been recorded.",
                );
                router.push("/");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              This cannot be undone. You must have signed in within the last
              five minutes. Sign out and back in first if necessary.
            </p>
            <label>
              Type DELETE to confirm
              <input
                name="confirm"
                required
                pattern="DELETE"
                autoComplete="off"
              />
            </label>
            <ErrorBox message={error} />
            <button className="button danger" disabled={busy}>
              {busy ? "Removing…" : "Delete SkillSpring account"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function PolicyPage({ kind }: { kind: string }) {
  const { data } = useData<{
    supportEmail: string;
    guidelines: string;
    termsUrl: string;
    privacyUrl: string;
  }>("kind=settings");
  return (
    <div className="panel policy">
      <PageTitle
        eyebrow="A CLEARER COMMUNITY"
        title={
          kind === "privacy"
            ? "Your privacy matters."
            : kind === "terms"
              ? "Our shared understanding."
              : kind === "contact"
                ? "We’re listening."
                : "Good things need good ground rules."
        }
      />
      {kind === "guidelines" ? (
        <p className="prose">{data?.guidelines}</p>
      ) : kind === "contact" ? (
        data?.supportEmail ? (
          <p>
            Contact the community team at{" "}
            <a className="text-link" href={`mailto:${data.supportEmail}`}>
              {data.supportEmail}
            </a>
            . Use the reporting tools for member or message concerns.
          </p>
        ) : (
          <Empty
            title="Support contact is being set up."
            text="The platform owner has not published a support email yet. Signed-in members can report profiles, messages and reviews to the moderation team."
          />
        )
      ) : kind === "privacy" ? (
        <>
          <p>
            SkillSpring uses Firebase Authentication for sign-in and Firestore
            for profiles, requests, private messages, sessions and feedback.
            Cloudinary processes optional profile photos. Public profile
            visibility and location sharing are controlled in your profile
            preferences.
          </p>
          <p>
            Email addresses, precise availability, accessibility notes, saved
            items, conversations and meeting details are not public. Exchange
            participants can view their shared workspace. Authorized moderators
            may inspect content connected to a report; those accesses are
            audited.
          </p>
          <p>
            A session is stored as a UTC timestamp and displayed in your
            selected time zone. Local onboarding drafts are stored on your
            device until completion or deletion. There is no advertising tracker
            or analytics integration enabled by this app.
          </p>
          <p>
            Account deletion removes your public profile and queues erasure of
            private application data. Shared records are anonymized where
            necessary for the other participant; moderation and administrative
            audit evidence may be retained for safety. Your authentication
            identity is shared with other apps in the configured Firebase
            project and is not deleted by SkillSpring.
          </p>
          {data?.privacyUrl && (
            <a
              href={data.privacyUrl}
              className="text-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the operator’s reviewed privacy policy
            </a>
          )}
        </>
      ) : (
        <>
          <p>
            Be honest about your abilities, respect others’ time, and agree on
            learning objectives and arrangements before meeting. Participation
            is voluntary; SkillSpring does not guarantee learning outcomes or
            endorse individual members.
          </p>
          <p>
            Do not harass, spam, impersonate others, upload unlawful content, or
            request sensitive personal or financial information. Do not share
            another person’s private messages or meeting details without
            permission.
          </p>
          <p>
            Use meeting links you trust. For in-person meetings, choose a safe
            public location. SkillSpring does not provide video hosting, payment
            processing, insurance, certification, or background checks.
          </p>
          <p>
            Reviews must reflect a genuine completed exchange. Report
            inappropriate content; moderators may hide content or suspend
            SkillSpring access. Use the contact channel to appeal a moderation
            decision.
          </p>
          {data?.termsUrl && (
            <a
              href={data.termsUrl}
              className="text-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the operator’s reviewed terms
            </a>
          )}
        </>
      )}
      <p className="caption">
        Operational policy draft. The platform operator should review legal
        terms, retention periods, age eligibility, and applicable jurisdictions
        before a general public launch.
      </p>
    </div>
  );
}

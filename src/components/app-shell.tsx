"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { sendEmailVerification } from "firebase/auth";
import {
  LayoutDashboard,
  Search,
  Repeat2,
  MessagesSquare,
  CalendarDays,
  Bookmark,
  Bell,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { api, useData, useSession } from "./provider";
import { Avatar, Brand, Empty, ErrorBox, Skeleton } from "./ui";
import { defaultSettings, type Settings as SettingsType } from "@/lib/model";
export function AppShell({
  children,
  publicPage = false,
}: {
  children: ReactNode;
  publicPage?: boolean;
}) {
  const { user, me, loading, error, refresh, logout, toast } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const { data: s } = useData<SettingsType>("kind=settings");
  const { data: notifications } = useData<{ unread: number }>(
    user && me?.profile?.onboarded ? "kind=dashboard" : null,
    45000,
  );
  useEffect(() => {
    if (!loading && !publicPage && !error) {
      if (!user) router.replace("/login");
      else if (!me?.profile?.onboarded && pathname !== "/onboarding")
        router.replace("/onboarding");
    }
  }, [loading, user, me, pathname, publicPage, error, router]);
  useEffect(() => {
    setMenu(false);
  }, [pathname]);
  useEffect(() => {
    if (user && me?.profile)
      void api("", { action: "activity" }).catch(() => {});
  }, [user, me?.profile]);
  if (loading && !publicPage)
    return (
      <main className="wrap section">
        <Skeleton />
      </main>
    );
  if (!publicPage && error)
    return (
      <main className="wrap section">
        <Brand />
        <ErrorBox message={error} retry={() => void refresh()} />
        <button
          className="button secondary"
          onClick={() => void logout().then(() => router.push("/login"))}
        >
          Sign out
        </button>
      </main>
    );
  if (!publicPage && !user)
    return (
      <main className="wrap section">
        <Empty
          title="Sign in to keep growing."
          text="This page belongs to your private workspace."
          href="/login"
          label="Log in"
        />
      </main>
    );
  if (
    !publicPage &&
    user &&
    !me?.profile?.onboarded &&
    pathname !== "/onboarding"
  )
    return (
      <main className="wrap section">
        <Skeleton />
      </main>
    );
  const links = [
    { path: "/dashboard", name: "Your overview", icon: LayoutDashboard },
    { path: "/discover", name: "Explore skills", icon: Search },
    { path: "/matches", name: "Your matches", icon: Repeat2 },
    { path: "/exchanges", name: "Exchanges", icon: Repeat2 },
    { path: "/messages", name: "Messages", icon: MessagesSquare },
    { path: "/sessions", name: "Your schedule", icon: CalendarDays },
    { path: "/saved", name: "Saved", icon: Bookmark },
    { path: "/notifications", name: "Notifications", icon: Bell },
  ];
  return (
    <div className={`app-layout ${!user ? "visitor" : ""}`}>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="row between">
          <Brand name={s?.brand || defaultSettings.brand} />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>
        <small className="nav-label">YOUR LITTLE CORNER OF GROWTH</small>
        <nav aria-label="Workspace">
          {links
            .filter((l) => user || l.path === "/discover")
            .map((l) => (
              <Link
                key={l.path}
                href={l.path}
                className={
                  pathname === l.path ||
                  (l.path === "/exchanges" &&
                    pathname.startsWith("/exchanges/"))
                    ? "active"
                    : ""
                }
              >
                <l.icon size={19} />
                {l.name}
                {l.path === "/notifications" && !!notifications?.unread && (
                  <span className="nav-count">
                    {notifications.unread > 99 ? "99+" : notifications.unread}
                  </span>
                )}
              </Link>
            ))}
          {["admin", "owner"].includes(me?.role || "") && (
            <Link
              href="/admin"
              className={pathname === "/admin" ? "active" : ""}
            >
              <ShieldCheck size={19} />
              Stewardship desk
            </Link>
          )}
        </nav>
        <div className="sidebar-grow">
          <span>✳</span>
          <h3>
            Good things
            <br />
            grow together.
          </h3>
          <p>A little of your time could be someone’s next big step.</p>
          <Link href={user ? "/profile/edit" : "/signup"}>
            Share a skill <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          {user ? (
            <>
              <Link href="/settings">
                <Settings size={18} />
                Settings
              </Link>
              <button
                onClick={() => void logout().then(() => router.push("/"))}
              >
                <LogOut size={18} />
                Log out
              </button>
              <Link
                className="account-mini"
                href={
                  me?.profile?.username
                    ? `/people/${me.profile.username}`
                    : "/onboarding"
                }
              >
                <Avatar
                  person={{
                    name: me?.profile?.name || user.displayName || "Member",
                    photo: me?.profile?.photo,
                  }}
                  size="small"
                />
                <div>
                  <b>{me?.profile?.name || "Your profile"}</b>
                  <small>View your profile</small>
                </div>
              </Link>
            </>
          ) : (
            <Link className="button" href="/signup">
              Join the community
            </Link>
          )}
        </div>
      </aside>
      {menu && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="app-body">
        <header className="app-header">
          <button
            className="icon-button mobile-only"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>
          <span className="header-location">
            The community /{" "}
            <b>
              {pathname.startsWith("/people/")
                ? "Member profile"
                : pathname.split("/")[1]?.replace("-", " ")}
            </b>
          </span>
          <div className="row">
            {user ? (
              <>
                <Link
                  className="icon-button"
                  href="/notifications"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {!!notifications?.unread && <span className="unread-dot" />}
                </Link>
                <Avatar
                  person={{
                    name: me?.profile?.name || "Member",
                    photo: me?.profile?.photo,
                  }}
                  size="small"
                />
              </>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/signup" className="button small">
                  Join SkillSpring
                </Link>
              </>
            )}
          </div>
        </header>
        {user && !user.emailVerified && (
          <div className="verification-banner">
            <span>
              Verify your email before sending requests, messages, or photos.
            </span>
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await sendEmailVerification(auth().currentUser!);
                  toast("Verification email requested. Check your inbox.");
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              Resend email
            </button>
            <button
              className="text-button"
              onClick={async () => {
                await auth().currentUser?.reload();
                await auth().currentUser?.getIdToken(true);
                await refresh();
                toast(
                  auth().currentUser?.emailVerified
                    ? "Email verified"
                    : "Not verified yet. Open the link in your email first.",
                );
              }}
            >
              I’ve verified
            </button>
          </div>
        )}
        <main className="app-main" id="main">
          {children}
        </main>
        <footer className="app-footer">
          <span>Made for people who keep growing.</span>
          <Link href="/guidelines">Community guidelines</Link>
          <Link href="/privacy">Privacy</Link>
        </footer>
      </div>
    </div>
  );
}

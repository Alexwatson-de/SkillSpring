"use client";
import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";
import { AuthScreen } from "./auth-screen";
import { Onboarding } from "./onboarding";
import { Discovery } from "./discovery";
import { ProfileScreen } from "./profile-screen";
import { Dashboard, Notifications, Saved, Sessions } from "./dashboard";
import { ExchangeList, ExchangeWorkspace } from "./exchanges";
import { AdminScreen } from "./admin-screen";
import { SettingsScreen, PolicyPage } from "./settings-screen";
import { Empty } from "./ui";
export function Router() {
  const path = usePathname();
  if (["/login", "/signup", "/reset-password"].includes(path))
    return (
      <AuthScreen
        key={path}
        mode={
          path === "/signup" ? "signup" : path === "/login" ? "login" : "reset"
        }
      />
    );
  const publicPage =
    path === "/discover" ||
    path.startsWith("/people/") ||
    ["/terms", "/privacy", "/guidelines", "/contact"].includes(path);
  const content =
    path === "/dashboard" ? (
      <Dashboard />
    ) : path === "/onboarding" ? (
      <Onboarding />
    ) : path === "/profile/edit" ? (
      <Onboarding edit />
    ) : path === "/discover" ? (
      <Discovery />
    ) : path === "/matches" ? (
      <Discovery matches />
    ) : path.startsWith("/people/") ? (
      <ProfileScreen username={path.split("/")[2]} />
    ) : path === "/exchanges" ? (
      <ExchangeList />
    ) : path === "/messages" ? (
      <ExchangeList messages />
    ) : path.startsWith("/exchanges/") ? (
      <ExchangeWorkspace id={path.split("/")[2]} />
    ) : path === "/notifications" ? (
      <Notifications />
    ) : path === "/saved" ? (
      <Saved />
    ) : path === "/sessions" ? (
      <Sessions />
    ) : path === "/admin" ? (
      <AdminScreen />
    ) : path === "/settings" ? (
      <SettingsScreen />
    ) : ["/terms", "/privacy", "/guidelines", "/contact"].includes(path) ? (
      <PolicyPage kind={path.slice(1)} />
    ) : (
      <Empty
        title="This path hasn’t grown yet."
        text="Let’s take you back to the community."
        href="/discover"
      />
    );
  return <AppShell publicPage={publicPage}>{content}</AppShell>;
}

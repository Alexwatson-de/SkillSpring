// Real-host browser verification with one scoped synthetic account, removed afterward.
import { loadEnvConfig } from "@next/env";
import { chromium } from "playwright";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { getAuth } from "firebase-admin/auth";
import sharp from "sharp";
import { admin, table } from "../src/server/store";
import { eraseUser } from "../src/server/maintenance";
loadEnvConfig(process.cwd());
async function main() {
  if (
    process.env.CONFIRM_PROJECT !== "forum-d1133" ||
    process.env.FIRESTORE_EMULATOR_HOST
  )
    throw new Error("Explicit real-project approval required");
  const base = process.env.TEST_BASE_URL;
  if (!base?.startsWith("https://")) throw new Error("Set verified HTTPS host");
  execFileSync(
    "firebase",
    ["apps:list", "--project", "forum-d1133", "--json"],
    { stdio: "pipe" },
  );
  const raw = execFileSync("firebase", ["login:list", "--json"], {
    encoding: "utf8",
  });
  const oauth = JSON.parse(raw.slice(raw.indexOf("{"))).result[0].tokens
    .access_token;
  const email = `skillspring-browser-${Date.now()}@example.test`;
  const password = randomBytes(20).toString("base64url");
  let uid = "";
  let username = "";
  let checks = 0;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  function pass(label: string) {
    checks++;
    console.log("PASS:", label);
  }
  async function owner(method: string, body: unknown) {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/forum-d1133/accounts:${method}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${oauth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!r.ok) throw new Error(`Synthetic identity operation: ${r.status}`);
  }
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    if (
      !(await page.getByRole("heading", { level: 1 }).textContent())?.includes(
        "You know something",
      )
    )
      throw new Error("Landing unavailable");
    pass("Hosted landing and assets load");
    await page.goto(`${base}/signup`);
    await page.getByLabel("Full name").fill("Synthetic Browser QA");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create your account" }).click();
    await page.waitForURL("**/onboarding");
    uid = (await getAuth(admin()).getUserByEmail(email)).uid;
    pass("Actual hosted browser registration and protected onboarding");
    await page
      .getByLabel("A little about you")
      .fill(
        "Temporary synthetic browser verification; removed after this test.",
      );
    await page
      .getByLabel("Professional headline")
      .fill("Synthetic QA, not a genuine member");
    await page.getByRole("button", { name: "Save & continue" }).click();
    await page
      .getByRole("heading", { name: "Your experience", exact: true })
      .waitFor();
    await page.reload();
    await page
      .getByRole("heading", { name: "Your experience", exact: true })
      .waitFor();
    pass("Hosted onboarding survives refresh");
    await page.getByLabel("Current role or occupation").fill("QA tester");
    await page.getByRole("button", { name: "Save & continue" }).click();
    await page.getByRole("button", { name: "Add a skill to share" }).click();
    await page.getByLabel("Skill name").fill("React");
    await page.getByRole("button", { name: "Save & continue" }).click();
    await page.getByRole("button", { name: "Add a skill to learn" }).click();
    await page.getByLabel("Skill name").fill("Figma");
    await page.getByRole("button", { name: "Save & continue" }).click();
    await page.getByRole("button", { name: "Let’s start growing" }).click();
    await page.waitForURL("**/dashboard");
    await page.locator("main h1").waitFor();
    pass("Hosted profile completes into real dashboard");
    await owner("update", { localId: uid, emailVerified: true });
    await page.getByRole("button", { name: "I’ve verified" }).click();
    await page.waitForTimeout(1000);
    await page.goto(`${base}/profile/edit`);
    const png = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#245d43" },
    })
      .png()
      .toBuffer();
    await page
      .locator("input[type=file]")
      .setInputFiles({
        name: "synthetic.png",
        mimeType: "image/png",
        buffer: png,
      });
    await page
      .getByText("Profile photo updated", { exact: true })
      .waitFor({ timeout: 30000 });
    const stored = (await table("people").doc(uid).get()).data()!;
    username = stored.username;
    if (!stored.photo?.includes("res.cloudinary.com"))
      throw new Error("Photo reference missing");
    pass("Hosted browser signed photo upload persists");
    await page.goto(`${base}/people/${username}`);
    await page
      .getByRole("heading", { name: "Synthetic Browser QA", exact: true })
      .waitFor();
    if (await page.getByText(email, { exact: true }).count())
      throw new Error("Email leaked publicly");
    pass("Hosted public profile omits private email");
    await page.goto(`${base}/admin`);
    await page
      .getByRole("heading", { name: "This area is for administrators." })
      .waitFor();
    pass("Hosted member cannot access administration");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      "/dashboard",
      "/discover",
      "/profile/edit",
      "/messages",
      "/sessions",
    ]) {
      await page.goto(base + route);
      await page.locator("main h1").waitFor();
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error(`Overflow on ${route}`);
    }
    pass("Hosted mobile journeys fit 390px");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Log out", exact: true }).click();
    await page.waitForURL((url) => ["/", "/login"].includes(url.pathname));
    await page.goto(base + "/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("**/dashboard");
    pass("Hosted logout and password login work");
    if (errors.length)
      throw new Error("Hosted browser runtime errors: " + errors.join("; "));
    pass("No browser runtime exceptions");
    console.log(`Hosted browser checks passed: ${checks}`);
  } finally {
    await browser.close();
    if (!uid) {
      try {
        uid = (await getAuth(admin()).getUserByEmail(email)).uid;
      } catch {}
    }
    if (uid) {
      const p = await table("people").doc(uid).get();
      await table("deletions")
        .doc(uid)
        .set({
          uid,
          state: "pending",
          photoId: p.data()?.photoId || "",
          createdAt: Date.now(),
        });
      await eraseUser(uid);
      username = username || p.data()?.username;
      if (username) await table("handles").doc(username).delete();
      await table("people").doc(uid).delete();
      await table("accounts").doc(uid).delete();
      await table("deletions").doc(uid).delete();
      await owner("delete", { localId: uid });
      console.log(
        "Hosted browser synthetic identity, profile, private data and uploaded image removed.",
      );
    }
  }
}
main().catch((e) => {
  console.error("Hosted browser verification failed:", e.message);
  process.exitCode = 1;
});

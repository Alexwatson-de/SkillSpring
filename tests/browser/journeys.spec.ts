import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { getAuth } from "firebase-admin/auth";
import { admin, table } from "../../src/server/store";
const email = `journey-${Date.now()}@example.test`;
const password = "Test-SkillSpring-29";
let learner: BrowserContext;
let partner: BrowserContext;
let a: Page;
let b: Page;
let exchangeId = "";
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
async function token(email: string, password: string) {
  const r = await fetch(
    "http://127.0.0.1:9101/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  return (await r.json()).idToken as string;
}
test.describe.serial("complete two-person browser journey", () => {
  test.beforeAll(async ({ browser }) => {
    learner = await browser.newContext();
    partner = await browser.newContext();
    a = await learner.newPage();
    b = await partner.newPage();
  });
  test.afterAll(async () => {
    await learner?.close();
    await partner?.close();
  });
  test("registers, verifies, saves onboarding progress and creates a profile", async () => {
    await a.goto("/signup");
    await a.getByLabel("Full name").fill("Jordan Browser");
    await a.getByLabel("Email address").fill(email);
    await a.getByLabel("Password", { exact: true }).fill(password);
    await a.getByRole("checkbox").check();
    await a.getByRole("button", { name: "Create your account" }).click();
    await expect(a).toHaveURL(/onboarding/);
    await a
      .getByLabel("A little about you")
      .fill("I build useful interfaces and want to learn thoughtful design.");
    await a
      .getByLabel("Professional headline")
      .fill("Developer and curious learner");
    await a
      .getByLabel("Time zone", { exact: true })
      .selectOption("Asia/Kolkata");
    await a.getByRole("button", { name: "Save & continue" }).click();
    await expect(
      a.getByRole("heading", { name: "Your experience", exact: true }),
    ).toBeVisible();
    await a.reload();
    await expect(
      a.getByRole("heading", { name: "Your experience", exact: true }),
    ).toBeVisible();
    await a.getByLabel("Current role or occupation").fill("Frontend developer");
    await a
      .getByLabel("Professional summary")
      .fill("Building practical web applications.");
    await a.getByRole("button", { name: "Save & continue" }).click();
    await a.getByRole("button", { name: "Add a skill to share" }).click();
    await a.getByLabel("Skill name").fill("React");
    await a
      .getByLabel("What can you teach?")
      .fill("Build accessible React components with clear state management.");
    await a.getByRole("button", { name: "Save & continue" }).click();
    await a.getByRole("button", { name: "Add a skill to learn" }).click();
    await a.getByLabel("Skill name").fill("UI/UX design");
    await a.getByLabel("Category", { exact: true }).selectOption("Design");
    await a
      .getByLabel("Your learning goals")
      .fill("Create useful, accessible Figma prototypes.");
    await a.getByRole("button", { name: "Save & continue" }).click();
    await a.getByLabel("Tuesday", { exact: true }).check();
    await a.getByRole("button", { name: "Let’s start growing" }).click();
    await expect(a).toHaveURL(/dashboard/);
    const mailbox = await fetch(
      "http://127.0.0.1:9101/emulator/v1/projects/demo-skillspring/oobCodes",
    );
    const codes = await mailbox.json();
    const verification = codes.oobCodes.find(
      (c: { email: string; requestType: string; oobCode: string }) =>
        c.email === email && c.requestType === "VERIFY_EMAIL",
    );
    expect(verification).toBeTruthy();
    const verified = await fetch(
      "http://127.0.0.1:9101/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oobCode: verification.oobCode }),
      },
    );
    expect(verified.ok).toBe(true);
    expect((await getAuth(admin()).getUserByEmail(email)).emailVerified).toBe(
      true,
    );
    await a.getByRole("button", { name: "I’ve verified" }).click();
    await expect(
      a.getByText("Verify your email before sending", { exact: false }),
    ).toHaveCount(0);
  });
  test("discovers reciprocal matches, filters via URL and visits a profile", async () => {
    await a.goto("/matches");
    await expect(a.getByText("Jamie Chen", { exact: true })).toBeVisible();
    await expect(
      a.getByText("A two-way connection", { exact: false }).first(),
    ).toBeVisible();
    await a.goto("/discover?category=Design&language=English");
    await expect(a.getByText("Jamie Chen", { exact: true })).toBeVisible();
    await a.getByRole("link", { name: "View profile" }).first().click();
    await expect(a).toHaveURL(/people\/demo-jamie/);
    await expect(
      a.getByRole("heading", { name: "Jamie Chen", exact: true }),
    ).toBeVisible();
  });
  test("saves a profile and sends a reciprocal request", async () => {
    await a.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(
      a.getByRole("status").filter({ hasText: "Profile saved" }),
    ).toBeVisible();
    await a.getByRole("button", { name: "Propose a skill exchange" }).click();
    const dialog = a.getByRole("dialog");
    await dialog.getByLabel("Skill you can offer").selectOption("React");
    await dialog
      .getByLabel("What would you like to achieve?")
      .fill(
        "Design an accessible dashboard and build its React components together.",
      );
    await dialog
      .getByLabel("Suggested availability")
      .fill("Tuesday at 18:00 Asia/Kolkata");
    await dialog
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await expect(a).toHaveURL(/exchanges\/[A-Za-z0-9]+/);
    exchangeId = new URL(a.url()).pathname.split("/")[2];
    await expect(
      a.getByText("Your request is with your learning partner."),
    ).toBeVisible();
  });
  test("recipient accepts and both participants exchange messages", async () => {
    await login(b, "demo-jamie@example.test", "Demo-Only-SkillSpring-29");
    await b.goto(`/exchanges/${exchangeId}`);
    await b
      .getByRole("button", { name: "Accept request", exact: true })
      .click();
    await expect(
      b.getByText("Request accepted", { exact: true }),
    ).toBeVisible();
    await b.getByRole("button", { name: "Conversation", exact: true }).click();
    await b
      .getByLabel("Your message")
      .fill("Let’s build an accessible prototype together.");
    await b.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(
      b.getByText("Let’s build an accessible prototype together.", {
        exact: true,
      }),
    ).toBeVisible();
    await a.reload();
    await a.getByRole("button", { name: "Conversation", exact: true }).click();
    await expect(
      a.getByText("Let’s build an accessible prototype together.", {
        exact: true,
      }),
    ).toBeVisible();
    await a
      .getByLabel("Your message")
      .fill("Great, I can help implement the React components.");
    await a.getByRole("button", { name: "Send message", exact: true }).click();
  });
  test("proposes and confirms a timezone-aware session", async () => {
    await a.getByRole("button", { name: "Sessions", exact: true }).click();
    await a
      .getByRole("button", { name: "Propose a session", exact: true })
      .click();
    const d = a.getByRole("dialog");
    await d.getByLabel("Session title").fill("Prototype and components");
    await d.getByLabel("Time zone", { exact: true }).selectOption("UTC");
    await d
      .getByLabel("Date & time in UTC")
      .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await d.getByRole("button", { name: "Send time proposal" }).click();
    await expect(
      a.getByText("Waiting for your partner to confirm."),
    ).toBeVisible();
    await b.reload();
    await b.getByRole("button", { name: "Sessions", exact: true }).click();
    await b.getByRole("button", { name: "Confirm time", exact: true }).click();
    await expect(b.locator(".session-card .tag")).toHaveText("scheduled");
    const sessions = await table("exchanges")
      .doc(exchangeId)
      .collection("sessions")
      .get();
    expect(sessions.docs[0].data().timezone).toBe("UTC");
  });
  test("records progress, completes session and requires mutual exchange completion", async () => {
    const sessions = await table("exchanges")
      .doc(exchangeId)
      .collection("sessions")
      .get();
    await sessions.docs[0].ref.update({ startsAt: Date.now() - 4 * 3600000 });
    await a.reload();
    await a.getByRole("button", { name: "Resources", exact: true }).click();
    await a
      .getByLabel("Progress notes")
      .fill("Finished the layout exercise and component implementation.");
    await a.getByLabel("Shared HTTPS resources").fill("https://react.dev");
    await a.getByRole("button", { name: "Save shared notes" }).click();
    await a.getByRole("button", { name: "Sessions", exact: true }).click();
    await a.getByRole("button", { name: "Mark session completed" }).click();
    await a.getByRole("button", { name: "Overview", exact: true }).click();
    await a.getByRole("button", { name: "Confirm exchange complete" }).click();
    await expect(
      a.getByRole("button", { name: "Waiting for partner confirmation" }),
    ).toBeDisabled();
    await b.reload();
    await b.getByRole("button", { name: "Overview", exact: true }).click();
    await b.getByRole("button", { name: "Confirm exchange complete" }).click();
    await expect(b.locator(".page-title .tag")).toHaveText("completed");
  });
  test("leaves a genuine verified review and prevents duplicate review form", async () => {
    await a.reload();
    await a.getByRole("button", { name: "Feedback", exact: true }).click();
    for (const label of [
      "Overall rating",
      "Communication",
      "Preparation",
      "Helpfulness",
    ])
      await a.getByLabel(label, { exact: true }).selectOption("5");
    await a
      .getByLabel("Your feedback", { exact: true })
      .fill(
        "Patient, thoughtful guidance with clear examples. A very useful exchange.",
      );
    await a.getByRole("button", { name: "Share verified review" }).click();
    await expect(
      a.getByText("Your verified exchange feedback is recorded.", {
        exact: false,
      }),
    ).toBeVisible();
    await a.reload();
    await a.getByRole("button", { name: "Feedback", exact: true }).click();
    await expect(
      a.getByRole("button", { name: "Share verified review" }),
    ).toHaveCount(0);
  });
  test("notifications, saved collection and private endpoints are functional", async () => {
    await a.goto("/saved");
    await expect(a.getByText("Jamie Chen", { exact: true })).toBeVisible();
    await a.goto("/notifications");
    await a.getByRole("button", { name: "Mark all as read" }).click();
    await expect(
      a.getByText("All notifications marked as read", { exact: true }),
    ).toBeVisible();
    const outsider = await token(
      "demo-sam@example.test",
      "Demo-Only-SkillSpring-29",
    );
    const denied = await a.request.get(
      `/api/data?kind=exchange&id=${exchangeId}`,
      { headers: { Authorization: `Bearer ${outsider}` } },
    );
    expect(denied.status()).toBe(404);
    const normal = await token(email, password);
    const adminDenied = await a.request.get("/api/data?kind=admin", {
      headers: { Authorization: `Bearer ${normal}` },
    });
    expect(adminDenied.status()).toBe(403);
  });
  test("responsive authenticated journeys and clean runtime", async () => {
    await a.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      "/dashboard",
      "/discover",
      "/profile/edit",
      "/saved",
      `/exchanges/${exchangeId}`,
    ]) {
      await a.goto(route);
      await expect(a.locator("main h1")).toBeVisible();
      expect(
        await a.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await a
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await expect(
      a.getByRole("navigation", { name: "Workspace" }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Close navigation", exact: true })
      .first()
      .click();
  });
});
test("landing, accessible navigation and reduced-motion fallback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "You know something",
  );
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .locator("summary")
    .filter({ hasText: "Do I have to teach something in return?" })
    .click();
  await expect(
    page.getByText("No. Choose a reciprocal exchange", { exact: false }),
  ).toBeVisible();
});
test("password reset delivers emulator action and protected routes redirect", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  await page.goto("/reset-password");
  await page.getByLabel("Email address").fill("demo-sam@example.test");
  await page.getByRole("button", { name: "Send reset instructions" }).click();
  await expect(
    page.getByText("If an account exists", { exact: false }),
  ).toBeVisible();
  const r = await fetch(
    "http://127.0.0.1:9101/emulator/v1/projects/demo-skillspring/oobCodes",
  );
  const d = await r.json();
  expect(
    d.oobCodes.some(
      (c: { requestType: string; email: string }) =>
        c.requestType === "PASSWORD_RESET" &&
        c.email === "demo-sam@example.test",
    ),
  ).toBe(true);
});
test("owner moderation controls and settings persist", async ({ page }) => {
  await login(page, "demo-alex@example.test", "Demo-Only-SkillSpring-29");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "The stewardship desk." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Skill catalog", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add catalog skill", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Skill name").fill(`Browser skill ${Date.now()}`);
  await dialog.getByRole("button", { name: "Save catalog entry" }).click();
  await expect(
    page.getByText("Administrative change recorded", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Platform settings", exact: true })
    .click();
  await page
    .getByLabel("Tagline", { exact: true })
    .fill("A little of what you know. A world of what you could.");
  await page.getByRole("button", { name: "Save platform settings" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Platform settings", exact: true })
    .click();
  await expect(page.getByLabel("Tagline", { exact: true })).toHaveValue(
    "A little of what you know. A world of what you could.",
  );
});

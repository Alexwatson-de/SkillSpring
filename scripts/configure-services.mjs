// Uses the already-authorized Firebase CLI user only for provisioning.
// Does not modify Firebase Auth accounts, existing database rules or billing.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const project = "forum-d1133";
if (process.env.CONFIRM_PROJECT !== project)
  throw new Error("Set CONFIRM_PROJECT to the explicitly authorized project");
function cli(args) {
  const s = execFileSync("firebase", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(s.slice(s.indexOf("{"))).result;
}
cli(["apps:list", "--project", project, "--json"]);
const account = cli(["login:list", "--json"])[0];
const token = account.tokens.access_token;
async function api(url, method = "GET", body, missing = false) {
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  if (missing && r.status === 404) return null;
  if (!r.ok) throw new Error(`${method} ${new URL(url).pathname}: ${r.status}`);
  return d;
}
const email = `skillspring-server@${project}.iam.gserviceaccount.com`;
let sa = await api(
  `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`,
  "GET",
  undefined,
  true,
);
if (!sa)
  sa = await api(
    `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`,
    "POST",
    {
      accountId: "skillspring-server",
      serviceAccount: {
        displayName: "SkillSpring server (isolated application namespace)",
      },
    },
  );
const policy = await api(
  `https://cloudresourcemanager.googleapis.com/v1/projects/${project}:getIamPolicy`,
  "POST",
  { options: { requestedPolicyVersion: 3 } },
);
for (const role of ["roles/datastore.user", "roles/firebaseauth.viewer"]) {
  let b = policy.bindings.find((b) => b.role === role && !b.condition);
  if (!b) {
    b = { role, members: [] };
    policy.bindings.push(b);
  }
  const m = `serviceAccount:${email}`;
  if (!b.members.includes(m)) b.members.push(m);
}
await api(
  `https://cloudresourcemanager.googleapis.com/v1/projects/${project}:setIamPolicy`,
  "POST",
  { policy },
);
mkdirSync(".secrets", { recursive: true, mode: 0o700 });
const path = resolve(".secrets/skillspring-server.json");
if (!existsSync(path)) {
  const k = await api(`https://iam.googleapis.com/v1/${sa.name}/keys`, "POST", {
    privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
    keyAlgorithm: "KEY_ALG_RSA_2048",
  });
  writeFileSync(path, Buffer.from(k.privateKeyData, "base64"), {
    mode: 0o600,
    flag: "wx",
  });
}
const old = readFileSync("../stillvein/.env.local", "utf8");
const shared = Object.fromEntries(
  old
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    }),
);
const env = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyCEIRws3V63huPOSwZL3RigMqCI9MOW-6g",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "forum-d1133.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: project,
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:96213319662:web:88ccc24d95cfd5c269d8ff",
  FIREBASE_PROJECT_ID: project,
  GOOGLE_APPLICATION_CREDENTIALS: path,
  NEXT_PUBLIC_SITE_URL: "http://localhost:3010",
  ...Object.fromEntries(
    ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]
      .filter((k) => shared[k])
      .map((k) => [k, shared[k]]),
  ),
};
if (!existsSync(".env.local"))
  writeFileSync(
    ".env.local",
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600, flag: "wx" },
  );
const billing = await api(
  `https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`,
);
console.log(
  "Configured dedicated server identity. Reused Cloudinary variable names:",
  Object.keys(env)
    .filter((k) => k.startsWith("CLOUDINARY"))
    .join(", "),
);
console.log(
  "Billing remains:",
  billing.billingEnabled ? "enabled (pre-existing)" : "disabled",
);
console.log("Owner candidate (not provisioned):", account.user.email);

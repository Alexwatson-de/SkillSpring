// Deploy setup only after the owner confirms personal/non-commercial Hobby use.
// Secret values remain in memory and encrypted host settings, never stdout.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";
if (process.env.CONFIRM_HOBBY_PERSONAL !== "yes")
  throw new Error("Personal/non-commercial Hobby-use confirmation required");
const p = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
if (p.projectName !== "skillspring") throw new Error("Wrong hosting project");
const auth = JSON.parse(
  readFileSync(
    `${homedir()}/Library/Application Support/com.vercel.cli/auth.json`,
    "utf8",
  ),
);
async function vercel(path, method = "GET", body) {
  const r = await fetch(
    `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${p.orgId}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const d = await r.json();
  if (!r.ok)
    throw new Error(
      `Vercel configuration denied: ${r.status} (${d.error?.code || "unknown"})`,
    );
  return d;
}
const domains = await vercel(`/v9/projects/${p.projectId}/domains`);
const domain = domains.domains.find(
  (d) => d.verified && d.name.endsWith(".vercel.app"),
)?.name;
if (!domain) throw new Error("No verified default domain");
const env = parseEnv(readFileSync(".env.local", "utf8"));
const keys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_PROJECT_ID",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];
const values = Object.fromEntries(
  keys.map((k) => {
    if (!env[k]) throw new Error(`Missing ${k}`);
    return [k, env[k]];
  }),
);
values.FIREBASE_SERVICE_ACCOUNT_JSON = readFileSync(
  env.GOOGLE_APPLICATION_CREDENTIALS,
  "utf8",
);
values.NEXT_PUBLIC_SITE_URL = `https://${domain}`;
const result = await vercel(
  `/v10/projects/${p.projectId}/env?upsert=true`,
  "POST",
  Object.entries(values).map(([key, value]) => ({
    key,
    value,
    type: "encrypted",
    target: ["production", "preview"],
  })),
);
if (result.failed?.length)
  throw new Error(
    "One or more hosting variables failed; inspect variable names in host settings",
  );
console.log(
  "Configured encrypted hosting variables:",
  Object.keys(values).join(", "),
);
execFileSync("firebase", ["apps:list", "--project", "forum-d1133", "--json"], {
  stdio: "pipe",
});
const raw = execFileSync("firebase", ["login:list", "--json"], {
  encoding: "utf8",
});
const token = JSON.parse(raw.slice(raw.indexOf("{"))).result[0].tokens
  .access_token;
const url =
  "https://identitytoolkit.googleapis.com/admin/v2/projects/forum-d1133/config";
const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
if (!r.ok) throw new Error(`Auth config read failed: ${r.status}`);
const config = await r.json();
const authorizedDomains = [...new Set([...config.authorizedDomains, domain])];
if (authorizedDomains.length !== config.authorizedDomains.length) {
  const update = await fetch(`${url}?updateMask=authorizedDomains`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ authorizedDomains }),
  });
  if (!update.ok)
    throw new Error(`Auth domain update failed: ${update.status}`);
}
console.log(
  "Authorized final host domain; existing domains preserved:",
  domain,
);
console.log(
  "No billing or hosting plan changes. Deploy and verify before claiming a production URL.",
);

// Additive index deployment to the authorized shared project; never deletes indexes.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const project = "forum-d1133";
if (process.env.CONFIRM_PROJECT !== project)
  throw new Error("Explicit project confirmation required");
execFileSync("firebase", ["apps:list", "--project", project, "--json"], {
  stdio: "pipe",
});
const raw = execFileSync("firebase", ["login:list", "--json"], {
  encoding: "utf8",
});
const token = JSON.parse(raw.slice(raw.indexOf("{"))).result[0].tokens
  .access_token;
for (const index of JSON.parse(readFileSync("firestore.indexes.json", "utf8"))
  .indexes) {
  const r = await fetch(
    `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/${index.collectionGroup}/indexes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        queryScope: index.queryScope,
        fields: index.fields,
      }),
    },
  );
  if (!r.ok && r.status !== 409)
    throw new Error(`Index ${index.collectionGroup}: ${r.status}`);
  console.log(
    index.collectionGroup,
    r.status === 409 ? "already exists" : "creation requested",
  );
}
console.log(
  "Existing rules, indexes, data and billing preserved. Index readiness must be checked before launch.",
);

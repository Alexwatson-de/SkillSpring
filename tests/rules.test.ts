import { beforeAll, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { getDoc, setDoc, doc, getDocs, collection } from "firebase/firestore";
import { readFileSync } from "node:fs";
const suite = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
let env: RulesTestEnvironment;
suite("Firestore deny-by-default boundaries", () => {
  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
    env = await initializeTestEnvironment({
      projectId: "demo-skillspring",
      firestore: {
        host,
        port: Number(port),
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
  });
  afterAll(async () => env?.cleanup());
  for (const identity of ["anonymous", "member", "forged-admin"])
    for (const resource of [
      "people/alice",
      "accounts/alice",
      "exchanges/private",
      "exchanges/private/messages/secret",
      "notifications/notice",
      "saved/bookmark",
      "reviews/review",
      "reports/report",
      "settings/public",
      "audit/event",
    ])
      it(`${identity} cannot read or write ${resource} directly`, async () => {
        const db =
          identity === "anonymous"
            ? env.unauthenticatedContext().firestore()
            : env
                .authenticatedContext(
                  "alice",
                  identity === "forged-admin"
                    ? { admin: true, role: "owner" }
                    : {},
                )
                .firestore();
        const r = doc(db, `skillspring/main/${resource}`);
        await assertFails(getDoc(r));
        await assertFails(setDoc(r, { uid: "alice", role: "owner" }));
      });
  it("rejects collection enumeration", async () => {
    await assertFails(
      getDocs(
        collection(
          env.authenticatedContext("alice").firestore(),
          "skillspring/main/accounts",
        ),
      ),
    );
  });
});

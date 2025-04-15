import "dotenv/config";

import { describe, test, expect } from "@jest/globals";
import {
  userRequest,
  mockLogin,
  getSession,
  runSudoQuery,
} from "contract-tests";

describe("bpmn elements extraction", () => {
  test("not authenticated", async () => {
    const { status, body } = await userRequest("POST", "http://target");

    expect(status).toBe(401);
    expect(body).toBe("Session ID header not found.");
  });

  test("no organization", async () => {
    const groupUri = "http://data.lblod.info/id/bestuurseenheden/1";
    await mockLogin(
      groupUri,
      "http://data.lblod.info/id/accounts/1",
      "LoketLB-OpenProcesHuisGebruiker"
    );
    const sessionUri = await getSession();
    await runSudoQuery(`
      DELETE DATA {
        GRAPH <http://mu.semte.ch/graphs/sessions> {
          <${sessionUri}> <http://mu.semte.ch/vocabularies/ext/sessionGroup> <${groupUri}> ;
        }
      }
    `);

    const { status, body } = await userRequest("POST", "http://target");

    expect(status).toBe(401);
    expect(body).toBe("User not affiliated with any organization.");
  });
});

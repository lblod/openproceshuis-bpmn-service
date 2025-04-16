import "dotenv/config";

import { describe, test, expect, beforeAll } from "@jest/globals";
import { userRequest, mockLogin } from "contract-tests";

describe("bpmn elements extraction - authorized", () => {
  beforeAll(async () => {
    await mockLogin(
      "http://data.lblod.info/id/bestuurseenheden/1",
      "http://data.lblod.info/id/accounts/1",
      "LoketLB-OpenProcesHuisGebruiker"
    );
  });

  test("no file", async () => {
    const { status, body } = await userRequest("POST", "http://target");

    expect(status).toBe(400);
    expect(body).toBe("The request should contain a file ID as parameter.");
  });
});

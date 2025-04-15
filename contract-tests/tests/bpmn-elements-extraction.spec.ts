import "dotenv/config";

import { describe, test, expect } from "@jest/globals";
import { userRequest } from "contract-tests";

describe("bpmn elements extraction", () => {
  test("not authenticated", async () => {
    const { status, body } = await userRequest("POST", "http://target");

    expect(status).toBe(401);
    expect(body).toBe("Session ID header not found.");
  });
});

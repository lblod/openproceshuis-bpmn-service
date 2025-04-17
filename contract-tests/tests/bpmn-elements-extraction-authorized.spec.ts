import "dotenv/config";

import { describe, test, expect, beforeAll } from "@jest/globals";
import { userRequest, mockLogin, runSudoQuery } from "contract-tests";

describe("bpmn elements extraction - authorized", () => {
  const STORED_VIRTUAL_FILE_UUID = "6b2f23b1-5750-4907-a026-34e42ce774b3";
  const STORED_PHYSICAL_FILE_UUID = "15940f73-5404-429e-a4e1-fe98d8e63b8d"; // see bpmn file in /mock-files
  const UNSTORED_VIRTUAL_FILE_UUID = "6299d9a7-2fb7-4403-ac9b-56c13b921655";
  const UNSTORED_PHYSICAL_FILE_UUID = "f51c37ce-5843-4dcc-b158-c75a1f1e26e5";

  beforeAll(async () => {
    await runSudoQuery(`
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
      PREFIX dct: <http://purl.org/dc/terms/>
      INSERT DATA {
        GRAPH <http://mu.semte.ch/graphs/public> {
          <http://data.lblod.info/id/bestuurseenheden/e415e497-c738-4ddf-908c-189ca0fea754> a besluit:Bestuurseenheid ;
            mu:uuid "e415e497-c738-4ddf-908c-189ca0fea754" ;
            dct:identifier "mock" .
        }
      }
    `);

    await mockLogin(
      "http://data.lblod.info/id/bestuurseenheden/e415e497-c738-4ddf-908c-189ca0fea754",
      "http://data.lblod.info/id/accounts/a6d1ecf0-7606-4a3e-adf1-68275930fc2c",
      "LoketLB-OpenProcesHuisGebruiker"
    );

    await registerFile(STORED_VIRTUAL_FILE_UUID, STORED_PHYSICAL_FILE_UUID);
    await registerFile(UNSTORED_VIRTUAL_FILE_UUID, UNSTORED_PHYSICAL_FILE_UUID);
  });

  test("no file", async () => {
    const { status, body } = await userRequest("POST", "http://target");

    expect(status).toBe(400);
    expect(body).toBe("The request should contain a file ID as parameter.");
  });

  test("invalid file id", async () => {
    const { status, body } = await userRequest(
      "POST",
      `http://target?id=invalid-file-id`
    );

    expect(status).toBe(404);
    expect(body).toBe("The file with the given file ID could not be found.");
  });

  test("unstored file", async () => {
    const { status, body } = await userRequest(
      "POST",
      `http://target?id=${UNSTORED_VIRTUAL_FILE_UUID}`
    );

    expect(status).toBe(500);
    expect(body).toBe(
      "Could not find file in path. Check if the physical file is available on the server and if this service has the right mountpoint."
    );
  });
});

async function registerFile(uploadResourceUuid, fileResourceUuid) {
  const uploadResourceUri = `http://mu.semte.ch/services/file-service/files/${uploadResourceUuid}`;
  const fileResourceName = `${fileResourceUuid}.bpmn`;
  const fileResourceUri = `share://${fileResourceName}`;

  const insertFileQuery = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>  
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    INSERT DATA {
      GRAPH <http://mu.semte.ch/graphs/shared> {
        <${uploadResourceUri}> a nfo:FileDataObject ;
                               mu:uuid "${uploadResourceUuid}" .
        <${fileResourceUri}> a nfo:FileDataObject ;
                             nie:dataSource <${uploadResourceUri}> ;
                             mu:uuid "${fileResourceUuid}" .
      }
      GRAPH <http://mu.semte.ch/graphs/organizations/e415e497-c738-4ddf-908c-189ca0fea754> {
        <${uploadResourceUri}> a nfo:FileDataObject ;
                               mu:uuid "${uploadResourceUuid}" .
        <${fileResourceUri}> a nfo:FileDataObject ;
                             nie:dataSource <${uploadResourceUri}> ;
                             mu:uuid "${fileResourceUuid}" .
      }
    }
  `;
  await runSudoQuery(insertFileQuery);
}

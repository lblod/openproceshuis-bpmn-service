import { app, update, query, uuid } from "mu";
import { querySudo } from "@lblod/mu-auth-sudo";
import bodyParser from "body-parser";
import { readFile } from "fs/promises";
import * as RmlMapper from "@comake/rmlmapper-js";
import { generateMapping } from "./bbo-mapping.js";
import { existsSync } from "fs";
import {
  generateTriplesInsertQuery,
  generateFileUriSelectQuery,
  generateGroupUriSelectQuery,
  generateFileGroupLinkInsertQuery,
} from "./sparql-queries.js";
import { runAsyncJob } from "./job.js";

const STORAGE_FOLDER_PATH = "/share/";
const HEADER_MU_SESSION_ID = "mu-session-id";
const JOB_GRAPH = "http://mu.semte.ch/graphs/bpmn-job";
const JOB_OPERATION =
  "http://redpencil.data.gift/id/jobs/concept/JobOperation/BpmnToRdf";
import { BpmnError } from "./utils/bpmn-error.js";
import { BPMN_CODE, HTTP_CODE } from "./utils/constants.js";

app.use(
  bodyParser.json({
    type: function (req) {
      return /^application\/json/.test(req.get("content-type"));
    },
  })
);

app.post("/", async (req, res, next) => {
  try {
    const sessionUri = req.get(HEADER_MU_SESSION_ID);
    if (!sessionUri) {
      throw new BpmnError(
        "Session ID was not found.",
        BPMN_CODE.SESSION_ID_NOT_FOUND
      );
    }
    const groupUriQuery = generateGroupUriSelectQuery(sessionUri);
    const groupUriResult = await querySudo(groupUriQuery);
    const groupUri = groupUriResult.results.bindings[0]?.groupUri?.value;
    if (!groupUri) {
      throw new BpmnError(
        "Group URI was not found.",
        BPMN_CODE.GROUP_URI_NOT_FOUND
      );
    }
    const virtualFileUuid = req.query.id;
    if (!virtualFileUuid) {
      throw new BpmnError(
        "Virtual file ID was missing.",
        BPMN_CODE.EMPTY_VIRTUAL_FILE_ID
      );
    }
    const fileUriQuery = generateFileUriSelectQuery(virtualFileUuid);
    const fileUriResult = await query(fileUriQuery);
    const fileUriBindings = fileUriResult.results.bindings;
    if (fileUriBindings.length === 0) {
      throw new BpmnError(
        `Virtual file ID ${virtualFileUuid} was not found on our server.`,
        BPMN_CODE.VIRTUAL_FILE_ID_NOT_FOUND
      );
    }
    const virtualFileUri = fileUriBindings[0].virtualFileUri.value;
    const physicalFileUri = fileUriBindings[0].physicalFileUri.value;

    const fileGroupLinkInsertQuery = generateFileGroupLinkInsertQuery(
      virtualFileUri,
      groupUri
    );
    await update(fileGroupLinkInsertQuery);

    const filePath = physicalFileUri.replace("share://", STORAGE_FOLDER_PATH);
    if (!existsSync(filePath)) {
      throw new BpmnError(
        "Could not find path of physical file.",
        BPMN_CODE.PHYSICAL_FILE_ID_NOT_FOUND
      );
    }

    runAsyncJob(JOB_GRAPH, JOB_OPERATION, groupUri, virtualFileUri, () =>
      extractAndInsertProcessSteps(filePath, virtualFileUri)
    );

    return res
      .status(HTTP_CODE.ACCEPTED)
      .send({ message: "process steps extraction job running" });
  } catch (err) {
    console.error("Error in POST /:", err);
    next(err);
  }
});

async function extractAndInsertProcessSteps(bpmnFilePath, virtualFileUri) {
  const bpmnFile = await readFile(bpmnFilePath, "utf-8");
  const bboTriples = await translateToRdf(bpmnFile, virtualFileUri);

  const bboTriplesBySubject = chunkTriplesBySubject(bboTriples);
  await insertTripleChunks(bboTriplesBySubject);
}

async function translateToRdf(bpmn, virtualFileUri) {
  if (!bpmn || bpmn.trim().length === 0) {
    throw new BpmnError(
      "Invalid content: Provided file does not contain any content.",
      BPMN_CODE.EMPTY_CONTENT
    );
  }

  const inputFiles = {
    "input.bpmn": bpmn,
  };
  const options = {
    compact: {
      "@base": "http://data.lblod.info/",
    },
    toRDF: true,
    xpathLib: "xpath",
  };

  const triples = await RmlMapper.parseTurtle(
    await generateMapping(virtualFileUri),
    inputFiles,
    options
  );
  if (!triples || triples.trim().length === 0) {
    throw new BpmnError(
      "Invalid content: Provided file does not contain valid content.",
      BPMN_CODE.INVALID_CONTENT
    );
  }

  return triples.split("\n");
}

function chunkTriplesBySubject(triples) {
  const triplesBySubjectMap = triples.reduce((acc, triple) => {
    const subject = triple.split(" ")[0];

    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(triple);

    return acc;
  }, {});

  return Object.values(triplesBySubjectMap);
}

async function insertTripleChunks(tripleChunks, maxTriplesPerInsert = 100) {
  let index = 0;
  let triplesToInsert = [];

  while (index < tripleChunks.length) {
    if (
      triplesToInsert.length === 0 ||
      triplesToInsert.length + tripleChunks[index].length <= maxTriplesPerInsert
    ) {
      triplesToInsert = triplesToInsert.concat(tripleChunks[index]);
    }

    index++;

    if (
      index >= tripleChunks.length ||
      triplesToInsert.length + tripleChunks[index].length >= maxTriplesPerInsert
    ) {
      const triplesInsertQuery = generateTriplesInsertQuery(triplesToInsert);
      await update(triplesInsertQuery);
      triplesToInsert = [];
    }
  }
}

const errorHandler = function (err, _req, res, _next) {
  res.status(err.status || HTTP_CODE.INTERNAL_SERVER_ERROR);
  res.json({
    errors: [
      {
        message: err.message,
        code: err.code,
      },
    ],
  });
};

app.use(errorHandler);

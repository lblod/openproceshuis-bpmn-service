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
import { HttpError } from "./utils/http-error.js";

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
      throw new HttpError("Session ID header not found.", 401);
    }
    const groupUriQuery = generateGroupUriSelectQuery(sessionUri);
    const groupUriResult = await querySudo(groupUriQuery);
    const groupUri = groupUriResult.results.bindings[0]?.groupUri?.value;
    if (!groupUri) {
      throw new HttpError("User not affiliated with any organization.", 401);
    }
    const virtualFileUuid = req.query.id;
    if (!virtualFileUuid) {
      throw new HttpError("Missing file id in query parameters.", 400);
    }
    const fileUriQuery = generateFileUriSelectQuery(virtualFileUuid);
    const fileUriResult = await query(fileUriQuery);
    const fileUriBindings = fileUriResult.results.bindings;
    if (fileUriBindings.length === 0) {
      throw new HttpError("File id was not found!", 404);
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
      throw new HttpError(
        "Could not find file in path. Check if the physical file is available on the server and if this service has the right mountpoint.",
        500
      );
    }

    runAsyncJob(JOB_GRAPH, JOB_OPERATION, groupUri, virtualFileUri, () =>
      extractAndInsertProcessSteps(filePath, virtualFileUri)
    );

    return res
      .status(202)
      .send({ message: "process steps extraction job running" });
  } catch (err) {
    console.error("Error in POST /:", err);
    // Forward error to error middleware
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
    throw new HttpError(
      "Invalid content: The provided file does not contain any content.",
      400
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
    throw new HttpError(
      "Invalid content: The provided file does not contain valid content.",
      400
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
  res.status(err.status || 500);
  res.json({
    errors: [{ title: err.message, description: err.description?.join("\n") }],
  });
};

app.use(errorHandler);

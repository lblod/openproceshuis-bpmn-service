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
import { STATUS_CODE } from "./utils/constants.js";

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
      throw new HttpError("Session ID header werd niet gevonden.", 400);
    }
    const groupUriQuery = generateGroupUriSelectQuery(sessionUri);
    const groupUriResult = await querySudo(groupUriQuery);
    const groupUri = groupUriResult.results.bindings[0]?.groupUri?.value;
    if (!groupUri) {
      throw new HttpError(
        "Gebruiker maakt geen deel uit van een organisatie.",
        STATUS_CODE.UNAUTHORIZED
      );
    }
    const virtualFileUuid = req.query.id;
    if (!virtualFileUuid) {
      throw new HttpError(
        "Bestand id ontbrak tijdens het uploaden van het bpmn bestand.",
        STATUS_CODE.BAD_REQUEST
      );
    }
    const fileUriQuery = generateFileUriSelectQuery(virtualFileUuid);
    const fileUriResult = await query(fileUriQuery);
    const fileUriBindings = fileUriResult.results.bindings;
    if (fileUriBindings.length === 0) {
      throw new HttpError(
        `Bestand id ${virtualFileUuid} werd niet gevonden in onze server.`,
        STATUS_CODE.NOT_FOUND
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
      throw new HttpError(
        "Kan bestand in pad niet vinden.",
        STATUS_CODE.INTERNAL_SERVER_ERROR
      );
    }

    runAsyncJob(JOB_GRAPH, JOB_OPERATION, groupUri, virtualFileUri, () =>
      extractAndInsertProcessSteps(filePath, virtualFileUri)
    );

    return res
      .status(STATUS_CODE.ACCEPTED)
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
    throw new HttpError(
      "Ongeldige inhoud: Het meegeleverde bestand bevat geen inhoud.",
      STATUS_CODE.BAD_REQUEST
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
      "Ongeldige inhoud: Het meegeleverde bestand heeft geen geldige inhoud.",
      STATUS_CODE.BAD_REQUEST
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
  res.status(err.status || STATUS_CODE.INTERNAL_SERVER_ERROR);
  res.json({
    errors: [
      {
        message: err.message,
        description: err.description,
        status: err.status,
      },
    ],
  });
};

app.use(errorHandler);

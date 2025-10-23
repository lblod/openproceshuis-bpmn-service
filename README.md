# BPMN service Open Proces Huis

One of the Open Proces Huis' main functionalities lies in the processing of BPMN files. Specifically, the process steps that make up a BPMN file process should be converted to triples and subsequently inserted into a given triplestore. This functionality is handled by the OPH BPMN service, whose implementation can be found in this repo.

The OPH BPMN service is part of the [Open Proces Huis microservices stack](https://github.com/lblod/app-openproceshuis).

## Endpoints

The OPH BPMN service is effectively a REST API. It is implemented using the [Express](https://expressjs.com/) framework and exposes one endpoint.

### POST `/`

The file targeted by the provided file ID is passed to an RML mapper, which expects a BPMN file and iterates over its BPMN elements. The rules specified in [bbo-mapping.js] outline which elements should be converted to triples and eventually inserted into the triplestore.

The endpoint does not wait for the process steps' extraction and insertion into the triplestore. Instead, it fires up a background job responsible for this, and immediately returns an `HTTP 202` response. A subject of type `http://vocab.deri.ie/cogs#Job` is added to the `http://mu.semte.ch/graphs/bpmn-job` graph in the connected triple store. Among others, it holds a property referring to the URI of the BPMN file at stake (i.e. `http://mu.semte.ch/vocabularies/ext/relatedTo`), as well as a property indicating the job's status (i.e. `http://www.w3.org/ns/adms#status`). The latter can assume one of the following values:

- `http://redpencil.data.gift/id/concept/JobStatus/scheduled`
- `http://redpencil.data.gift/id/concept/JobStatus/busy`
- `http://redpencil.data.gift/id/concept/JobStatus/success`
- `http://redpencil.data.gift/id/concept/JobStatus/failed`
- `http://redpencil.data.gift/id/concept/JobStatus/canceled`

> The [Open Proces Huis microservices stack](https://github.com/lblod/app-openproceshuis) is configured in such a way that it allows for API requests for these _job_ resources. E.g. the `GET` request `/jobs?filter[:exact:resource]=http://mu.semte.ch/services/file-service/files/123` returns all data regarding the job that was fired after the file with file ID _123_ was targeted for process steps extraction and insertion.

#### Query parameters

- `id`: the ID of the file whose process steps should be extracted and inserted into the triplestore.

#### Headers

- `mu-session-id`: each authenticated user has its own session. Based on the user's session ID, the endpoint will find the group (_Bestuur_) and link it to the BPMN file as follows: `<file uri> schema:publisher <group uri>`. Make sure the stack containing the OPH BPMN service also contains the [mu-identifier](https://github.com/mu-semtech/mu-identifier) service, as it will automatically add this header to each authenticated request.

## Contract tests

The service contains some contract tests, evaluating the output and database state after running the endpoint(s) for given input(s). The tests are executed using the [lblod/contract-testing](https://github.com/lblod/contract-testing) image.

### How to run

1. Move to the `contract-tests` folder:

```bash
cd contract-tests
```

2. Start the necessary containers and run the tests:

```bash
docker compose up -V  --abort-on-container-exit
```

> The `tests` container will log the test results.

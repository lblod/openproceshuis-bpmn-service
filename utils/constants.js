export const HTTP_CODE = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  INTERNAL_SERVER_ERROR: 500,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
};

export const BPMN_CODE = {
  SESSION_ID_NOT_FOUND: "bpmn.sessionIdNotFound",
  GROUP_URI_NOT_FOUND: "bpmn.groupUriNotFound",
  EMPTY_VIRTUAL_FILE_ID: "bpmn.emptyVirtualFileId",
  VIRTUAL_FILE_ID_NOT_FOUND: "bpmn.virtualFileIdNotFound",
  PHYSICAL_FILE_ID_NOT_FOUND: "bpmn.physicalFileIdNotFound",
  EMPTY_CONTENT: "bpmn.emptyContent",
  INVALID_CONTENT: "bpmn.invalidContent",
  ERROR_DURING_JOB_EXECUTION: "bpmn.errorDuringJobExecution",
};

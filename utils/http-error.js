import { STATUS_CODE } from "./constants";

export class HttpError extends Error {
  constructor(message, status, description) {
    super(message);

    this.status = status || STATUS_CODE.INTERNAL_SERVER_ERROR;
    this.description = description || null;

    console.error("\n Http error: ", this.message);
  }
}

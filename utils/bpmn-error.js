export class BpmnError extends Error {
  constructor(message, code, status) {
    super(message);

    this.code = code;

    this.status = status;

    console.error("\n Bpmn error: ", this.message);
  }
}

export class BpmnError extends Error {
  constructor(message, code) {
    super(message);

    this.code = code;

    console.error("\n Bpmn error: ", this.message);
  }
}

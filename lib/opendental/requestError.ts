export class OpenDentalRequestError extends Error {
  readonly status: number | null;
  readonly code = "opendental_request_failed";

  constructor(status: number | null = null) {
    super("Open Dental request failed.");
    this.name = "OpenDentalRequestError";
    this.status = status;
  }
}

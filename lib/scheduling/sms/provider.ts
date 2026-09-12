export type SmsSendInput = {
  to: string;
  body: string;
  practiceId: string;
  patientId: string;
};

export type SmsSendResult = {
  provider: string;
  providerMessageId: string;
  status: "sent" | "failed";
  error?: string;
};

export type SmsProvider = {
  readonly name: string;
  send(input: SmsSendInput): Promise<SmsSendResult>;
};

export class SmsDestinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmsDestinationError";
  }
}

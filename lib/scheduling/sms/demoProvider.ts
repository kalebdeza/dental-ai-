import { demoSmsAddress, isDemoSmsAddress } from "../types.ts";
import {
  SmsDestinationError,
  type SmsProvider,
  type SmsSendInput,
  type SmsSendResult,
} from "./provider.ts";

export type DemoSmsLogEntry = SmsSendInput &
  SmsSendResult & {
    recordedAt: string;
  };

/**
 * Records outbound messages in memory. Never delivers to a carrier.
 * Real phone numbers are rejected even if passed by mistake.
 */
export function createDemoSmsProvider(): SmsProvider & {
  logs: DemoSmsLogEntry[];
} {
  const logs: DemoSmsLogEntry[] = [];

  return {
    name: "demo",
    logs,
    async send(input) {
      const to = input.to.trim();

      if (!isDemoSmsAddress(to)) {
        throw new SmsDestinationError(
          "Demo SMS cannot target a real phone number."
        );
      }

      const result: SmsSendResult = {
        provider: "demo",
        providerMessageId: `demo-${crypto.randomUUID()}`,
        status: "sent",
      };

      logs.push({
        ...input,
        ...result,
        recordedAt: new Date().toISOString(),
      });

      return result;
    },
  };
}

export function demoDestinationForPatient(patientId: string): string {
  return demoSmsAddress(patientId);
}

export const demoSmsProvider = createDemoSmsProvider();

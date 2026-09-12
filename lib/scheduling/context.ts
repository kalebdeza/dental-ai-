import {
  recordContactOutcome,
  type OpportunityWorkflowClient,
} from "../data/opportunityWorkflow.ts";
import { createDemoSmsProvider } from "./sms/demoProvider.ts";
import type { SmsProvider } from "./sms/provider.ts";
import {
  createSupabaseSchedulingStore,
  type SchedulingClient,
} from "./store.ts";
import type { WorkflowContext } from "./workflow.ts";

export function createAuthenticatedSchedulingContext(options: {
  client: SchedulingClient & Partial<OpportunityWorkflowClient>;
  practiceId: string;
  sms?: SmsProvider;
  actor?: WorkflowContext["actor"];
  now?: Date;
}): WorkflowContext {
  return {
    store: createSupabaseSchedulingStore(options.client),
    sms: options.sms ?? createDemoSmsProvider(),
    actor: options.actor ?? "office",
    now: options.now,
    onOpportunityScheduled: async (opportunityId) => {
      try {
        await recordContactOutcome(options.client as OpportunityWorkflowClient, {
          practiceId: options.practiceId,
          opportunityId,
          contactOutcome: "scheduled",
          note: "Recorded from Dental AI scheduling (demo).",
        });
      } catch {
        // Appointment state still records the visit. Opportunity RPC
        // requires an authenticated office user and may already be scheduled.
      }
    },
  };
}

export function createCronSchedulingContext(options: {
  client: SchedulingClient;
  sms?: SmsProvider;
  now?: Date;
}): WorkflowContext {
  return {
    store: createSupabaseSchedulingStore(options.client),
    sms: options.sms ?? createDemoSmsProvider(),
    actor: "system",
    now: options.now,
  };
}

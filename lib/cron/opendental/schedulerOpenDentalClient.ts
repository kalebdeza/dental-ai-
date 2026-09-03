import "server-only";

import { createSchedulerOpenDentalClientFromConfig } from "./clientFactory";
import type { SchedulerOpenDentalClient } from "./clientFactory";

export type { SchedulerOpenDentalClient };

export function createSchedulerOpenDentalClient(
  customerKey: string
): SchedulerOpenDentalClient {
  return createSchedulerOpenDentalClientFromConfig({
    customerKey,
    apiUrl: process.env.OPEN_DENTAL_API_URL ?? "",
    developerKey: process.env.OPEN_DENTAL_DEVELOPER_KEY ?? "",
  });
}

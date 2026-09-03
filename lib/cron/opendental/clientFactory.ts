import { collectOpenDentalPages, paginateOpenDental } from "./fetchPages.ts";
import type { SchedulerOpenDentalRequest } from "./fetchPages.ts";
import type {
  OpenDentalClaim,
  OpenDentalPatient,
  OpenDentalProcedure,
  OpenDentalProcedureCode,
  OpenDentalProcTP,
  OpenDentalRecall,
  OpenDentalTreatPlan,
  OpenDentalTreatPlanAttach,
} from "./types.ts";

export type SchedulerOpenDentalClient = {
  assertReachable: () => Promise<void>;
  forEachPatientPage: (
    onPage: (page: OpenDentalPatient[]) => Promise<void>
  ) => Promise<{ pages: number; records: number }>;
  forEachProcedureCodePage: (
    onPage: (page: OpenDentalProcedureCode[]) => Promise<void>
  ) => Promise<{ pages: number; records: number }>;
  forEachProcedurePage: (
    onPage: (page: OpenDentalProcedure[]) => Promise<void>
  ) => Promise<{ pages: number; records: number }>;
  forEachClaimPage: (
    onPage: (page: OpenDentalClaim[]) => Promise<void>
  ) => Promise<{ pages: number; records: number }>;
  forEachRecallPage: (
    onPage: (page: OpenDentalRecall[]) => Promise<void>
  ) => Promise<{ pages: number; records: number }>;
  listTreatPlans: () => Promise<OpenDentalTreatPlan[]>;
  listTreatPlanAttaches: (
    treatPlanNum: number
  ) => Promise<OpenDentalTreatPlanAttach[]>;
  listProcTPs: (treatPlanNum: number) => Promise<OpenDentalProcTP[]>;
};

export function createSchedulerOpenDentalClientFromConfig(
  config: SchedulerOpenDentalRequest
): SchedulerOpenDentalClient {
  if (!config.apiUrl) {
    throw new Error("OPEN_DENTAL_API_URL is not configured.");
  }

  if (!config.developerKey) {
    throw new Error("OPEN_DENTAL_DEVELOPER_KEY is not configured.");
  }

  if (!config.customerKey) {
    throw new Error("Open Dental customer key is missing.");
  }

  return {
    async assertReachable() {
      await paginateOpenDental(config, "/clinics", async () => {
        // Connectivity check only. Clinic rows are not stored or logged.
      });
    },

    forEachPatientPage(onPage) {
      return paginateOpenDental(config, "/patients/Simple", onPage);
    },

    forEachProcedureCodePage(onPage) {
      return paginateOpenDental(config, "/procedurecodes", onPage);
    },

    forEachProcedurePage(onPage) {
      return paginateOpenDental(config, "/procedurelogs", onPage);
    },

    forEachClaimPage(onPage) {
      return paginateOpenDental(config, "/claims", onPage);
    },

    forEachRecallPage(onPage) {
      return paginateOpenDental(config, "/recalls", onPage);
    },

    listTreatPlans() {
      return collectOpenDentalPages<OpenDentalTreatPlan>(
        config,
        "/treatplans"
      );
    },

    listTreatPlanAttaches(treatPlanNum: number) {
      return collectOpenDentalPages<OpenDentalTreatPlanAttach>(
        config,
        "/treatplanattaches",
        { TreatPlanNum: treatPlanNum }
      );
    },

    listProcTPs(treatPlanNum: number) {
      return collectOpenDentalPages<OpenDentalProcTP>(config, "/proctps", {
        TreatPlanNum: treatPlanNum,
      });
    },
  };
}

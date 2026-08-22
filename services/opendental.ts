import { env } from "@/lib/api/env";
import { withTimeout } from "@/lib/api/timeout";

export type OpenDentalPatient = {
  PatNum: number;
  FName?: string;
  LName?: string;
  PreferredName?: string;
  MiddleI?: string;
  Birthdate?: string;
  Gender?: string;
  Email?: string;
  WirelessPhone?: string;
  HmPhone?: string;
  WkPhone?: string;
  Address?: string;
  City?: string;
  State?: string;
  Zip?: string;
  BalTotal?: number;
  InsEst?: number;
  DateLastVisit?: string;
  PatStatus?: string;
};

export type OpenDentalProcedureCode = {
  CodeNum: number;
  ProcCode?: string;
  Descript?: string;
  Category?: string;
  ProcFee?: number;
  IsHidden?: boolean;
};

export type OpenDentalProcedure = {
  ProcNum: number;
  PatNum: number;
  ProcDate?: string;
  ProcFee?: number;
  ProcStatus?: string;
  ProvNum?: number;
  CodeNum?: number;
  ToothNum?: string;
  Surf?: string;
};

export type OpenDentalClaim = {
  ClaimNum: number;
  PatNum: number;
  DateSent?: string;
  ClaimStatus?: string;
  ClaimFee?: number;
  InsPayEst?: number;
  InsPayAmt?: number;
};

export type OpenDentalClaimProc = {
  ClaimProcNum: number;
  ClaimNum: number;
  PatNum: number;
  ProcNum?: number;
  InsPayEst?: number;
  InsPayAmt?: number;
};

export type OpenDentalRecall = {
  RecallNum: number;
  PatNum: number;
  DateDue?: string;
  DatePrevious?: string;
  RecallStatus?: string;
  DateScheduled?: string;
  RecallTypeNum?: number;
};

/**
 * Open Dental treatment plan.
 *
 * Active and inactive treatment plans are
 * represented by TreatPlan records.
 */
export type OpenDentalTreatPlan = {
  TreatPlanNum: number;
  PatNum: number;
  DateTP?: string;
  Heading?: string;
  Note?: string;
  TPStatus?: string;
};

/**
 * Procedure attached to an active/inactive
 * treatment plan.
 */
export type OpenDentalTreatPlanAttach = {
  TreatPlanAttachNum: number;
  TreatPlanNum: number;
  ProcNum?: number;
  Priority?: number;
};

/**
 * Procedure stored on a saved treatment plan.
 *
 * FeeAmt is the fee associated with the
 * treatment-plan procedure.
 */
export type OpenDentalProcTP = {
  ProcTPNum: number;
  TreatPlanNum: number;
  PatNum: number;
  ProcCode?: string;
  Descript?: string;
  FeeAmt?: number;
  InsEstAmt?: number;
  Priority?: number;
};

type TestConnectionResult =
  | {
      success: true;
      clinic: unknown;
    }
  | {
      success: false;
      message: string;
    };

type OpenDentalRequestOptions = {
  limit?: number;
  offset?: number;
  params?: Record<
    string,
    string | number | boolean | undefined
  >;
};

export class OpenDentalService {
  private getHeaders(
    customerKey: string
  ) {
    return {
      Authorization: `ODFHIR ${env.OPEN_DENTAL_DEVELOPER_KEY}/${customerKey}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    customerKey: string,
    endpoint: string,
    options: OpenDentalRequestOptions = {}
  ): Promise<T> {
    const url = new URL(
      `${env.OPEN_DENTAL_API_URL}${endpoint}`
    );

    const params = {
      ...(options.params ?? {}),
    };

    if (options.limit !== undefined) {
      params.Limit = options.limit;
    }

    if (options.offset !== undefined) {
      params.Offset = options.offset;
    }

    Object.entries(params).forEach(
      ([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(
            key,
            String(value)
          );
        }
      }
    );

    const response = await withTimeout(
      fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders(
          customerKey
        ),
      }),
      30000
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        `Open Dental API ${response.status}: ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  private async getAll<T>(
    customerKey: string,
    endpoint: string,
    params?: Record<
      string,
      string | number | boolean | undefined
    >
  ): Promise<T[]> {
    const results: T[] = [];

    const limit = 100;
    let offset = 0;

    while (true) {
      const page =
        await this.request<T[]>(
          customerKey,
          endpoint,
          {
            limit,
            offset,
            params,
          }
        );

      if (!Array.isArray(page)) {
        throw new Error(
          `Unexpected response from Open Dental ${endpoint}.`
        );
      }

      results.push(...page);

      if (page.length < limit) {
        break;
      }

      offset += limit;
    }

    return results;
  }

  async testConnection(
    customerKey: string
  ): Promise<TestConnectionResult> {
    try {
      const clinics =
        await this.request<unknown[]>(
          customerKey,
          "/clinics"
        );

      return {
        success: true,
        clinic: clinics[0] ?? null,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to connect to Open Dental.",
      };
    }
  }

  async getPatients(
    customerKey: string
  ): Promise<OpenDentalPatient[]> {
    return this.getAll<OpenDentalPatient>(
      customerKey,
      "/patients/Simple"
    );
  }

  async getProcedureCodes(
    customerKey: string
  ): Promise<OpenDentalProcedureCode[]> {
    return this.getAll<OpenDentalProcedureCode>(
      customerKey,
      "/procedurecodes"
    );
  }

  async getProcedures(
    customerKey: string
  ): Promise<OpenDentalProcedure[]> {
    return this.getAll<OpenDentalProcedure>(
      customerKey,
      "/procedurelogs"
    );
  }

  async getClaims(
    customerKey: string
  ): Promise<OpenDentalClaim[]> {
    return this.getAll<OpenDentalClaim>(
      customerKey,
      "/claims"
    );
  }

  async getClaimProcs(
    customerKey: string
  ): Promise<OpenDentalClaimProc[]> {
    return this.getAll<OpenDentalClaimProc>(
      customerKey,
      "/claimprocs"
    );
  }

  async getRecalls(
    customerKey: string
  ): Promise<OpenDentalRecall[]> {
    return this.getAll<OpenDentalRecall>(
      customerKey,
      "/recalls"
    );
  }

  async getTreatPlans(
    customerKey: string
  ): Promise<OpenDentalTreatPlan[]> {
    return this.getAll<OpenDentalTreatPlan>(
      customerKey,
      "/treatplans"
    );
  }

  async getTreatPlanAttaches(
    customerKey: string,
    treatPlanNum?: number
  ): Promise<OpenDentalTreatPlanAttach[]> {
    return this.getAll<OpenDentalTreatPlanAttach>(
      customerKey,
      "/treatplanattaches",
      treatPlanNum !== undefined
        ? {
            TreatPlanNum: treatPlanNum,
          }
        : undefined
    );
  }

  async getProcTPs(
    customerKey: string,
    treatPlanNum?: number
  ): Promise<OpenDentalProcTP[]> {
    return this.getAll<OpenDentalProcTP>(
      customerKey,
      "/proctps",
      treatPlanNum !== undefined
        ? {
            TreatPlanNum: treatPlanNum,
          }
        : undefined
    );
  }
}

export const openDental =
  new OpenDentalService();
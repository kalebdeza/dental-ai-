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

export type OpenDentalRecall = {
  RecallNum: number;
  PatNum: number;
  DateDue?: string;
  DatePrevious?: string;
  RecallStatus?: number;
  recallStatus?: string;
  DateScheduled?: string;
  RecallTypeNum?: number;
};

export type OpenDentalTreatPlan = {
  TreatPlanNum: number;
  PatNum: number;
  DateTP?: string;
  Heading?: string;
  Note?: string;
  TPStatus?: string;
};

export type OpenDentalTreatPlanAttach = {
  TreatPlanAttachNum: number;
  TreatPlanNum: number;
  ProcNum?: number;
  Priority?: number;
};

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

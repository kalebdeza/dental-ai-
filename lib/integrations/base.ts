export interface IntegrationConfig {
  practiceId: string;

  provider: "opendental" | "dentrix" | "eaglesoft" | "curve";

  baseUrl: string;

  customerKey: string;

  developerKey?: string;

  developerPortalKey?: string;
}

export interface PMSConnector {
  connect(): Promise<void>;

  syncPatients(): Promise<void>;

  syncProviders(): Promise<void>;

  syncAppointments(): Promise<void>;

  syncProcedureCodes(): Promise<void>;

  syncProcedures(): Promise<void>;

  syncClaims(): Promise<void>;

  syncRecalls(): Promise<void>;

  disconnect(): Promise<void>;
}
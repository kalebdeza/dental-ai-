import { IntegrationConfig, PMSConnector } from "./base";

export class DentrixConnector implements PMSConnector {
  constructor(private config: IntegrationConfig) {}

  async connect() {
    throw new Error("Not implemented");
  }

  async syncPatients() {
    throw new Error("Not implemented");
  }

  async syncProviders() {
    throw new Error("Not implemented");
  }

  async syncAppointments() {
    throw new Error("Not implemented");
  }

  async syncProcedureCodes() {
    throw new Error("Not implemented");
  }

  async syncProcedures() {
    throw new Error("Not implemented");
  }

  async syncClaims() {
    throw new Error("Not implemented");
  }

  async syncRecalls() {
    throw new Error("Not implemented");
  }

  async disconnect() {}
}
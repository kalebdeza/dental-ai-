import { IntegrationConfig, PMSConnector } from "./base";

export class OpenDentalConnector implements PMSConnector {
  constructor(private config: IntegrationConfig) {}

  async connect() {
    console.log(
      `Connecting to Open Dental at ${this.config.baseUrl}`
    );
  }

  async syncPatients() {
    console.log("Syncing patients...");
  }

  async syncProviders() {
    console.log("Syncing providers...");
  }

  async syncAppointments() {
    console.log("Syncing appointments...");
  }

  async syncProcedureCodes() {
    console.log("Syncing procedure codes...");
  }

  async syncProcedures() {
    console.log("Syncing procedures...");
  }

  async syncClaims() {
    console.log("Syncing claims...");
  }

  async syncRecalls() {
    console.log("Syncing recalls...");
  }

  async disconnect() {
    console.log("Disconnected.");
  }
}
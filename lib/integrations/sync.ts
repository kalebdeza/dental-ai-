import { IntegrationConfig } from "./base";
import { createConnector } from "./manager";

export async function runFullSync(config: IntegrationConfig) {
  const connector = createConnector(config);

  console.log("🚀 Starting synchronization...");

  await connector.connect();

  await connector.syncPatients();

  await connector.syncProviders();

  await connector.syncAppointments();

  await connector.syncProcedureCodes();

  await connector.syncProcedures();

  await connector.syncClaims();

  await connector.syncRecalls();

  await connector.disconnect();

  console.log("✅ Synchronization complete.");
}
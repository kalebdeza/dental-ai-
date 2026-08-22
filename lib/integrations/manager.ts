import { IntegrationConfig, PMSConnector } from "./base";
import { OpenDentalConnector } from "./opendental";
import { DentrixConnector } from "./dentrix";
import { EaglesoftConnector } from "./eaglesoft";
import { CurveConnector } from "./curve";

export function createConnector(
  config: IntegrationConfig
): PMSConnector {
  switch (config.provider) {
    case "opendental":
      return new OpenDentalConnector(config);

    case "dentrix":
      return new DentrixConnector(config);

    case "eaglesoft":
      return new EaglesoftConnector(config);

    case "curve":
      return new CurveConnector(config);

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
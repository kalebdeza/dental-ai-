import {
  OPENDENTAL_API,
  DEVELOPER_KEY,
  CUSTOMER_KEY,
} from "./config";

export async function odFetch(
  endpoint: string,
  options: RequestInit = {}
) {
  const response = await fetch(
    `${OPENDENTAL_API}${endpoint}`,
    {
      ...options,

      headers: {
        Authorization: `ODFHIR ${DEVELOPER_KEY}/${CUSTOMER_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}
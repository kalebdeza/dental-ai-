import { odFetch } from "./client";

export async function getPatients() {
  return await odFetch("/patients/Simple");
}

export async function getPatient(patNum: number) {
  return await odFetch(`/patients/${patNum}`);
}
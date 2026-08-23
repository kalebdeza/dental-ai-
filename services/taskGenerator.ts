import type { SupabaseServerClient } from "@/lib/auth/types";

export type Task = {
  id: string;
  type: "Claim" | "Recall" | "Treatment";
  patient: string;
  description: string;
  revenue: number;
  priority: string;
};

export class TaskGenerator {
  async generateTasks(
    supabase: SupabaseServerClient,
    practiceId: string
  ): Promise<Task[]> {
    const {
      data: opportunities,
      error,
    } = await supabase
      .from("revenue_opportunities")
      .select("*")
      .eq("practice_id", practiceId)
      .eq("completed", false)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    const patientIds = [
      ...new Set(
        (opportunities ?? [])
          .map(
            (opportunity) =>
              opportunity.patient_id
          )
          .filter(
            (
              patientId
            ): patientId is string =>
              Boolean(patientId)
          )
      ),
    ];

    const patientLookup =
      new Map<
        string,
        {
          id: string;
          first_name: string;
          last_name: string;
        }
      >();

    if (patientIds.length > 0) {
      const {
        data: patients,
        error: patientError,
      } = await supabase
        .from("patients")
        .select(
          "id,first_name,last_name"
        )
        .eq("practice_id", practiceId)
        .in("id", patientIds);

      if (patientError) {
        throw patientError;
      }

      for (const patient of
        patients ?? []) {
        patientLookup.set(
          patient.id,
          patient
        );
      }
    }

    const tasks: Task[] = [];

    for (const opportunity of
      opportunities ?? []) {
      const type =
        opportunity.opportunity_type;

      if (
        type !== "Claim" &&
        type !== "Recall" &&
        type !== "Treatment"
      ) {
        continue;
      }

      const patient =
        opportunity.patient_id
          ? patientLookup.get(
              opportunity.patient_id
            )
          : null;

      tasks.push({
        id: opportunity.id,

        type,

        patient: patient
          ? `${patient.first_name} ${patient.last_name}`
          : "Unknown Patient",

        description:
          opportunity.reason ??
          opportunity.recommended_action ??
          "Review opportunity.",

        revenue: Number(
          opportunity.estimated_value ?? 0
        ),

        priority:
          opportunity.priority ??
          "Medium",
      });
    }

    tasks.sort(
      (a, b) =>
        b.revenue - a.revenue
    );

    return tasks;
  }
}

export const taskGenerator =
  new TaskGenerator();
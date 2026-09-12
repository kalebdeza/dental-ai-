import { requirePracticeForPage } from "@/lib/auth/requirePracticeForPage";
import { loadSchedulingBoard } from "@/lib/data/scheduling";

import ScheduleBoard from "./ScheduleBoard";

export default async function SchedulePage() {
  const { supabase, practice } = await requirePracticeForPage();
  const appointments = await loadSchedulingBoard(supabase, practice.id);

  return (
    <ScheduleBoard
      practice={{
        id: practice.id,
        name: practice.name,
        timezone: practice.timezone,
      }}
      initialAppointments={appointments}
    />
  );
}

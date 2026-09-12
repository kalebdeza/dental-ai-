import { requirePracticeForPage } from "@/lib/auth/requirePracticeForPage";
import { loadSchedulingDetail } from "@/lib/data/scheduling";

import AppointmentDetail from "./AppointmentDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AppointmentPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, practice } = await requirePracticeForPage();
  const item = await loadSchedulingDetail(supabase, practice.id, id);

  if (!item) {
    return (
      <main>
        <h1>Appointment not found</h1>
      </main>
    );
  }

  return <AppointmentDetail item={item} timezone={practice.timezone} />;
}

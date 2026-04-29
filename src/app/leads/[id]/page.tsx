import { AppLayout } from "@/components/layout/app-layout";
import { LeadDetail } from "@/components/leads/lead-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppLayout>
      <LeadDetail leadId={id} />
    </AppLayout>
  );
}

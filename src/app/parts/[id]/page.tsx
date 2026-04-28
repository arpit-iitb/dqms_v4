import { AppLayout } from "@/components/layout/app-layout";
import { PartWorkspace } from "@/components/parts/part-workspace";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PartPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppLayout>
      <PartWorkspace partId={id} />
    </AppLayout>
  );
}

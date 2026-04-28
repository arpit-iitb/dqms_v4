import { AppLayout } from "@/components/layout/app-layout";
import { QuotationsView } from "@/components/quotations/quotations-view";

export default function QuotationsPage() {
  return (
    <AppLayout title="Leads & Quotations">
      <QuotationsView />
    </AppLayout>
  );
}

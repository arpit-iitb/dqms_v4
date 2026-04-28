import { AppLayout } from "@/components/layout/app-layout";
import { ClientsView } from "@/components/clients/clients-view";

export default function ClientsPage() {
  return (
    <AppLayout title="Clients">
      <ClientsView />
    </AppLayout>
  );
}

import { AppLayout } from "@/components/layout/app-layout";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function DashboardPage() {
  return (
    <AppLayout title="Dashboard">
      <DashboardView />
    </AppLayout>
  );
}

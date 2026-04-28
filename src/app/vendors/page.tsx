import { AppLayout } from "@/components/layout/app-layout";
import { VendorsView } from "@/components/vendors/vendors-view";

export default function VendorsPage() {
  return (
    <AppLayout title="Vendors">
      <VendorsView />
    </AppLayout>
  );
}

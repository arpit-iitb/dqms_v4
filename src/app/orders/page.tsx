import { Suspense } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { OrdersView } from "@/components/orders/orders-view";

export default function OrdersPage() {
  return (
    <AppLayout title="Sales Orders">
      <Suspense>
        <OrdersView />
      </Suspense>
    </AppLayout>
  );
}

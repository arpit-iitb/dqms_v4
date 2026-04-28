import { AppLayout } from "@/components/layout/app-layout";
import { OrderForm } from "@/components/orders/order-form";

export default function NewOrderPage() {
  return (
    <AppLayout title="New Sales Order">
      <OrderForm mode="create" />
    </AppLayout>
  );
}

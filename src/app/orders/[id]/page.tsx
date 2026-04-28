import { AppLayout } from "@/components/layout/app-layout";
import { OrderDetail } from "@/components/orders/order-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppLayout>
      <OrderDetail orderId={id} />
    </AppLayout>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { OrderForm } from "@/components/orders/order-form";
import LoadingSpinner from "@/components/ui/loading-spinner";

export default function EditOrderPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((d) => setOrder(d.order))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <AppLayout title="Edit Order"><div className="p-6"><LoadingSpinner /></div></AppLayout>;
  if (!order) return <AppLayout title="Edit Order"><div className="p-6 text-muted-foreground">Order not found</div></AppLayout>;

  return (
    <AppLayout title={`Edit ${order.displayId}`}>
      <OrderForm
        mode="edit"
        initialData={{
          id: order.id,
          clientId: order.client.id,
          status: order.status,
          orderDate: order.orderDate,
          deliveryDate: order.deliveryDate,
          deliveryDatePO: order.deliveryDatePO,
          clientPoNumber: order.clientPoNumber,
          notes: order.notes,
        }}
      />
    </AppLayout>
  );
}

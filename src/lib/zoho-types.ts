export interface ZohoQuotation {
  id: string;
  quoteNumber: string;
  subject: string;
  amount: number;
  createdDate: string;
  customerName?: string;
  status?: string;
}

export interface ZohoSalesOrderRef {
  id: string;
  display: string;
  subject: string;
  date?: string;
  deliveryDate?: string;
  referenceNumber?: string;
}

export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  total: number;
  date: string;
  status: string;
  reference_number?: string;
  salesorder_number?: string;
}

export interface ZohoDeliveryChallan {
  deliverychallan_id: string;
  deliverychallan_number: string;
  customer_name: string;
  total: number;
  date: string;
  status: string;
  reference_number?: string;
  salesorder_number?: string;
}

export interface ZohoDocLineItem {
  lineItemId: string;
  itemId: string;
  name: string;
  sku: string;
  description: string;
  rate: number;
  quantity: number;
  discount: number;
  taxId: string;
  taxName: string;
  taxPercentage: number;
  hsnOrSac: string;
  itemTotal: number;
}

export interface ZohoEstimateDetail {
  estimateId: string;
  estimateNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  lineItems: ZohoDocLineItem[];
}

export interface ZohoSalesOrderDetail {
  salesorderId: string;
  salesorderNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  referenceNumber: string;
  lineItems: ZohoDocLineItem[];
}

export interface ZohoVendor {
  id: string;
  contactName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  status: string;
  source: "zoho";
}

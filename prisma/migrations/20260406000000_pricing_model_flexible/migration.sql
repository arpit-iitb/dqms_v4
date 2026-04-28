-- Make selectedVendorQuoteId nullable (support GroupedPartQuote-based pricing)
ALTER TABLE "pricing_models" ALTER COLUMN "selected_vendor_quote_id" DROP NOT NULL;

-- Add flexible pricing source columns
ALTER TABLE "pricing_models" ADD COLUMN "selected_grouped_quote_id" TEXT;
ALTER TABLE "pricing_models" ADD COLUMN "selected_vendor_name" TEXT;
ALTER TABLE "pricing_models" ADD COLUMN "selected_lead_time_days" INTEGER;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('LEAD', 'QUOTATION_IN_PROGRESS', 'RFQ_SENT', 'QUOTED', 'CLIENT_PROPOSAL_SENT', 'ORDER_CONFIRMED', 'IN_PRODUCTION', 'INSPECTION', 'READY_FOR_DISPATCH', 'DISPATCHED', 'COMPLETED', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartState" AS ENUM ('DRAFT', 'FILES_RECEIVED', 'SANITIZED', 'RFQ_SENT', 'QUOTED', 'PRICED', 'REJECTED', 'CLIENT_APPROVED', 'PLANNED', 'IN_EXECUTION', 'COMPLETED', 'SHIPPED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('STEP', 'DRAWING_PDF');

-- CreateEnum
CREATE TYPE "DerivativeType" AS ENUM ('MASKED', 'RENDER_GLB');

-- CreateEnum
CREATE TYPE "DerivativeStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "AnnotationType" AS ENUM ('MASK', 'NOTE', 'CRITICAL_DIM');

-- CreateEnum
CREATE TYPE "RFQStatus" AS ENUM ('SENT', 'VIEWED', 'QUOTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('MANUFACTURING', 'INSPECTION', 'EMAIL', 'MATERIAL', 'POST_PROCESSING', 'REWORK');

-- CreateEnum
CREATE TYPE "BlockStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailTrigger" AS ENUM ('START', 'COMPLETE');

-- CreateEnum
CREATE TYPE "InspectorType" AS ENUM ('INTERNAL', 'VENDOR');

-- CreateEnum
CREATE TYPE "InspectionOutcome" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER', 'DELIVERY_CHALLAN_CLIENT', 'DELIVERY_CHALLAN_MECHXIMIZE', 'INVOICE', 'INSPECTION_REPORT', 'CLIENT_PO', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATIONS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contact_person" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "vendor_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contact_person" TEXT,
    "contact_phone" TEXT,
    "specialization" TEXT,
    "gstin" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing_counters" (
    "prefix" TEXT NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drawing_counters_pkey" PRIMARY KEY ("prefix")
);

-- CreateTable
CREATE TABLE "order_counters" (
    "prefix" TEXT NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_counters_pkey" PRIMARY KEY ("prefix")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "display_id" TEXT NOT NULL,
    "internal_quote_number" TEXT,
    "client_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'LEAD',
    "order_date" TIMESTAMP(3),
    "delivery_date" TIMESTAMP(3),
    "delivery_date_po" TIMESTAMP(3),
    "zoho_quotation_id" TEXT,
    "zoho_sales_order_id" TEXT,
    "client_po_number" TEXT,
    "client_dc_number" TEXT,
    "mechximize_dc_number" TEXT,
    "update_schedule" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updates_done" BOOLEAN[] DEFAULT ARRAY[]::BOOLEAN[],
    "dispatch_module" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "state" "PartState" NOT NULL DEFAULT 'DRAFT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "client_part_id" TEXT,
    "part_name" TEXT,
    "description" TEXT,
    "material_name" TEXT,
    "material_grade" TEXT,
    "surface_treatment" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "file_type" "FileType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_original" BOOLEAN NOT NULL,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "internal_drawing_id" TEXT,
    "client_drawing_id" TEXT,
    "client_company_name" TEXT,
    "sanitization_metadata" JSONB,
    "ai_sanitized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_derivatives" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "derivative_type" "DerivativeType" NOT NULL,
    "file_path" TEXT NOT NULL,
    "status" "DerivativeStatus" NOT NULL DEFAULT 'PROCESSING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_derivatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_files" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "derivative_id" TEXT,
    "file_type" "FileType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotations" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "type" "AnnotationType" NOT NULL,
    "coordinates" JSONB NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfqs" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" "RFQStatus" NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grouped_rfqs" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "RFQStatus" NOT NULL DEFAULT 'SENT',
    "due_date" TIMESTAMP(3) NOT NULL,
    "cover_note" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grouped_rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grouped_rfq_vendors" (
    "id" TEXT NOT NULL,
    "grouped_rfq_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "overall_notes" TEXT,

    CONSTRAINT "grouped_rfq_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grouped_rfq_parts" (
    "id" TEXT NOT NULL,
    "grouped_rfq_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,

    CONSTRAINT "grouped_rfq_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grouped_part_quotes" (
    "id" TEXT NOT NULL,
    "grouped_rfq_part_id" TEXT NOT NULL,
    "vendor_rfq_id" TEXT NOT NULL,
    "unit_price_usd" DOUBLE PRECISION,
    "lead_time_days" INTEGER,
    "notes" TEXT,
    "quote_breakdown" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grouped_part_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_quotes" (
    "id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "unit_price_usd" DOUBLE PRECISION NOT NULL,
    "lead_time_days" INTEGER NOT NULL,
    "notes" TEXT,
    "quote_breakdown" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_models" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "selected_vendor_quote_id" TEXT NOT NULL,
    "vendor_unit_price_usd" DOUBLE PRECISION NOT NULL,
    "margin_percent" DOUBLE PRECISION NOT NULL,
    "client_unit_price_usd" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_price_usd" DOUBLE PRECISION NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_quotes" (
    "id" TEXT NOT NULL,
    "pricing_model_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "unit_price_usd" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total_price_usd" DOUBLE PRECISION NOT NULL,
    "lead_time_days" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "QuoteStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturing_plans" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "total_blocks" INTEGER NOT NULL DEFAULT 0,
    "completed_blocks" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "vendor_invite_sent_at" TIMESTAMP(3),
    "vendor_invite_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_blocks" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "block_order" INTEGER NOT NULL,
    "type" "BlockType" NOT NULL,
    "process_name" TEXT,
    "vendor_id" TEXT,
    "status" "BlockStatus" NOT NULL DEFAULT 'PENDING',
    "inspector_type" "InspectorType",
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "email_recipient" TEXT,
    "email_template" TEXT,
    "email_content" TEXT,
    "email_trigger" "EmailTrigger",
    "deadline" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "step_data" JSONB,
    "notes" TEXT,
    "scheduled_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_logs" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB NOT NULL,
    "user_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_results" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "inspector_type" "InspectorType" NOT NULL,
    "result" "InspectionOutcome" NOT NULL,
    "notes" TEXT,
    "report_path" TEXT,
    "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_photos" (
    "id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimensions" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "rect_x" DOUBLE PRECISION NOT NULL,
    "rect_y" DOUBLE PRECISION NOT NULL,
    "rect_w" DOUBLE PRECISION NOT NULL,
    "rect_h" DOUBLE PRECISION NOT NULL,
    "dim_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_dimensions" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "dimension_id" TEXT NOT NULL,
    "measured_value" TEXT,
    "result" "InspectionOutcome",

    CONSTRAINT "block_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_email_logs" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "template_key" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "recipient_email" TEXT NOT NULL,
    "recipient_name" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_email_logs" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "document_number" TEXT,
    "file_path" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_public_id_key" ON "clients"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_public_id_key" ON "vendors"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_vendor_code_key" ON "vendors"("vendor_code");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_email_key" ON "vendors"("email");

-- CreateIndex
CREATE UNIQUE INDEX "orders_public_id_key" ON "orders"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_display_id_key" ON "orders"("display_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_internal_quote_number_key" ON "orders"("internal_quote_number");

-- CreateIndex
CREATE INDEX "orders_client_id_idx" ON "orders"("client_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_delivery_date_idx" ON "orders"("delivery_date");

-- CreateIndex
CREATE UNIQUE INDEX "parts_public_id_key" ON "parts"("public_id");

-- CreateIndex
CREATE INDEX "parts_order_id_idx" ON "parts"("order_id");

-- CreateIndex
CREATE INDEX "parts_state_idx" ON "parts"("state");

-- CreateIndex
CREATE INDEX "files_part_id_idx" ON "files"("part_id");

-- CreateIndex
CREATE INDEX "files_internal_drawing_id_idx" ON "files"("internal_drawing_id");

-- CreateIndex
CREATE INDEX "file_derivatives_file_id_idx" ON "file_derivatives"("file_id");

-- CreateIndex
CREATE INDEX "vendor_files_part_id_idx" ON "vendor_files"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_files_file_id_key" ON "vendor_files"("file_id");

-- CreateIndex
CREATE INDEX "annotations_part_id_idx" ON "annotations"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_public_id_key" ON "rfqs"("public_id");

-- CreateIndex
CREATE INDEX "rfqs_part_id_idx" ON "rfqs"("part_id");

-- CreateIndex
CREATE INDEX "rfqs_vendor_id_idx" ON "rfqs"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "grouped_rfqs_public_id_key" ON "grouped_rfqs"("public_id");

-- CreateIndex
CREATE INDEX "grouped_rfqs_order_id_idx" ON "grouped_rfqs"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "grouped_rfq_vendors_access_token_key" ON "grouped_rfq_vendors"("access_token");

-- CreateIndex
CREATE INDEX "grouped_rfq_vendors_grouped_rfq_id_idx" ON "grouped_rfq_vendors"("grouped_rfq_id");

-- CreateIndex
CREATE UNIQUE INDEX "grouped_rfq_vendors_grouped_rfq_id_vendor_id_key" ON "grouped_rfq_vendors"("grouped_rfq_id", "vendor_id");

-- CreateIndex
CREATE INDEX "grouped_rfq_parts_grouped_rfq_id_idx" ON "grouped_rfq_parts"("grouped_rfq_id");

-- CreateIndex
CREATE UNIQUE INDEX "grouped_rfq_parts_grouped_rfq_id_part_id_key" ON "grouped_rfq_parts"("grouped_rfq_id", "part_id");

-- CreateIndex
CREATE INDEX "grouped_part_quotes_grouped_rfq_part_id_idx" ON "grouped_part_quotes"("grouped_rfq_part_id");

-- CreateIndex
CREATE UNIQUE INDEX "grouped_part_quotes_grouped_rfq_part_id_vendor_rfq_id_key" ON "grouped_part_quotes"("grouped_rfq_part_id", "vendor_rfq_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_quotes_rfq_id_key" ON "vendor_quotes"("rfq_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_models_part_id_key" ON "pricing_models"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_quotes_pricing_model_id_key" ON "client_quotes"("pricing_model_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_quotes_access_token_key" ON "client_quotes"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturing_plans_public_id_key" ON "manufacturing_plans"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturing_plans_part_id_key" ON "manufacturing_plans"("part_id");

-- CreateIndex
CREATE INDEX "plan_blocks_plan_id_idx" ON "plan_blocks"("plan_id");

-- CreateIndex
CREATE INDEX "plan_blocks_status_idx" ON "plan_blocks"("status");

-- CreateIndex
CREATE INDEX "step_logs_block_id_idx" ON "step_logs"("block_id");

-- CreateIndex
CREATE UNIQUE INDEX "process_templates_name_key" ON "process_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_results_block_id_key" ON "inspection_results"("block_id");

-- CreateIndex
CREATE INDEX "dimensions_part_id_idx" ON "dimensions"("part_id");

-- CreateIndex
CREATE INDEX "block_dimensions_block_id_idx" ON "block_dimensions"("block_id");

-- CreateIndex
CREATE UNIQUE INDEX "block_dimensions_block_id_dimension_id_key" ON "block_dimensions"("block_id", "dimension_id");

-- CreateIndex
CREATE INDEX "order_email_logs_order_id_idx" ON "order_email_logs"("order_id");

-- CreateIndex
CREATE INDEX "block_email_logs_block_id_idx" ON "block_email_logs"("block_id");

-- CreateIndex
CREATE INDEX "documents_order_id_idx" ON "documents"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_derivatives" ADD CONSTRAINT "file_derivatives_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_files" ADD CONSTRAINT "vendor_files_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_files" ADD CONSTRAINT "vendor_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_files" ADD CONSTRAINT "vendor_files_derivative_id_fkey" FOREIGN KEY ("derivative_id") REFERENCES "file_derivatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouped_rfqs" ADD CONSTRAINT "grouped_rfqs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouped_rfq_vendors" ADD CONSTRAINT "grouped_rfq_vendors_grouped_rfq_id_fkey" FOREIGN KEY ("grouped_rfq_id") REFERENCES "grouped_rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouped_rfq_vendors" ADD CONSTRAINT "grouped_rfq_vendors_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouped_rfq_parts" ADD CONSTRAINT "grouped_rfq_parts_grouped_rfq_id_fkey" FOREIGN KEY ("grouped_rfq_id") REFERENCES "grouped_rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouped_rfq_parts" ADD CONSTRAINT "grouped_rfq_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouped_part_quotes" ADD CONSTRAINT "grouped_part_quotes_grouped_rfq_part_id_fkey" FOREIGN KEY ("grouped_rfq_part_id") REFERENCES "grouped_rfq_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouped_part_quotes" ADD CONSTRAINT "grouped_part_quotes_vendor_rfq_id_fkey" FOREIGN KEY ("vendor_rfq_id") REFERENCES "grouped_rfq_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_models" ADD CONSTRAINT "pricing_models_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_models" ADD CONSTRAINT "pricing_models_selected_vendor_quote_id_fkey" FOREIGN KEY ("selected_vendor_quote_id") REFERENCES "vendor_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_quotes" ADD CONSTRAINT "client_quotes_pricing_model_id_fkey" FOREIGN KEY ("pricing_model_id") REFERENCES "pricing_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_plans" ADD CONSTRAINT "manufacturing_plans_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "manufacturing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_logs" ADD CONSTRAINT "step_logs_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "plan_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "plan_blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "inspection_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimensions" ADD CONSTRAINT "dimensions_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_dimensions" ADD CONSTRAINT "block_dimensions_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "plan_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_dimensions" ADD CONSTRAINT "block_dimensions_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "dimensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_email_logs" ADD CONSTRAINT "order_email_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_email_logs" ADD CONSTRAINT "block_email_logs_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "plan_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

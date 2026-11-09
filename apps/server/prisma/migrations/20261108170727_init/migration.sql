-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'GBP', 'INR');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('draft', 'issued', 'acknowledged', 'partially_delivered', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('scheduled', 'in_transit', 'delivered', 'delayed', 'cancelled');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('active', 'onboarding', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "ProcurementCategory" AS ENUM ('information_technology', 'facilities', 'professional_services', 'marketing', 'operations', 'logistics');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('draft', 'submitted', 'selected', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('owner', 'admin', 'approver', 'buyer', 'viewer');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "job_title" VARCHAR(120),
    "avatar_url" VARCHAR(500),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'viewer',
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "category" "ProcurementCategory" NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'onboarding',
    "contact_name" VARCHAR(120),
    "email" VARCHAR(254),
    "phone" VARCHAR(40),
    "website" VARCHAR(300),
    "address_line1" VARCHAR(180),
    "address_line2" VARCHAR(180),
    "city" VARCHAR(100),
    "region" VARCHAR(100),
    "postal_code" VARCHAR(30),
    "country" VARCHAR(100),
    "tax_id" VARCHAR(60),
    "payment_terms" VARCHAR(120),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "request_number" VARCHAR(40) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'draft',
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "category" "ProcurementCategory" NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "department" VARCHAR(120),
    "needed_by" TIMESTAMPTZ(3),
    "submitted_at" TIMESTAMPTZ(3),
    "decided_at" TIMESTAMPTZ(3),
    "requested_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_items" (
    "id" UUID NOT NULL,
    "purchase_request_id" UUID NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" VARCHAR(40) NOT NULL DEFAULT 'unit',
    "unit_price" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "purchase_request_id" UUID NOT NULL,
    "status" "ApprovalDecision" NOT NULL DEFAULT 'pending',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" UUID NOT NULL,
    "approval_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "approver_id" UUID,
    "status" "ApprovalDecision" NOT NULL DEFAULT 'pending',
    "decision_note" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "purchase_request_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "quotation_number" VARCHAR(40) NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'draft',
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "valid_until" TIMESTAMPTZ(3),
    "notes" TEXT,
    "submitted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "purchase_request_item_id" UUID,
    "description" VARCHAR(300) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    "lead_time_days" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "po_number" VARCHAR(40) NOT NULL,
    "purchase_request_id" UUID,
    "vendor_id" UUID NOT NULL,
    "quotation_id" UUID,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'draft',
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "issued_at" TIMESTAMPTZ(3),
    "expected_delivery_date" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" VARCHAR(40) NOT NULL DEFAULT 'unit',
    "unit_price" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    "received_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "delivery_number" VARCHAR(40) NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'scheduled',
    "carrier" VARCHAR(140),
    "tracking_number" VARCHAR(100),
    "scheduled_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "received_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(64),
    "summary" VARCHAR(500),
    "metadata" JSONB,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_created_by_id_idx" ON "workspaces"("created_by_id");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members"("user_id");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_role_idx" ON "workspace_members"("workspace_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "vendors_workspace_id_status_idx" ON "vendors"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "vendors_workspace_id_category_idx" ON "vendors"("workspace_id", "category");

-- CreateIndex
CREATE INDEX "vendors_workspace_id_name_idx" ON "vendors"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_workspace_id_code_key" ON "vendors"("workspace_id", "code");

-- CreateIndex
CREATE INDEX "purchase_requests_workspace_id_status_created_at_idx" ON "purchase_requests"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "purchase_requests_workspace_id_requested_by_id_idx" ON "purchase_requests"("workspace_id", "requested_by_id");

-- CreateIndex
CREATE INDEX "purchase_requests_requested_by_id_idx" ON "purchase_requests"("requested_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_workspace_id_request_number_key" ON "purchase_requests"("workspace_id", "request_number");

-- CreateIndex
CREATE INDEX "purchase_request_items_purchase_request_id_idx" ON "purchase_request_items"("purchase_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_purchase_request_id_key" ON "approvals"("purchase_request_id");

-- CreateIndex
CREATE INDEX "approvals_workspace_id_status_idx" ON "approvals"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "approval_steps_approver_id_status_idx" ON "approval_steps"("approver_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_approval_id_step_order_key" ON "approval_steps"("approval_id", "step_order");

-- CreateIndex
CREATE INDEX "quotations_workspace_id_status_idx" ON "quotations"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "quotations_vendor_id_idx" ON "quotations"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_workspace_id_quotation_number_key" ON "quotations"("workspace_id", "quotation_number");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_purchase_request_id_vendor_id_key" ON "quotations"("purchase_request_id", "vendor_id");

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items"("quotation_id");

-- CreateIndex
CREATE INDEX "quotation_items_purchase_request_item_id_idx" ON "quotation_items"("purchase_request_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_items_quotation_id_purchase_request_item_id_key" ON "quotation_items"("quotation_id", "purchase_request_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_quotation_id_key" ON "purchase_orders"("quotation_id");

-- CreateIndex
CREATE INDEX "purchase_orders_workspace_id_status_issued_at_idx" ON "purchase_orders"("workspace_id", "status", "issued_at");

-- CreateIndex
CREATE INDEX "purchase_orders_vendor_id_idx" ON "purchase_orders"("vendor_id");

-- CreateIndex
CREATE INDEX "purchase_orders_purchase_request_id_idx" ON "purchase_orders"("purchase_request_id");

-- CreateIndex
CREATE INDEX "purchase_orders_created_by_id_idx" ON "purchase_orders"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_workspace_id_po_number_key" ON "purchase_orders"("workspace_id", "po_number");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "deliveries_workspace_id_status_scheduled_at_idx" ON "deliveries"("workspace_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "deliveries_purchase_order_id_idx" ON "deliveries"("purchase_order_id");

-- CreateIndex
CREATE INDEX "deliveries_received_by_id_idx" ON "deliveries"("received_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_workspace_id_delivery_number_key" ON "deliveries"("workspace_id", "delivery_number");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "audit_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_purchase_request_item_id_fkey" FOREIGN KEY ("purchase_request_item_id") REFERENCES "purchase_request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

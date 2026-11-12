-- Phase 4 adds request notes, soft deletion, and item categories.
ALTER TABLE "purchase_requests"
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(3),
ADD COLUMN     "deleted_by_id" UUID;

ALTER TABLE "purchase_request_items"
ADD COLUMN     "category" "ProcurementCategory";

-- CreateIndex
CREATE INDEX "purchase_requests_workspace_id_deleted_at_status_created_at_idx" ON "purchase_requests"("workspace_id", "deleted_at", "status", "created_at");

-- CreateIndex
CREATE INDEX "purchase_requests_workspace_id_deleted_at_requested_by_id_idx" ON "purchase_requests"("workspace_id", "deleted_at", "requested_by_id");

-- CreateIndex
CREATE INDEX "purchase_requests_deleted_by_id_idx" ON "purchase_requests"("deleted_by_id");

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

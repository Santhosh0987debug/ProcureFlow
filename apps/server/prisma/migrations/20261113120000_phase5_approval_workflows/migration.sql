-- Phase 5 introduces configurable approval workflows and multi-cycle approvals.
--
-- The migration preserves existing approval rows:
--   * every historical approval becomes cycle 1 of its purchase request;
--   * existing steps keep their decisions and are promoted to sequential levels;
--   * `current_step` is translated to `current_level`, and only pending steps at
--     the current level are marked active.

-- CreateEnum
CREATE TYPE "ApprovalCycleStatus" AS ENUM ('pending', 'approved', 'rejected', 'changes_requested', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('pending', 'approved', 'rejected', 'changes_requested', 'cancelled', 'skipped');

-- CreateEnum
CREATE TYPE "ApprovalLevelRule" AS ENUM ('all_required', 'any_one');

-- CreateEnum
CREATE TYPE "ApproverAssignmentType" AS ENUM ('member', 'role');

-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'submitted';
ALTER TYPE "RequestStatus" ADD VALUE 'changes_requested';

-- AlterEnum
-- Replace the Phase 1 decision enum with separate cycle and step statuses while
-- keeping existing values. The old enum is dropped after both casts succeed.
ALTER TABLE "approvals" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "approval_steps" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "approvals"
ALTER COLUMN "status" TYPE "ApprovalCycleStatus"
USING ("status"::text)::"ApprovalCycleStatus";

ALTER TABLE "approval_steps"
ALTER COLUMN "status" TYPE "ApprovalStepStatus"
USING ("status"::text)::"ApprovalStepStatus";

ALTER TABLE "approvals" ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "approval_steps" ALTER COLUMN "status" SET DEFAULT 'pending';

DROP TYPE "ApprovalDecision";

-- AlterTable approvals
ALTER TABLE "approvals"
ADD COLUMN     "current_level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "cycle_number" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "level_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "requested_by_id" UUID,
ADD COLUMN     "workflow_description" TEXT,
ADD COLUMN     "workflow_id" UUID,
ADD COLUMN     "workflow_name" VARCHAR(120);

UPDATE "approvals" AS a
SET "current_level" = a."current_step",
    "requested_by_id" = pr."requested_by_id"
FROM "purchase_requests" AS pr
WHERE pr."id" = a."purchase_request_id";

-- AlterTable approval_steps
ALTER TABLE "approval_steps"
ADD COLUMN     "assigned_role" "WorkspaceRole",
ADD COLUMN     "assignment_type" "ApproverAssignmentType",
ADD COLUMN     "cancelled_at" TIMESTAMPTZ(3),
ADD COLUMN     "decided_by_id" UUID,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level_order" INTEGER,
ADD COLUMN     "level_rule" "ApprovalLevelRule";

-- Legacy approvals were strictly sequential, so each step becomes its own level.
UPDATE "approval_steps"
SET "level_order" = "step_order",
    "level_rule" = 'all_required',
    "assignment_type" = 'member';

ALTER TABLE "approval_steps"
ALTER COLUMN "assignment_type" SET NOT NULL,
ALTER COLUMN "level_order" SET NOT NULL,
ALTER COLUMN "level_rule" SET NOT NULL;

UPDATE "approval_steps" AS s
SET "is_active" = (s."status" = 'pending' AND s."step_order" = a."current_step")
FROM "approvals" AS a
WHERE a."id" = s."approval_id";

UPDATE "approvals" AS a
SET "level_count" = GREATEST(
    1,
    (
        SELECT COUNT(DISTINCT s."level_order")
        FROM "approval_steps" AS s
        WHERE s."approval_id" = a."id"
    )
);

ALTER TABLE "approvals" DROP COLUMN "current_step";

-- DropIndex
DROP INDEX "approvals_purchase_request_id_key";
DROP INDEX "approvals_workspace_id_status_idx";

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "min_amount" DECIMAL(14,2),
    "max_amount" DECIMAL(14,2),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflow_levels" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "level_order" INTEGER NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "completion_rule" "ApprovalLevelRule" NOT NULL DEFAULT 'all_required',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_workflow_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflow_approvers" (
    "id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "assignment_type" "ApproverAssignmentType" NOT NULL,
    "member_id" UUID,
    "role" "WorkspaceRole",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_workflow_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_workflows_workspace_id_is_active_is_default_idx" ON "approval_workflows"("workspace_id", "is_active", "is_default");

-- CreateIndex
CREATE INDEX "approval_workflows_workspace_id_currency_min_amount_max_amo_idx" ON "approval_workflows"("workspace_id", "currency", "min_amount", "max_amount");

-- CreateIndex
CREATE INDEX "approval_workflows_created_by_id_idx" ON "approval_workflows"("created_by_id");

-- CreateIndex
CREATE INDEX "approval_workflows_updated_by_id_idx" ON "approval_workflows"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflows_workspace_id_name_key" ON "approval_workflows"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_levels_workflow_id_level_order_key" ON "approval_workflow_levels"("workflow_id", "level_order");

-- CreateIndex
CREATE INDEX "approval_workflow_approvers_level_id_idx" ON "approval_workflow_approvers"("level_id");

-- CreateIndex
CREATE INDEX "approval_workflow_approvers_member_id_idx" ON "approval_workflow_approvers"("member_id");

-- CreateIndex
-- "approval_steps_approver_id_status_idx" already exists from Phase 1.

-- CreateIndex
CREATE INDEX "approval_steps_approval_id_level_order_is_active_idx" ON "approval_steps"("approval_id", "level_order", "is_active");

-- CreateIndex
CREATE INDEX "approval_steps_decided_by_id_idx" ON "approval_steps"("decided_by_id");

-- CreateIndex
CREATE INDEX "approvals_workspace_id_status_requested_at_idx" ON "approvals"("workspace_id", "status", "requested_at");

-- CreateIndex
CREATE INDEX "approvals_purchase_request_id_status_idx" ON "approvals"("purchase_request_id", "status");

-- CreateIndex
CREATE INDEX "approvals_requested_by_id_idx" ON "approvals"("requested_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_purchase_request_id_cycle_number_key" ON "approvals"("purchase_request_id", "cycle_number");

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_levels" ADD CONSTRAINT "approval_workflow_levels_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_approvers" ADD CONSTRAINT "approval_workflow_approvers_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "approval_workflow_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_approvers" ADD CONSTRAINT "approval_workflow_approvers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

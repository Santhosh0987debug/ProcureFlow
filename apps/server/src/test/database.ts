import { prisma } from '../lib/prisma.js';

/**
 * Reset the dedicated test database between integration tests. This intentionally
 * truncates every domain table so relationship and constraint tests start clean.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "audit_logs", "deliveries", "purchase_order_items", "purchase_orders", "quotation_items", "quotations", "approval_steps", "approvals", "approval_workflow_approvers", "approval_workflow_levels", "approval_workflows", "purchase_request_items", "purchase_requests", "vendors", "workspace_invitations", "workspace_members", "workspaces", "users" RESTART IDENTITY CASCADE',
  );
}

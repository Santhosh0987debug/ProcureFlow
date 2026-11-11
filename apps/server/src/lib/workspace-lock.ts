import type { Prisma } from '@prisma/client';

/**
 * Serialize sensitive membership and invitation changes for a workspace.
 * Concurrent owner removal/demotion requests therefore observe each other's
 * committed state before counting active owners.
 */
export async function lockWorkspace(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
): Promise<void> {
  await transaction.$queryRaw`SELECT "id" FROM "workspaces" WHERE "id" = ${workspaceId}::uuid FOR UPDATE`;
}

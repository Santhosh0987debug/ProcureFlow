import type { Permission } from '@procureflow/shared';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import AccessRestrictedPage from '../pages/AccessRestrictedPage';

interface PermissionGateProps {
  anyOf: readonly Permission[];
  children: ReactNode;
}

/**
 * Frontend visibility guard. This is a usability layer only: every protected
 * API operation independently enforces the same workspace permission.
 */
export function PermissionGate({ anyOf, children }: PermissionGateProps) {
  const { activeWorkspace, hasAnyPermission } = useAuth();

  if (!activeWorkspace) {
    return null;
  }

  if (!hasAnyPermission(anyOf)) {
    return <AccessRestrictedPage />;
  }

  return <>{children}</>;
}

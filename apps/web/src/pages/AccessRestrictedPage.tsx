import { ROLE_LABELS } from '@procureflow/shared';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';

export default function AccessRestrictedPage() {
  const { activeWorkspace } = useAuth();
  const roleLabel = activeWorkspace ? ROLE_LABELS[activeWorkspace.role] : 'workspace member';

  return (
    <div className="flex min-h-[62vh] items-center justify-center">
      <Card className="w-full max-w-xl">
        <EmptyState
          icon={LockKeyhole}
          title="Access restricted"
          description={`Your ${roleLabel} role does not include access to this area. Ask a workspace owner or administrator if you need this permission.`}
          action={
            <ButtonLink to="/" variant="primary" icon={ArrowLeft}>
              Back to overview
            </ButtonLink>
          }
        />
      </Card>
    </div>
  );
}

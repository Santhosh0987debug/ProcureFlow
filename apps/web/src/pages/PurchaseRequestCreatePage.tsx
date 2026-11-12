import type { CreatePurchaseRequestRequest } from '@procureflow/shared';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { RequestForm } from '../components/requests/RequestForm';
import { ButtonLink } from '../components/ui/ButtonLink';
import { PageHeader } from '../components/ui/PageHeader';
import { createPurchaseRequest } from '../lib/purchase-request-api';

export default function PurchaseRequestCreatePage() {
  const { activeWorkspace } = useAuth();
  const navigate = useNavigate();
  const workspaceId = activeWorkspace?.id;

  async function handleSubmit(input: CreatePurchaseRequestRequest): Promise<void> {
    if (!workspaceId) {
      return;
    }

    const created = await createPurchaseRequest(workspaceId, input);

    navigate(`/purchase-requests/${created.id}`, {
      replace: true,
      state: { notice: `Draft ${created.requestNumber} created.` },
    });
  }

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        eyebrow="Purchase requests"
        title="New purchase request"
        description="Capture the need, add each line item and save a draft. You can review everything again before submitting it for approval."
        actions={
          <ButtonLink to="/purchase-requests" variant="secondary" icon={ArrowLeft}>
            Back to requests
          </ButtonLink>
        }
      />

      <RequestForm mode="create" cancelHref="/purchase-requests" onSubmit={handleSubmit} />
    </div>
  );
}

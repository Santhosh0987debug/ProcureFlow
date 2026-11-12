import type { CreatePurchaseRequestRequest, PurchaseRequestDetail } from '@procureflow/shared';
import { ArrowLeft, FileWarning } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { RequestForm } from '../components/requests/RequestForm';
import { RequestErrorPanel } from '../components/requests/RequestStates';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { ApiRequestError } from '../lib/api';
import { messageFrom } from '../lib/api-errors';
import { fetchPurchaseRequest, updatePurchaseRequest } from '../lib/purchase-request-api';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export default function PurchaseRequestEditPage() {
  const { activeWorkspace } = useAuth();
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const workspaceId = activeWorkspace?.id;

  const [request, setRequest] = useState<PurchaseRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!workspaceId || !requestId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setNotFound(false);

    fetchPurchaseRequest(workspaceId, requestId, controller.signal)
      .then((result) => setRequest(result))
      .catch((caught: unknown) => {
        if (isAbortError(caught)) {
          return;
        }

        if (caught instanceof ApiRequestError && caught.status === 404) {
          setNotFound(true);
          return;
        }

        setError(messageFrom(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [workspaceId, requestId, reload]);

  async function handleSubmit(input: CreatePurchaseRequestRequest): Promise<void> {
    if (!workspaceId || !requestId || !request) {
      return;
    }

    const updated = await updatePurchaseRequest(workspaceId, requestId, input);

    navigate(`/purchase-requests/${updated.id}`, {
      replace: true,
      state: { notice: `Draft ${updated.requestNumber} updated.` },
    });
  }

  if (loading) {
    return <PageSkeleton />;
  }

  if (notFound) {
    return (
      <div className="flex min-h-[52vh] items-center justify-center">
        <Card className="w-full max-w-xl">
          <EmptyState
            icon={FileWarning}
            title="Purchase request not found"
            description="This request does not exist in the active workspace, or it may have been deleted."
            action={
              <ButtonLink to="/purchase-requests" variant="primary" icon={ArrowLeft}>
                Back to requests
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Purchase requests"
          title="Edit purchase request"
          description="Review and update the draft before it is submitted for approval."
          actions={
            <ButtonLink to="/purchase-requests" variant="secondary" icon={ArrowLeft}>
              Back to requests
            </ButtonLink>
          }
        />
        <RequestErrorPanel
          message={error ?? 'The purchase request could not be loaded.'}
          onRetry={() => setReload((value) => value + 1)}
        />
      </div>
    );
  }

  if (!request.actions.canEdit) {
    return (
      <div className="flex min-h-[52vh] items-center justify-center">
        <Card className="w-full max-w-xl">
          <EmptyState
            icon={FileWarning}
            title="This request can no longer be edited"
            description="Only drafts are editable. Submitted requests are locked while they move through approval."
            action={
              <ButtonLink
                to={`/purchase-requests/${request.id}`}
                variant="primary"
                icon={ArrowLeft}
              >
                View request
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        eyebrow={`${request.requestNumber} · Draft`}
        title="Edit purchase request"
        description="Update the request details or line items. Totals are recalculated when you save."
        actions={
          <ButtonLink to={`/purchase-requests/${request.id}`} variant="secondary" icon={ArrowLeft}>
            Back to request
          </ButtonLink>
        }
      />

      <RequestForm
        mode="edit"
        initial={request}
        cancelHref={`/purchase-requests/${request.id}`}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

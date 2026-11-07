import { ArrowLeft, Compass } from 'lucide-react';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[62vh] items-center justify-center">
      <Card className="w-full max-w-xl">
        <EmptyState
          icon={Compass}
          title="This page is off the map"
          description="The page you are looking for does not exist or has moved. Return to the procurement overview to continue."
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

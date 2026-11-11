import { ArrowLeft } from 'lucide-react';
import { moduleDefinitions } from '../data/modules';
import type { ModuleKey } from '../data/modules';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

interface ModulePageProps {
  moduleKey: ModuleKey;
}

export default function ModulePage({ moduleKey }: ModulePageProps) {
  const moduleDefinition = moduleDefinitions[moduleKey];
  const Icon = moduleDefinition.icon;

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader
        eyebrow={moduleDefinition.eyebrow}
        title={moduleDefinition.title}
        description={moduleDefinition.description}
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-beige bg-white px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-stone">
            <span className="h-1.5 w-1.5 rounded-full bg-ochre" aria-hidden="true" />
            Workflow module
          </span>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-beige/70 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-beige/70 bg-ivory text-stone">
              <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="text-[12.5px] font-medium text-espresso">
              {moduleDefinition.title}
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-taupe">
            <span className="h-1.5 w-1.5 rounded-full bg-taupe" aria-hidden="true" />
            Foundation ready
          </span>
        </div>

        <EmptyState
          icon={Icon}
          title={moduleDefinition.emptyTitle}
          description={moduleDefinition.emptyDescription}
          action={
            <ButtonLink to="/" variant="secondary" icon={ArrowLeft}>
              Back to overview
            </ButtonLink>
          }
        />

        <div className="border-t border-beige/70 bg-ivory/50 px-5 py-3 text-center text-[9.5px] leading-5 text-taupe sm:px-6">
          Phase 3 establishes workspace-scoped roles, permissions, and member administration.
          Procurement workflows are scheduled for a later phase.
        </div>
      </Card>
    </div>
  );
}

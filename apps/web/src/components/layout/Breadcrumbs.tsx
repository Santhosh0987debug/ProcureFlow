import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getNavItemForPath } from '../../data/navigation';

interface BreadcrumbsProps {
  compact?: boolean;
}

export function Breadcrumbs({ compact = false }: BreadcrumbsProps) {
  const { pathname } = useLocation();
  const currentItem = getNavItemForPath(pathname);
  const currentLabel = currentItem?.label ?? 'Page not found';

  if (compact) {
    return (
      <p className="truncate text-[13px] font-medium text-espresso" aria-current="page">
        {currentLabel}
      </p>
    );
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-[12px]">
        <li>
          <Link to="/" className="rounded-sm text-stone transition-colors hover:text-espresso">
            Workspace
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight size={12} strokeWidth={1.8} className="text-taupe" />
        </li>
        <li aria-current="page" className="font-medium text-espresso">
          {currentLabel}
        </li>
      </ol>
    </nav>
  );
}

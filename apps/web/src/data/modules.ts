import {
  BadgeCheck,
  Building2,
  ChartNoAxesColumn,
  FileSpreadsheet,
  FileText,
  History,
  Settings,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ModuleKey =
  | 'purchaseRequests'
  | 'approvals'
  | 'vendors'
  | 'quotations'
  | 'purchaseOrders'
  | 'deliveries'
  | 'reports'
  | 'auditLogs'
  | 'settings';

export interface ModuleDefinition {
  title: string;
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: LucideIcon;
}

export const moduleDefinitions: Record<ModuleKey, ModuleDefinition> = {
  purchaseRequests: {
    title: 'Purchase Requests',
    eyebrow: 'Procurement',
    description:
      'A considered intake experience for purchase intent, with clear ownership from submission to sourcing.',
    emptyTitle: 'Request intake is ready for the next phase',
    emptyDescription:
      'The workspace route and shared request contracts are in place. Intake forms, line items and approval routing arrive in a later phase.',
    icon: FileText,
  },
  approvals: {
    title: 'Approvals',
    eyebrow: 'Procurement',
    description:
      'Keep decisions moving with a focused review queue for requests that need attention.',
    emptyTitle: 'The approval queue is being prepared',
    emptyDescription:
      'Approval records and status vocabulary are defined. The review workflow, thresholds and delegation controls arrive in a later phase.',
    icon: BadgeCheck,
  },
  vendors: {
    title: 'Vendors',
    eyebrow: 'Supply base',
    description:
      'A single, dependable view of your supplier relationships, capabilities and onboarding state.',
    emptyTitle: 'Your vendor directory starts here',
    emptyDescription:
      'Vendor contracts and status definitions are ready. Onboarding flows, contacts and performance records arrive in the next phase.',
    icon: Building2,
  },
  quotations: {
    title: 'Quotations',
    eyebrow: 'Sourcing',
    description: 'Compare supplier responses with structure and clarity before committing spend.',
    emptyTitle: 'Quotation comparison is coming next',
    emptyDescription:
      'The shared quotation contract is in place. Bid collection, comparison and award decisions are planned for a later phase.',
    icon: FileSpreadsheet,
  },
  purchaseOrders: {
    title: 'Purchase Orders',
    eyebrow: 'Operations',
    description:
      'Track commitments from issue through acknowledgement and delivery in one calm workspace.',
    emptyTitle: 'Purchase order operations are next',
    emptyDescription:
      'Order statuses and summary contracts are ready. Issuing, amendments and supplier acknowledgement arrive in a later phase.',
    icon: ShoppingCart,
  },
  deliveries: {
    title: 'Deliveries',
    eyebrow: 'Operations',
    description:
      'Follow inbound goods and services so teams know what has arrived and what is still expected.',
    emptyTitle: 'Delivery tracking is being prepared',
    emptyDescription:
      'Delivery records and status vocabulary are defined. Receiving, exceptions and proof-of-delivery arrive in a later phase.',
    icon: Truck,
  },
  reports: {
    title: 'Reports',
    eyebrow: 'Insights',
    description:
      'Understand spend, cycle time and supplier performance with reporting built for decisions.',
    emptyTitle: 'Deeper reporting arrives next',
    emptyDescription:
      'The dashboard establishes the spend analytics foundation. Exportable reports and category breakdowns are planned for a later phase.',
    icon: ChartNoAxesColumn,
  },
  auditLogs: {
    title: 'Audit Logs',
    eyebrow: 'Governance',
    description:
      'A durable, legible record of the decisions and changes that shape your procurement operation.',
    emptyTitle: 'The audit trail is growing',
    emptyDescription:
      'Membership and invitation changes are now recorded in the append-only audit trail. The filterable audit-log viewer arrives in a later phase.',
    icon: History,
  },
  settings: {
    title: 'Settings',
    eyebrow: 'Workspace',
    description:
      'Shape ProcureFlow around your organisation, approval policy and notification preferences.',
    emptyTitle: 'Workspace preferences are coming',
    emptyDescription:
      'The settings route is ready. Organisation details, approval policy and notification controls arrive in a later phase.',
    icon: Settings,
  },
};

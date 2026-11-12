import { Currency, Priority, ProcurementCategory, RequestStatus } from '@procureflow/shared';

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.Draft]: 'Draft',
  [RequestStatus.PendingApproval]: 'Pending approval',
  [RequestStatus.Approved]: 'Approved',
  [RequestStatus.Rejected]: 'Rejected',
  [RequestStatus.Cancelled]: 'Cancelled',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  [Priority.Low]: 'Low',
  [Priority.Medium]: 'Medium',
  [Priority.High]: 'High',
  [Priority.Urgent]: 'Urgent',
};

export const PRIORITY_STYLES: Record<Priority, { tone: string; dot: string }> = {
  [Priority.Low]: { tone: 'bg-[#f2efea] text-[#6f6258]', dot: 'bg-taupe' },
  [Priority.Medium]: { tone: 'bg-[#f1ece6] text-[#6a5b50]', dot: 'bg-espresso/40' },
  [Priority.High]: { tone: 'bg-[#f4eddf] text-[#6b5430]', dot: 'bg-ochre' },
  [Priority.Urgent]: { tone: 'bg-[#f5e7e2] text-[#8a4a3b]', dot: 'bg-clay' },
};

export const CATEGORY_LABELS: Record<ProcurementCategory, string> = {
  [ProcurementCategory.InformationTechnology]: 'Information technology',
  [ProcurementCategory.Facilities]: 'Facilities',
  [ProcurementCategory.ProfessionalServices]: 'Professional services',
  [ProcurementCategory.Marketing]: 'Marketing',
  [ProcurementCategory.Operations]: 'Operations',
  [ProcurementCategory.Logistics]: 'Logistics',
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  [Currency.USD]: 'USD — US dollar',
  [Currency.EUR]: 'EUR — Euro',
  [Currency.GBP]: 'GBP — Pound sterling',
  [Currency.INR]: 'INR — Indian rupee',
};

export const CATEGORY_OPTIONS = Object.values(ProcurementCategory).map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

export const PRIORITY_OPTIONS = Object.values(Priority).map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}));

export const CURRENCY_OPTIONS = Object.values(Currency).map((value) => ({
  value,
  label: CURRENCY_LABELS[value],
}));

export const REQUEST_STATUS_OPTIONS = Object.values(RequestStatus).map((value) => ({
  value,
  label: REQUEST_STATUS_LABELS[value],
}));

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'purchase_request.created': 'Draft created',
  'purchase_request.updated': 'Draft updated',
  'purchase_request.deleted': 'Draft deleted',
  'purchase_request.submitted': 'Submitted for approval',
};

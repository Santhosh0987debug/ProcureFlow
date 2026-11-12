import { Prisma } from '@prisma/client';
import { Currency, Priority, ProcurementCategory, RequestStatus } from '@procureflow/shared';
import { z } from 'zod';

const workspaceIdSchema = z.string().uuid('The workspace identifier is invalid.');
const requestIdSchema = z.string().uuid('The request identifier is invalid.');

const pageSchema = z.coerce
  .number('Enter a valid page number.')
  .int('Enter a valid page number.')
  .min(1, 'Page numbers start at 1.')
  .default(1);

const pageSizeSchema = z.coerce
  .number('Enter a valid page size.')
  .int('Enter a valid page size.')
  .min(1, 'Page size must be at least 1.')
  .max(100, 'Page size must be 100 or fewer.')
  .default(20);

function decimalInputSchema(maxIntegerDigits: number, label: string) {
  const pattern = new RegExp(`^\\d{1,${maxIntegerDigits}}(\\.\\d{1,2})?$`);

  return z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === 'number' ? String(value) : value.trim()))
    .superRefine((value, context) => {
      if (!pattern.test(value)) {
        context.addIssue({
          code: 'custom',
          message: `${label} must be a number with up to two decimal places.`,
        });
        return;
      }

      try {
        if (!new Prisma.Decimal(value).gt(0)) {
          context.addIssue({
            code: 'custom',
            message: `${label} must be greater than zero.`,
          });
        }
      } catch {
        context.addIssue({
          code: 'custom',
          message: `${label} is not a valid number.`,
        });
      }
    });
}

function optionalTextSchema(maxLength: number, label: string) {
  return z
    .string()
    .trim()
    .max(maxLength, `${label} must be ${maxLength} characters or fewer.`)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));
}

function startOfUtcToday(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

const neededBySchema = z.coerce
  .date()
  .refine((value) => !Number.isNaN(value.getTime()), 'Enter a valid required-by date.')
  .refine(
    (value) => value.getTime() >= startOfUtcToday(),
    'The required-by date cannot be in the past.',
  );

const requestItemSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, 'Enter a description for every line item.')
      .max(300, 'Line item descriptions must be 300 characters or fewer.'),
    quantity: decimalInputSchema(10, 'Quantity'),
    unit: z
      .string()
      .trim()
      .min(1, 'Enter a unit of measure for every line item.')
      .max(40, 'Units of measure must be 40 characters or fewer.'),
    unitPrice: decimalInputSchema(12, 'Unit price'),
    category: z.nativeEnum(ProcurementCategory).optional().nullable(),
    notes: optionalTextSchema(2000, 'Line item notes'),
  })
  .strict();

export const workspaceRequestParamsSchema = z
  .object({
    workspaceId: workspaceIdSchema,
  })
  .strict();

export const purchaseRequestParamsSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    requestId: requestIdSchema,
  })
  .strict();

export const listPurchaseRequestsQuerySchema = z
  .object({
    page: pageSchema,
    pageSize: pageSizeSchema,
    search: z.string().trim().max(180, 'Search terms must be 180 characters or fewer.').optional(),
    status: z.nativeEnum(RequestStatus).optional(),
    requesterId: z.string().uuid('The requester identifier is invalid.').optional(),
    category: z.nativeEnum(ProcurementCategory).optional(),
    priority: z.nativeEnum(Priority).optional(),
    department: z
      .string()
      .trim()
      .max(120, 'Department filters must be 120 characters or fewer.')
      .optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((query) => !query.from || !query.to || query.from.getTime() <= query.to.getTime(), {
    message: 'The start date must be on or before the end date.',
    path: ['to'],
  });

export const createPurchaseRequestSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Enter a request title.')
      .max(180, 'Request titles must be 180 characters or fewer.'),
    description: z
      .string()
      .trim()
      .min(1, 'Enter the business justification for this request.')
      .max(5000, 'Business justification must be 5000 characters or fewer.'),
    department: optionalTextSchema(120, 'Department'),
    category: z.nativeEnum(ProcurementCategory, {
      error: 'Select a procurement category.',
    }),
    priority: z.nativeEnum(Priority, { error: 'Select a priority.' }),
    currency: z.nativeEnum(Currency, { error: 'Select a currency.' }),
    neededBy: neededBySchema,
    notes: optionalTextSchema(2000, 'Request notes'),
    items: z
      .array(requestItemSchema)
      .min(1, 'Add at least one line item.')
      .max(50, 'A request can contain at most 50 line items.'),
  })
  .strict();

export const updatePurchaseRequestSchema = createPurchaseRequestSchema;

export type ListPurchaseRequestsQueryInput = z.infer<typeof listPurchaseRequestsQuerySchema>;
export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;
export type UpdatePurchaseRequestInput = z.infer<typeof updatePurchaseRequestSchema>;

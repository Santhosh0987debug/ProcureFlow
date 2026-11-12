import { Currency, Priority, ProcurementCategory } from '@procureflow/shared';
import type { CreatePurchaseRequestRequest, PurchaseRequestDetail } from '@procureflow/shared';
import { AlertCircle, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORY_OPTIONS, CURRENCY_OPTIONS, PRIORITY_OPTIONS } from '../../data/request-options';
import { fieldErrorsFrom, messageFrom } from '../../lib/api-errors';
import { formatAmount } from '../../lib/format';
import { Card } from '../ui/Card';

interface ItemDraft {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  category: ProcurementCategory | '';
  notes: string;
}

interface RequestFormState {
  title: string;
  description: string;
  department: string;
  category: ProcurementCategory;
  priority: Priority;
  currency: Currency;
  neededBy: string;
  notes: string;
  items: ItemDraft[];
}

interface RequestFormProps {
  mode: 'create' | 'edit';
  initial?: PurchaseRequestDetail;
  cancelHref: string;
  onSubmit: (input: CreatePurchaseRequestRequest) => Promise<void>;
}

let itemSequence = 0;

function nextItemKey(): string {
  itemSequence += 1;
  return `request-item-${itemSequence}`;
}

function emptyItem(): ItemDraft {
  return {
    key: nextItemKey(),
    description: '',
    quantity: '1',
    unit: 'unit',
    unitPrice: '',
    category: '',
    notes: '',
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialState(initial?: PurchaseRequestDetail): RequestFormState {
  if (!initial) {
    return {
      title: '',
      description: '',
      department: '',
      category: ProcurementCategory.InformationTechnology,
      priority: Priority.Medium,
      currency: Currency.USD,
      neededBy: '',
      notes: '',
      items: [emptyItem()],
    };
  }

  return {
    title: initial.title,
    description: initial.description,
    department: initial.department ?? '',
    category: initial.category,
    priority: initial.priority,
    currency: initial.currency,
    neededBy: initial.neededBy ? initial.neededBy.slice(0, 10) : '',
    notes: initial.notes ?? '',
    items:
      initial.items.length > 0
        ? initial.items.map((item) => ({
            key: `existing-${item.id}`,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            category: item.category ?? '',
            notes: item.notes ?? '',
          }))
        : [emptyItem()],
  };
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineTotal(item: ItemDraft): number {
  const total = toNumber(item.quantity) * toNumber(item.unitPrice);
  return Number.isFinite(total) ? Math.round((total + Number.EPSILON) * 100) / 100 : 0;
}

function requestTotal(items: readonly ItemDraft[]): number {
  return (
    Math.round((items.reduce((sum, item) => sum + lineTotal(item), 0) + Number.EPSILON) * 100) / 100
  );
}

function decimalPattern(maxIntegerDigits: number): RegExp {
  return new RegExp(`^\\d{1,${maxIntegerDigits}}(\\.\\d{1,2})?$`);
}

function validate(state: RequestFormState): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!state.title.trim()) {
    errors.title = 'Enter a request title.';
  }

  if (!state.description.trim()) {
    errors.description = 'Enter the business justification for this request.';
  }

  if (!state.neededBy) {
    errors.neededBy = 'Select the date this request is required by.';
  } else {
    const requiredBy = new Date(`${state.neededBy}T00:00:00.000Z`);

    if (Number.isNaN(requiredBy.getTime())) {
      errors.neededBy = 'Enter a valid required-by date.';
    } else {
      const today = new Date();
      const startOfToday = Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
      );

      if (requiredBy.getTime() < startOfToday) {
        errors.neededBy = 'The required-by date cannot be in the past.';
      }
    }
  }

  if (state.items.length === 0) {
    errors.items = 'Add at least one line item.';
  }

  state.items.forEach((item, index) => {
    if (!item.description.trim()) {
      errors[`items.${index}.description`] = 'Enter a description for this line item.';
    }

    if (!decimalPattern(10).test(item.quantity.trim()) || toNumber(item.quantity) <= 0) {
      errors[`items.${index}.quantity`] =
        'Enter a quantity greater than zero with up to two decimals.';
    }

    if (!item.unit.trim()) {
      errors[`items.${index}.unit`] = 'Enter a unit of measure.';
    }

    if (!decimalPattern(12).test(item.unitPrice.trim()) || toNumber(item.unitPrice) <= 0) {
      errors[`items.${index}.unitPrice`] =
        'Enter a unit price greater than zero with up to two decimals.';
    }
  });

  return errors;
}

function toPayload(state: RequestFormState): CreatePurchaseRequestRequest {
  return {
    title: state.title.trim(),
    description: state.description.trim(),
    department: state.department.trim() || null,
    category: state.category,
    priority: state.priority,
    currency: state.currency,
    neededBy: state.neededBy,
    notes: state.notes.trim() || null,
    items: state.items.map((item) => ({
      description: item.description.trim(),
      quantity: item.quantity.trim(),
      unit: item.unit.trim(),
      unitPrice: item.unitPrice.trim(),
      category: item.category || null,
      notes: item.notes.trim() || null,
    })),
  };
}

export function RequestForm({ mode, initial, cancelHref, onSubmit }: RequestFormProps) {
  const titleId = useId();
  const descriptionId = useId();
  const departmentId = useId();
  const categoryId = useId();
  const priorityId = useId();
  const currencyId = useId();
  const neededById = useId();
  const notesId = useId();

  const [state, setState] = useState<RequestFormState>(() => initialState(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const total = requestTotal(state.items);

  function updateField<Key extends keyof RequestFormState>(
    key: Key,
    value: RequestFormState[Key],
  ): void {
    setState((current) => ({ ...current, [key]: value }));
  }

  function updateItem(key: string, changes: Partial<ItemDraft>): void {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    }));
  }

  function addItem(): void {
    setState((current) => ({ ...current, items: [...current.items, emptyItem()] }));
  }

  function removeItem(key: string): void {
    setState((current) => ({
      ...current,
      items:
        current.items.length > 1 ? current.items.filter((item) => item.key !== key) : current.items,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (busy) {
      return;
    }

    const clientErrors = validate(state);

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setError('Please correct the highlighted fields before saving.');
      return;
    }

    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      await onSubmit(toPayload(state));
    } catch (caught) {
      setError(messageFrom(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-clay/25 bg-[#f5e7e2] px-4 py-3 text-[11.5px] leading-5 text-[#8a4a3b]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="flex-1">{error}</p>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-beige/70 px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
            Request details
          </h2>
          <p className="mt-1 text-[11.5px] leading-5 text-stone">
            Describe the business need. Totals are calculated on the server from the line items.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <Field label="Request title" htmlFor={titleId} error={fieldErrors.title} required>
            <input
              id={titleId}
              type="text"
              value={state.title}
              onChange={(event) => updateField('title', event.target.value)}
              maxLength={180}
              placeholder="e.g. Replace end-of-life laptops for the design team"
              aria-invalid={fieldErrors.title ? true : undefined}
              className={inputClassName(fieldErrors.title)}
            />
          </Field>

          <Field
            label="Business justification"
            htmlFor={descriptionId}
            error={fieldErrors.description}
            required
          >
            <textarea
              id={descriptionId}
              value={state.description}
              onChange={(event) => updateField('description', event.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="Explain why this purchase is needed and the outcome it supports."
              aria-invalid={fieldErrors.description ? true : undefined}
              className={textareaClassName(fieldErrors.description)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department" htmlFor={departmentId} error={fieldErrors.department}>
              <input
                id={departmentId}
                type="text"
                value={state.department}
                onChange={(event) => updateField('department', event.target.value)}
                maxLength={120}
                placeholder="e.g. Operations"
                aria-invalid={fieldErrors.department ? true : undefined}
                className={inputClassName(fieldErrors.department)}
              />
            </Field>

            <Field label="Category" htmlFor={categoryId} error={fieldErrors.category} required>
              <select
                id={categoryId}
                value={state.category}
                onChange={(event) =>
                  updateField('category', event.target.value as ProcurementCategory)
                }
                className={inputClassName(fieldErrors.category)}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priority" htmlFor={priorityId} error={fieldErrors.priority} required>
              <select
                id={priorityId}
                value={state.priority}
                onChange={(event) => updateField('priority', event.target.value as Priority)}
                className={inputClassName(fieldErrors.priority)}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Currency" htmlFor={currencyId} error={fieldErrors.currency} required>
              <select
                id={currencyId}
                value={state.currency}
                onChange={(event) => updateField('currency', event.target.value as Currency)}
                className={inputClassName(fieldErrors.currency)}
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Required by"
              htmlFor={neededById}
              error={fieldErrors.neededBy}
              hint="The date this purchase should be delivered by."
              required
            >
              <input
                id={neededById}
                type="date"
                value={state.neededBy}
                min={todayIso()}
                onChange={(event) => updateField('neededBy', event.target.value)}
                aria-invalid={fieldErrors.neededBy ? true : undefined}
                className={inputClassName(fieldErrors.neededBy)}
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor={notesId} error={fieldErrors.notes}>
            <textarea
              id={notesId}
              value={state.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Optional delivery instructions or context for reviewers."
              aria-invalid={fieldErrors.notes ? true : undefined}
              className={textareaClassName(fieldErrors.notes)}
            />
          </Field>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-beige/70 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
              Line items
            </h2>
            <p className="mt-1 text-[11.5px] leading-5 text-stone">
              Add each item separately. Quantities and prices accept up to two decimal places.
            </p>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-beige bg-white px-3.5 text-[12px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6]"
          >
            <Plus size={14} aria-hidden="true" />
            Add line item
          </button>
        </div>

        {fieldErrors.items ? (
          <p className="border-b border-beige/60 px-5 py-3 text-[10px] leading-4 text-clay sm:px-6">
            {fieldErrors.items}
          </p>
        ) : null}

        <div className="divide-y divide-beige/60">
          {state.items.map((item, index) => {
            const prefix = `items.${index}`;

            return (
              <div key={item.key} className="px-5 py-4 sm:px-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-taupe">
                    Item {index + 1}
                  </p>
                  <div className="flex items-center gap-3">
                    <p className="text-[11px] text-stone">
                      Line total{' '}
                      <span className="font-semibold text-espresso">
                        {formatAmount(lineTotal(item), state.currency)}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      disabled={state.items.length === 1}
                      aria-label={`Remove line item ${index + 1}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-clay transition-colors hover:bg-[#f5e7e2] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-12">
                    <Field
                      label="Description"
                      htmlFor={`${item.key}-description`}
                      error={fieldErrors[`${prefix}.description`]}
                      required
                    >
                      <input
                        id={`${item.key}-description`}
                        type="text"
                        value={item.description}
                        onChange={(event) =>
                          updateItem(item.key, { description: event.target.value })
                        }
                        maxLength={300}
                        placeholder="e.g. Ergonomic task chair, black frame"
                        aria-invalid={fieldErrors[`${prefix}.description`] ? true : undefined}
                        className={inputClassName(fieldErrors[`${prefix}.description`])}
                      />
                    </Field>
                  </div>

                  <div className="sm:col-span-3">
                    <Field
                      label="Quantity"
                      htmlFor={`${item.key}-quantity`}
                      error={fieldErrors[`${prefix}.quantity`]}
                      required
                    >
                      <input
                        id={`${item.key}-quantity`}
                        type="text"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(event) => updateItem(item.key, { quantity: event.target.value })}
                        aria-invalid={fieldErrors[`${prefix}.quantity`] ? true : undefined}
                        className={inputClassName(fieldErrors[`${prefix}.quantity`])}
                      />
                    </Field>
                  </div>

                  <div className="sm:col-span-3">
                    <Field
                      label="Unit"
                      htmlFor={`${item.key}-unit`}
                      error={fieldErrors[`${prefix}.unit`]}
                      required
                    >
                      <input
                        id={`${item.key}-unit`}
                        type="text"
                        value={item.unit}
                        onChange={(event) => updateItem(item.key, { unit: event.target.value })}
                        maxLength={40}
                        placeholder="unit"
                        aria-invalid={fieldErrors[`${prefix}.unit`] ? true : undefined}
                        className={inputClassName(fieldErrors[`${prefix}.unit`])}
                      />
                    </Field>
                  </div>

                  <div className="sm:col-span-3">
                    <Field
                      label="Unit price"
                      htmlFor={`${item.key}-unit-price`}
                      error={fieldErrors[`${prefix}.unitPrice`]}
                      required
                    >
                      <input
                        id={`${item.key}-unit-price`}
                        type="text"
                        inputMode="decimal"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(item.key, { unitPrice: event.target.value })
                        }
                        placeholder="0.00"
                        aria-invalid={fieldErrors[`${prefix}.unitPrice`] ? true : undefined}
                        className={inputClassName(fieldErrors[`${prefix}.unitPrice`])}
                      />
                    </Field>
                  </div>

                  <div className="sm:col-span-3">
                    <Field
                      label="Item category"
                      htmlFor={`${item.key}-category`}
                      error={fieldErrors[`${prefix}.category`]}
                    >
                      <select
                        id={`${item.key}-category`}
                        value={item.category}
                        onChange={(event) =>
                          updateItem(item.key, {
                            category: event.target.value as ProcurementCategory | '',
                          })
                        }
                        className={inputClassName(fieldErrors[`${prefix}.category`])}
                      >
                        <option value="">Use request category</option>
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="sm:col-span-12">
                    <Field
                      label="Item notes"
                      htmlFor={`${item.key}-notes`}
                      error={fieldErrors[`${prefix}.notes`]}
                    >
                      <input
                        id={`${item.key}-notes`}
                        type="text"
                        value={item.notes}
                        onChange={(event) => updateItem(item.key, { notes: event.target.value })}
                        maxLength={2000}
                        placeholder="Optional specification or delivery note"
                        aria-invalid={fieldErrors[`${prefix}.notes`] ? true : undefined}
                        className={inputClassName(fieldErrors[`${prefix}.notes`])}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-beige/70 bg-ivory/30 px-5 py-4 sm:px-6">
          <p className="text-[11px] text-stone">
            {state.items.length} {state.items.length === 1 ? 'line item' : 'line items'}
          </p>
          <p className="text-[13px] text-stone">
            Request total{' '}
            <span className="ml-1 text-[17px] font-semibold tracking-[-0.02em] text-espresso">
              {formatAmount(total, state.currency)}
            </span>
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          to={cancelHref}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-beige bg-white px-4 text-[13px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-[#fbf9f6]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-espresso px-4 text-[13px] font-medium text-ivory shadow-[0_1px_2px_rgba(56,44,39,0.18)] transition-colors hover:bg-espresso-light disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={15} aria-hidden="true" />
          )}
          {mode === 'create' ? 'Create draft' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function inputClassName(error?: string): string {
  return `h-10 w-full rounded-xl border bg-white px-3 text-[12.5px] text-espresso outline-none transition-colors placeholder:text-taupe/70 focus:ring-2 ${
    error
      ? 'border-clay/60 focus:border-clay focus:ring-clay/15'
      : 'border-beige hover:border-taupe/50 focus:border-taupe focus:ring-taupe/15'
  }`;
}

function textareaClassName(error?: string): string {
  return `w-full rounded-xl border bg-white px-3 py-2.5 text-[12.5px] leading-6 text-espresso outline-none transition-colors placeholder:text-taupe/70 focus:ring-2 ${
    error
      ? 'border-clay/60 focus:border-clay focus:ring-clay/15'
      : 'border-beige hover:border-taupe/50 focus:border-taupe focus:ring-taupe/15'
  }`;
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

function Field({ label, htmlFor, error, hint, required = false, children }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone"
      >
        {label}
        {required ? <span className="ml-1 text-clay">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[10px] leading-4 text-clay">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[10px] leading-4 text-taupe">{hint}</p>
      ) : null}
    </div>
  );
}

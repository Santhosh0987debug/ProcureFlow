import { ArrowRight, Building2, Loader2, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthErrorBanner } from '../components/auth/AuthErrorBanner';
import { AuthField } from '../components/auth/AuthField';
import { AuthLayout } from '../components/auth/AuthLayout';
import { PasswordToggle } from '../components/auth/PasswordToggle';
import { fieldErrorsFrom, messageFrom } from '../lib/api-errors';
import { validateRegistration } from '../lib/auth-validation';
import type { RegisterValues } from '../lib/auth-validation';

interface RegisterLocationState {
  from?: {
    pathname: string;
    search?: string;
    hash?: string;
  };
}

function redirectTarget(state: RegisterLocationState | null): string {
  const from = state?.from;

  if (!from) {
    return '/';
  }

  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

const initialValues: RegisterValues = {
  firstName: '',
  lastName: '',
  email: '',
  workspaceName: '',
  password: '',
  confirmPassword: '',
};

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState<RegisterValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const target = redirectTarget(location.state as RegisterLocationState | null);

  function updateField(field: keyof RegisterValues, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const nextErrors = validateRegistration(values);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      await register({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        password: values.password,
        ...(values.workspaceName.trim() ? { workspaceName: values.workspaceName.trim() } : {}),
      });
      navigate(target, { replace: true });
    } catch (error) {
      const serverErrors = fieldErrorsFrom(error);
      const { form, ...fieldErrors } = serverErrors;
      setErrors(fieldErrors);
      setFormError(form ?? messageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-taupe">
          Start with ProcureFlow
        </p>
        <h1 className="mt-2.5 text-[30px] font-semibold tracking-[-0.035em] text-espresso">
          Create your workspace
        </h1>
        <p className="mt-2 text-[12.5px] leading-5 text-stone">
          Set up a private procurement workspace for your team.
        </p>
      </div>

      <AuthErrorBanner message={formError} />

      <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthField
              id="register-first-name"
              label="First name"
              icon={UserRound}
              type="text"
              name="firstName"
              value={values.firstName}
              onChange={(event) => updateField('firstName', event.target.value)}
              error={errors.firstName}
              autoComplete="given-name"
              placeholder="Amara"
              autoFocus
            />
            <AuthField
              id="register-last-name"
              label="Last name"
              icon={UserRound}
              type="text"
              name="lastName"
              value={values.lastName}
              onChange={(event) => updateField('lastName', event.target.value)}
              error={errors.lastName}
              autoComplete="family-name"
              placeholder="Okafor"
            />
          </div>

          <AuthField
            id="register-email"
            label="Work email"
            icon={Mail}
            type="email"
            name="email"
            value={values.email}
            onChange={(event) => updateField('email', event.target.value)}
            error={errors.email}
            autoComplete="email"
            placeholder="you@company.com"
          />

          <AuthField
            id="register-workspace"
            label="Workspace name"
            icon={Building2}
            type="text"
            name="workspaceName"
            value={values.workspaceName}
            onChange={(event) => updateField('workspaceName', event.target.value)}
            error={errors.workspaceName}
            hint="Optional. You can invite your team later."
            autoComplete="organization"
            placeholder="Northwind Industrial"
          />

          <AuthField
            id="register-password"
            label="Password"
            icon={Lock}
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={values.password}
            onChange={(event) => updateField('password', event.target.value)}
            error={errors.password}
            hint="At least 8 characters, including a letter and a number."
            autoComplete="new-password"
            placeholder="Create a password"
            trailing={
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((visible) => !visible)}
              />
            }
          />

          <AuthField
            id="register-confirm-password"
            label="Confirm password"
            icon={Lock}
            type={showConfirmPassword ? 'text' : 'password'}
            name="confirmPassword"
            value={values.confirmPassword}
            onChange={(event) => updateField('confirmPassword', event.target.value)}
            error={errors.confirmPassword}
            autoComplete="new-password"
            placeholder="Repeat your password"
            trailing={
              <PasswordToggle
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((visible) => !visible)}
              />
            }
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="group mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-espresso text-[12.5px] font-medium text-ivory shadow-[0_1px_2px_rgba(56,44,39,0.18)] transition-colors duration-150 hover:bg-espresso-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 size={15} strokeWidth={2} className="animate-spin" aria-hidden="true" />
              Creating workspace…
            </>
          ) : (
            <>
              Create workspace
              <ArrowRight
                size={15}
                strokeWidth={1.8}
                className="transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-[11px] text-stone">
        Already have an account?{' '}
        <Link
          to="/login"
          state={location.state}
          className="font-medium text-espresso underline-offset-4 transition-colors hover:text-espresso-light hover:underline"
        >
          Sign in
        </Link>
      </p>

      <div className="mt-7 flex items-center justify-center gap-1.5 text-[8.5px] font-medium uppercase tracking-[0.14em] text-taupe">
        <ShieldCheck size={12} strokeWidth={1.8} aria-hidden="true" />
        Private workspace · Secure session cookies
      </div>
    </AuthLayout>
  );
}

import { ArrowRight, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthErrorBanner } from '../components/auth/AuthErrorBanner';
import { AuthField } from '../components/auth/AuthField';
import { AuthLayout } from '../components/auth/AuthLayout';
import { PasswordToggle } from '../components/auth/PasswordToggle';
import { fieldErrorsFrom, messageFrom } from '../lib/api-errors';
import { validateLogin } from '../lib/auth-validation';
import type { LoginValues } from '../lib/auth-validation';

interface LoginLocationState {
  from?: {
    pathname: string;
    search?: string;
    hash?: string;
  };
}

function redirectTarget(state: LoginLocationState | null): string {
  const from = state?.from;

  if (!from) {
    return '/';
  }

  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const target = redirectTarget(location.state as LoginLocationState | null);

  function updateField(field: keyof LoginValues, value: string): void {
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

    const nextErrors = validateLogin(values);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      await login({ email: values.email.trim(), password: values.password });
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
          Secure workspace access
        </p>
        <h1 className="mt-2.5 text-[30px] font-semibold tracking-[-0.035em] text-espresso">
          Welcome back
        </h1>
        <p className="mt-2 text-[12.5px] leading-5 text-stone">
          Sign in to continue to your procurement workspace.
        </p>
      </div>

      <AuthErrorBanner message={formError} />

      <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        <div className="space-y-4">
          <AuthField
            id="login-email"
            label="Work email"
            icon={Mail}
            type="email"
            name="email"
            value={values.email}
            onChange={(event) => updateField('email', event.target.value)}
            error={errors.email}
            autoComplete="email"
            placeholder="you@company.com"
            autoFocus
          />

          <AuthField
            id="login-password"
            label="Password"
            icon={Lock}
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={values.password}
            onChange={(event) => updateField('password', event.target.value)}
            error={errors.password}
            autoComplete="current-password"
            placeholder="Enter your password"
            trailing={
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((visible) => !visible)}
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
              Signing in…
            </>
          ) : (
            <>
              Sign in
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
        New to ProcureFlow?{' '}
        <Link
          to="/register"
          state={location.state}
          className="font-medium text-espresso underline-offset-4 transition-colors hover:text-espresso-light hover:underline"
        >
          Create your workspace
        </Link>
      </p>

      {import.meta.env.DEV ? (
        <div className="mt-8 flex items-center justify-between gap-3 rounded-xl border border-beige bg-white px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-taupe">
              Development seed
            </p>
            <p className="mt-1 truncate text-[10px] text-stone">amara.okafor@northwind.example</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setValues({ email: 'amara.okafor@northwind.example', password: 'ProcureFlow!2026' });
              setErrors({});
              setFormError('');
            }}
            className="shrink-0 rounded-lg border border-beige px-2.5 py-1.5 text-[9.5px] font-medium text-espresso transition-colors hover:border-taupe/60 hover:bg-ivory"
          >
            Use demo
          </button>
        </div>
      ) : null}

      <div className="mt-7 flex items-center justify-center gap-1.5 text-[8.5px] font-medium uppercase tracking-[0.14em] text-taupe">
        <ShieldCheck size={12} strokeWidth={1.8} aria-hidden="true" />
        Protected by secure session cookies
      </div>
    </AuthLayout>
  );
}

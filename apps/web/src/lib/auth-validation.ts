import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@procureflow/shared';

export interface LoginValues {
  email: string;
  password: string;
}

export interface RegisterValues {
  firstName: string;
  lastName: string;
  email: string;
  workspaceName: string;
  password: string;
  confirmPassword: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(values: LoginValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.email.trim()) {
    errors.email = 'Enter your email address.';
  } else if (!emailPattern.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Enter your password.';
  }

  return errors;
}

export function validateRegistration(values: RegisterValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.firstName.trim()) {
    errors.firstName = 'Enter your first name.';
  }

  if (!values.lastName.trim()) {
    errors.lastName = 'Enter your last name.';
  }

  if (!values.email.trim()) {
    errors.email = 'Enter your work email.';
  } else if (!emailPattern.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (values.workspaceName.trim() && values.workspaceName.trim().length < 2) {
    errors.workspaceName = 'Use at least 2 characters or leave this blank.';
  }

  if (!values.password) {
    errors.password = 'Create a password.';
  } else if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (values.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  } else if (!/[A-Za-z]/.test(values.password)) {
    errors.password = 'Include at least one letter.';
  } else if (!/[0-9]/.test(values.password)) {
    errors.password = 'Include at least one number.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

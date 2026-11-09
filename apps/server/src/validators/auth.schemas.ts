import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@procureflow/shared';
import { z } from 'zod';

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your first name.')
  .max(80, 'Names must be 80 characters or fewer.');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address.')
  .max(254, 'Email addresses must be 254 characters or fewer.')
  .email('Enter a valid email address.');

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`)
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.');

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(1, 'Enter your password.')
      .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`),
  })
  .strict();

export const registerSchema = z
  .object({
    firstName: nameSchema,
    lastName: z
      .string()
      .trim()
      .min(1, 'Enter your last name.')
      .max(80, 'Names must be 80 characters or fewer.'),
    email: emailSchema,
    password: passwordSchema,
    workspaceName: z
      .string()
      .trim()
      .min(2, 'Workspace names must be at least 2 characters.')
      .max(120, 'Workspace names must be 120 characters or fewer.')
      .optional(),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

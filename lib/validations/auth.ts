import { z } from 'zod';

/**
 * Normalizes a Ghana phone number into E.164 format.
 * Examples:
 *   "0241234567" -> "+233241234567"
 *   "241234567"  -> "+233241234567"
 *   "+233241234567" -> "+233241234567"
 *   "024 123 4567" -> "+233241234567"
 */
export function normalizeGhanaPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('233') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+233${digits.substring(1)}`;
  }
  if (digits.length === 9) {
    return `+233${digits}`;
  }
  return phone.trim();
}

export function isValidGhanaPhoneNumber(phone: string): boolean {
  const normalized = normalizeGhanaPhoneNumber(phone);
  // E.164 for Ghana is +233 followed by 9 digits
  return /^\+233[235][0-9]{8}$/.test(normalized);
}

export interface PasswordStrength {
  score: number; // 0 to 4
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  label: 'Very Weak' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong';
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (password.length >= 8) score++;
  if (hasMinLength) score++;
  if (hasUppercase && hasLowercase) score++;
  if (hasNumber && hasSpecial) score++;

  let label: PasswordStrength['label'] = 'Very Weak';
  if (score === 1) label = 'Weak';
  else if (score === 2) label = 'Medium';
  else if (score === 3) label = 'Strong';
  else if (score === 4) label = 'Very Strong';

  return {
    score,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    label,
  };
}

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter your full legal name (at least 2 characters)')
    .max(100, 'Full name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Full name can only contain letters, spaces, hyphens, and apostrophes'),

  phoneNumber: z
    .string()
    .trim()
    .refine((val) => isValidGhanaPhoneNumber(val), {
      message: 'Please enter a valid Ghana phone number (e.g. 024 123 4567 or +233 24 123 4567)',
    })
    .transform((val) => normalizeGhanaPhoneNumber(val)),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),

  password: z
    .string()
    .min(12, 'Password must be at least 12 characters long')
    .refine((val) => /[A-Z]/.test(val), { message: 'Must include at least one uppercase letter' })
    .refine((val) => /[a-z]/.test(val), { message: 'Must include at least one lowercase letter' })
    .refine((val) => /[0-9]/.test(val), { message: 'Must include at least one number' })
    .refine((val) => /[^A-Za-z0-9]/.test(val), { message: 'Must include at least one special character' }),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Please enter your password'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters long')
      .refine((val) => /[A-Z]/.test(val), { message: 'Must include at least one uppercase letter' })
      .refine((val) => /[a-z]/.test(val), { message: 'Must include at least one lowercase letter' })
      .refine((val) => /[0-9]/.test(val), { message: 'Must include at least one number' })
      .refine((val) => /[^A-Za-z0-9]/.test(val), { message: 'Must include at least one special character' }),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

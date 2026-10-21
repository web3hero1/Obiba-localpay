import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGhanaPhoneNumber,
  isValidGhanaPhoneNumber,
  evaluatePasswordStrength,
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../.test_dist/auth.mjs';

test('Ghana Phone Number Normalization', async (t) => {
  await t.test('normalizes standard local 10-digit number with leading 0', () => {
    assert.equal(normalizeGhanaPhoneNumber('0241234567'), '+233241234567');
  });

  await t.test('normalizes local number with spaces and dashes', () => {
    assert.equal(normalizeGhanaPhoneNumber('024 123 4567'), '+233241234567');
    assert.equal(normalizeGhanaPhoneNumber('050-987-6543'), '+233509876543');
  });

  await t.test('normalizes 9-digit number without leading 0', () => {
    assert.equal(normalizeGhanaPhoneNumber('241234567'), '+233241234567');
  });

  await t.test('normalizes already E.164 formatted number', () => {
    assert.equal(normalizeGhanaPhoneNumber('+233241234567'), '+233241234567');
  });
});

test('Ghana Phone Number Validation', async (t) => {
  await t.test('accepts valid MTN Ghana numbers', () => {
    assert.equal(isValidGhanaPhoneNumber('0241234567'), true);
    assert.equal(isValidGhanaPhoneNumber('0541234567'), true);
    assert.equal(isValidGhanaPhoneNumber('0551234567'), true);
    assert.equal(isValidGhanaPhoneNumber('0591234567'), true);
  });

  await t.test('accepts valid Telecel/Vodafone Ghana numbers', () => {
    assert.equal(isValidGhanaPhoneNumber('0201234567'), true);
    assert.equal(isValidGhanaPhoneNumber('0501234567'), true);
  });

  await t.test('accepts valid AT/AirtelTigo Ghana numbers', () => {
    assert.equal(isValidGhanaPhoneNumber('0271234567'), true);
    assert.equal(isValidGhanaPhoneNumber('0571234567'), true);
    assert.equal(isValidGhanaPhoneNumber('0261234567'), true);
  });

  await t.test('rejects numbers from other countries or invalid lengths', () => {
    assert.equal(isValidGhanaPhoneNumber('12345'), false);
    assert.equal(isValidGhanaPhoneNumber('+14155552671'), false);
    assert.equal(isValidGhanaPhoneNumber('0123456789'), false);
  });
});

test('Password Strength Evaluation', async (t) => {
  await t.test('evaluates weak short password', () => {
    const strength = evaluatePasswordStrength('short');
    assert.equal(strength.hasMinLength, false);
    assert.equal(strength.score <= 1, true);
  });

  await t.test('evaluates compliant fintech strong password (>= 12 chars with all classes)', () => {
    const strength = evaluatePasswordStrength('ObibaAccra2026!');
    assert.equal(strength.hasMinLength, true);
    assert.equal(strength.hasUppercase, true);
    assert.equal(strength.hasLowercase, true);
    assert.equal(strength.hasNumber, true);
    assert.equal(strength.hasSpecial, true);
    assert.equal(strength.score, 4);
    assert.equal(strength.label, 'Very Strong');
  });
});

test('Signup Form Zod Validation', async (t) => {
  await t.test('accepts valid customer registration data and normalizes phone', () => {
    const validData = {
      fullName: 'Kwame Mensah',
      phoneNumber: '024 123 4567',
      email: 'kwame.mensah@example.com',
      password: 'SecurePassword2026!',
    };

    const res = signupSchema.safeParse(validData);
    assert.equal(res.success, true);
    if (res.success) {
      assert.equal(res.data.fullName, 'Kwame Mensah');
      assert.equal(res.data.phoneNumber, '+233241234567');
      assert.equal(res.data.email, 'kwame.mensah@example.com');
    }
  });

  await t.test('rejects short passwords (< 12 chars)', () => {
    const res = signupSchema.safeParse({
      fullName: 'Kwame Mensah',
      phoneNumber: '0241234567',
      email: 'kwame@example.com',
      password: 'Short1!',
    });
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error.issues[0].message, /12 characters/);
    }
  });

  await t.test('rejects invalid email addresses', () => {
    const res = signupSchema.safeParse({
      fullName: 'Kwame Mensah',
      phoneNumber: '0241234567',
      email: 'not-an-email',
      password: 'SecurePassword2026!',
    });
    assert.equal(res.success, false);
  });

  await t.test('rejects invalid phone numbers', () => {
    const res = signupSchema.safeParse({
      fullName: 'Kwame Mensah',
      phoneNumber: '999999',
      email: 'kwame@example.com',
      password: 'SecurePassword2026!',
    });
    assert.equal(res.success, false);
  });
});

test('Login & Recovery Validation', async (t) => {
  await t.test('accepts valid login credentials', () => {
    const res = loginSchema.safeParse({
      email: 'test@obiba.com',
      password: 'Password123!',
    });
    assert.equal(res.success, true);
  });

  await t.test('rejects empty login password', () => {
    const res = loginSchema.safeParse({
      email: 'test@obiba.com',
      password: '',
    });
    assert.equal(res.success, false);
  });

  await t.test('forgotPasswordSchema validates email', () => {
    assert.equal(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success, true);
    assert.equal(forgotPasswordSchema.safeParse({ email: 'invalid-email' }).success, false);
  });

  await t.test('resetPasswordSchema enforces matching passwords', () => {
    const valid = resetPasswordSchema.safeParse({
      password: 'NewStrongPassword2026!',
      confirmPassword: 'NewStrongPassword2026!',
    });
    assert.equal(valid.success, true);

    const mismatch = resetPasswordSchema.safeParse({
      password: 'NewStrongPassword2026!',
      confirmPassword: 'DifferentPassword2026!',
    });
    assert.equal(mismatch.success, false);
  });
});

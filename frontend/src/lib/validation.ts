/**
 * VALIDATION UTILITIES - FORM INPUT VALIDATION
 *
 * Why: Centralized validation logic ensures consistent validation rules across all forms.
 * This prevents bugs where different forms validate the same field differently and makes
 * it easy to update validation rules globally.
 *
 * System Flow: Form component → Calls validation function → Returns error message or null
 * → Form displays error to user → User corrects input → Validation passes → Form submits.
 *
 * Senior Principle: Fail-fast validation. Validate on the client before sending to backend
 * to provide immediate feedback and reduce unnecessary API calls.
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * EMAIL VALIDATION
 * Validates email format using RFC 5322 simplified regex
 */
export const validateEmail = (email: string): string | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return 'Email is required';
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return null;
};

/**
 * PASSWORD VALIDATION
 * Ensures password meets security requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const validatePassword = (password: string): string | null => {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password))
    return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password))
    return 'Password must contain at least one lowercase letter';
  if (!/\d/.test(password)) return 'Password must contain at least one number';
  if (!/[!@#$%^&*]/.test(password))
    return 'Password must contain at least one special character (!@#$%^&*)';
  return null;
};

/**
 * PASSWORD CONFIRMATION VALIDATION
 * Ensures password and confirmation match
 */
export const validatePasswordConfirmation = (
  password: string,
  confirmation: string
): string | null => {
  if (!confirmation) return 'Please confirm your password';
  if (password !== confirmation) return 'Passwords do not match';
  return null;
};

/**
 * ROLE VALIDATION
 * Ensures role is one of the allowed values
 */
export const validateRole = (role: string): string | null => {
  if (!role) return 'Please select a role';
  if (!['candidate', 'hr'].includes(role)) return 'Invalid role selected';
  return null;
};

/**
 * LOGIN FORM VALIDATION
 * Validates all login form fields
 */
export const validateLoginForm = (
  email: string,
  password: string
): ValidationError[] => {
  const errors: ValidationError[] = [];

  const emailError = validateEmail(email);
  if (emailError) errors.push({ field: 'email', message: emailError });

  if (!password) errors.push({ field: 'password', message: 'Password is required' });

  return errors;
};

/**
 * REGISTRATION FORM VALIDATION
 * Validates all registration form fields
 */
export const validateRegistrationForm = (
  email: string,
  password: string,
  confirmPassword: string,
  role: string
): ValidationError[] => {
  const errors: ValidationError[] = [];

  const emailError = validateEmail(email);
  if (emailError) errors.push({ field: 'email', message: emailError });

  const passwordError = validatePassword(password);
  if (passwordError) errors.push({ field: 'password', message: passwordError });

  const confirmError = validatePasswordConfirmation(password, confirmPassword);
  if (confirmError)
    errors.push({ field: 'confirmPassword', message: confirmError });

  const roleError = validateRole(role);
  if (roleError) errors.push({ field: 'role', message: roleError });

  return errors;
};

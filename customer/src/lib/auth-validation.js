const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizePhone = (value = '') => {
  const trimmed = value.trim();
  const hasPlusPrefix = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '').slice(0, 15);

  if (!digitsOnly) return '';
  return hasPlusPrefix ? `+${digitsOnly}` : digitsOnly;
};

export const isValidPhone = (phone = '') => {
  const normalized = normalizePhone(phone);
  const digitsCount = normalized.replace(/\D/g, '').length;
  return digitsCount >= 10 && digitsCount <= 15;
};

export const normalizeEmail = (value = '') => value.trim().toLowerCase();

export const isValidEmail = (email = '') => EMAIL_REGEX.test(normalizeEmail(email));

export const getPasswordStrengthErrors = (password = '') => {
  const errors = [];

  if (password.length < 8) errors.push('Password must be at least 8 characters long.');
  if (!/[a-z]/.test(password)) errors.push('Password must include at least one lowercase letter.');
  if (!/[A-Z]/.test(password)) errors.push('Password must include at least one uppercase letter.');
  if (!/\d/.test(password)) errors.push('Password must include at least one number.');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must include at least one special character.');

  return errors;
};

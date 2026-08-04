export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PasswordRequirement {
  key: string;
  label: string;
  test: (val: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { key: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { key: "uppercase", label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { key: "lowercase", label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { key: "number", label: "A number", test: (v) => /\d/.test(v) },
  { key: "special", label: "A special character", test: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];

export function validateEmail(val: string): string {
  if (!val) return "Email is required";
  if (!EMAIL_REGEX.test(val)) return "Please enter a valid email address";
  return "";
}

export function validatePassword(val: string): string {
  if (!val) return "Password is required";
  if (val.length < 8) return "Password must be at least 8 characters";
  const missing = PASSWORD_REQUIREMENTS.filter((r) => r.key !== "length" && !r.test(val));
  if (missing.length > 0) {
    return "Include at least one uppercase, one lowercase, one number, and one special character";
  }
  return "";
}

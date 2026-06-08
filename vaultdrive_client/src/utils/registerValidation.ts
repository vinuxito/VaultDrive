export interface RegisterInput {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password: string;
}

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 64;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister(data: RegisterInput): string | null {
  if (!data.first_name.trim()) return "First name is required";
  if (!data.last_name.trim()) return "Last name is required";
  if (!data.username.trim()) return "Username is required";
  const email = data.email.trim();
  if (!email) return "Email is required";
  if (!EMAIL_RE.test(email)) return "Email is not valid";
  if (data.password.length < MIN_PASSWORD)
    return `Password must be at least ${MIN_PASSWORD} characters`;
  if (data.password.length > MAX_PASSWORD)
    return `Password must be ${MAX_PASSWORD} characters or fewer`;
  return null;
}

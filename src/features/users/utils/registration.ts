export interface RegistrationInput {
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// Python str.strip() includes C0 separators/NEL, but does not strip U+FEFF.
// Strip before NFKC, matching Django's registration service exactly.
const pythonWhitespace = /^[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g;

export function normalizeRegistrationUsername(username: string): string {
  return username.replace(pythonWhitespace, "").normalize("NFKC");
}

export function validateRegistration(input: RegistrationInput) {
  const username = normalizeRegistrationUsername(input.username);
  const errors: Record<string, string> = {};
  if (!username) errors.username = "Username is required.";
  for (const [field, label, value] of [
    ["username", "Username", username],
    ["first_name", "First name", input.firstName ?? ""],
    ["last_name", "Last name", input.lastName ?? ""],
  ]) {
    if (Array.from(value).length > 50) errors[field] = `${label} must be at most 50 characters.`;
  }
  const passwordLength = Array.from(input.password).length;
  if (passwordLength < 8 || passwordLength > 25) errors.password = "Password must be between 8 and 25 characters.";
  return { username, errors };
}

/**
 * Error codes passed back to the sign-in / sign-up pages in the URL.
 * Only known codes are rendered, so the URL can't inject arbitrary text.
 */
export const AUTH_ERRORS = {
  invalid: "That email and password don't match.",
  email: "Enter a valid email address.",
  password_missing: "Enter your password.",
  name: "Tell us what to call you.",
  password_short: "Use a password of at least 8 characters.",
  exists: "An account with this email already exists. Try signing in.",
  origin: "That request came from another site, so it was blocked. Please try again here.",
  server: "Something went wrong on our side. Please try again.",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERRORS;

export function authErrorMessage(code: string | undefined): string | null {
  return code && code in AUTH_ERRORS ? AUTH_ERRORS[code as AuthErrorCode] : null;
}

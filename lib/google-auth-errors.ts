export const GOOGLE_ERRORS = {
  google_not_configured: "Google sign-in is not configured yet. Please contact the app administrator.",
  google_cancelled: "Google sign-in was cancelled. You can try again.",
  google_invalid_state: "Your Google sign-in request expired or is invalid. Please try again.",
  google_account_exists: "This email already has an account. Please sign in with your email and password.",
  google_failed: "Unable to sign in with Google. Please try again.",
};

export type GoogleErrorCode = keyof typeof GOOGLE_ERRORS;

// Marks the code our builds ship (./vite.ts), so the browser can tell an error
// in our code from one in code that isn't ours: an extension, Stripe.js,
// Google's sign-in (./index.ts)
export const APPLICATION_KEY = "empire-cleaning";

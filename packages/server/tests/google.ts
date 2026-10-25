import { vi } from "vitest";
import { apiAgent } from "./harness.ts";

// signs in through the real Google flow on our side; only Google's servers are
// stood in for. Returns the agent and the callback's response.
export const signInWithGoogle = async (profile: {
  sub: string;
  email: string;
  picture?: string;
}) => {
  const agent = apiAgent();
  const start = await agent
    .post("/api/auth/sign-in/social")
    .send({ provider: "google", callbackURL: "/" })
    .expect(200);
  const state = new URL(start.body.url).searchParams.get("state");

  // what Google returns for the authorisation code: tokens, including an ID
  // token carrying the person's Google profile
  const now = Math.floor(Date.now() / 1000);
  const encode = (part: object) =>
    Buffer.from(JSON.stringify(part)).toString("base64url");
  const idToken = [
    encode({ alg: "none", typ: "JWT" }),
    encode({
      iss: "https://accounts.google.com",
      aud: "test-google-client-id",
      sub: profile.sub,
      email: profile.email,
      email_verified: true,
      name: "Casey from Google",
      picture: profile.picture,
      iat: now,
      exp: now + 3600,
    }),
    "",
  ].join(".");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return Response.json({
        access_token: "google-access-token",
        id_token: idToken,
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid email profile",
      });
    }
    throw new Error(`unexpected request to ${url}`);
  });

  const callback = await agent.get(
    `/api/auth/callback/google?code=google-code&state=${state}`,
  );
  vi.mocked(globalThis.fetch).mockRestore();
  return { agent, callback };
};

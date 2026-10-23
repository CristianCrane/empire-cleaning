import type { RequestHandler, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { AccountRole, SignedInAccount } from "@empire-cleaning/models";
import { ForbiddenError, UnauthorizedError } from "../../middleware/errors.ts";
import { auth } from "./auth.ts";
import { accessFor } from "./connections.ts";

/**
 * Declares who may call an endpoint. With no roles, any signed-in Account may
 * (even one connected to nothing); with roles, the Account must hold at least
 * one of them through its connections (ADR-0006). Endpoints open to Guests
 * simply don't use this.
 *
 *   router.get("/", authorize("office_staff"), handler)
 */
export const authorize =
  (...roles: AccountRole[]): RequestHandler =>
  async (req, res, next) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      throw new UnauthorizedError();
    }

    const { roles: held, name } = await accessFor(session.user);
    const account: SignedInAccount = {
      id: session.user.id,
      email: session.user.email,
      name,
      roles: held,
    };
    if (roles.length > 0 && !held.some((r) => roles.includes(r))) {
      throw new ForbiddenError();
    }

    res.locals.account = account;
    next();
  };

// the Account set by authorize(); only call from handlers behind it
export const signedInAccount = (res: Response): SignedInAccount => {
  const account = res.locals.account as SignedInAccount | undefined;
  if (!account) {
    throw new Error("signedInAccount() used on a route without authorize()");
  }
  return account;
};

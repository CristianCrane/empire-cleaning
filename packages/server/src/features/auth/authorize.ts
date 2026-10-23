import type { RequestHandler, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { AccountRole } from "@empire-cleaning/models";
import { ForbiddenError, UnauthorizedError } from "../../middleware/errors.ts";
import { auth } from "./auth.ts";

export type SignedInAccount = {
  id: string;
  email: string;
  name: string;
  roles: AccountRole[];
};

/**
 * Declares who may call an endpoint. With no roles, any signed-in Account may;
 * with roles, the Account must hold at least one of them. Endpoints open to
 * Guests simply don't use this.
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

    const account: SignedInAccount = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      roles: (session.user.roles ?? []) as AccountRole[],
    };
    if (roles.length > 0 && !account.roles.some((r) => roles.includes(r))) {
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

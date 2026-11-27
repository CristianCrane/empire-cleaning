# Screens

The web app's screens (`packages/web`), not the landing site's. Paths come from `packages/web/src/router.tsx`, the one source of them.

| Area          | Who                             | Where                                                    |
| ------------- | ------------------------------- | -------------------------------------------------------- |
| Office        | Office Staff                    | `/office/…`                                              |
| Client portal | Clients                         | `/portal/…`                                              |
| Cleaner area  | Cleaners                        | `/cleaner/…`                                             |
| Signed in     | an Account connected to nothing | `/welcome`                                               |
| Signed out    | anyone                          | `/sign-in`, `/sign-in/link`, `/confirm-email`, `/people` |

How sign-in and the areas' guards behave: `packages/web/README.md`, Areas and sign-in. Not found renders inside its area (after the area's sign-in check) when the path is in one; Not found and Something went wrong have no path. `/prototype/<screen>` is Not found on main's build.

## Sign in

`/sign-in?error=&next=` (`screens/SignIn.tsx`), Message page: sign in by emailed link or Google, `?error=` saying why a link failed, `?next=` the page after. Keeps: Google first (#168).

## Message pages

Message page, in `screens/`: the emailed link's page (`SignInLink.tsx`, `/sign-in/link`); confirming a new email (`ConfirmEmail.tsx`, `/confirm-email`), in three states; Not found (`NotFound.tsx`); Something went wrong (`PageError.tsx`). Keeps: home a link (#168); one Button that does it (#254): Sign in, Try again.

## Welcome

`/welcome` (`screens/Welcome.tsx`), Form page: an Account connected to nothing requests a Quote to become a Client. Keeps: steps (#168); what's next said once, in the line under the title (#493 G5.3); one who asked for a quote with another email is told to sign out and use that one.

## People

`/people?as=&next=` (`screens/PeopleScreen.tsx`), no type: on the test site only, sign in as a demo person (`?as=` a first name, `?next=` the page after) (#227).

// Shared domain types live here; see GLOSSARY.md for the vocabulary.

// what an Account may do: a Client Account is only ever "client";
// a Staff Account holds "cleaner", "office_staff" or both
export type AccountRole = "client" | "cleaner" | "office_staff";

// the signed-in caller, as GET /api/me returns it
export type SignedInAccount = {
  id: string;
  email: string;
  name: string;
  roles: AccountRole[];
};

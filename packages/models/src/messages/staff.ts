// What the server and the screens both say about a Staff member
// (docs/ux.md, Words)

// a Site Visit they have, which must go to someone else before they're
// deactivated or lose the Cleaner role; `when` as each side formats it
export const hasSiteVisit = (firstName: string, where: string, when: string) =>
  `${firstName} has a site visit at ${where} on ${when}. Give it to someone else first.`;

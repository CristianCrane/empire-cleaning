// The Deposit accepting an offer takes, as the server books it and the
// Office's page tells it: the offer's own, and none when it only changes the
// Client's cleaning plan, as their plan's Deposit was taken when it began
// (#534 review F10)
export const depositOnAccepting = (
  depositCents: number,
  changesPlan: boolean,
): number => (changesPlan ? 0 : depositCents);

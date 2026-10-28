// The Services every install starts with, keyed the same everywhere, so the
// migrations and a fresh database agree on them (ADR-0018)
export const SEEDED = {
  standard: "5e7a1c00-0000-4000-8000-000000000001",
  deep: "5e7a1c00-0000-4000-8000-000000000002",
  moveInOut: "5e7a1c00-0000-4000-8000-000000000003",
  commercial: "5e7a1c00-0000-4000-8000-000000000004",
} as const;

// the seeded Services for homes
export const SEEDED_FOR_HOMES = [
  SEEDED.standard,
  SEEDED.deep,
  SEEDED.moveInOut,
];

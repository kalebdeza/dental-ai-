// Mirrors the practice_members_role_check constraint. Kept in a module with
// no imports so it stays loadable by the test runner, and so the role
// vocabulary has one definition rather than one per consumer.
//
// role is a text column, so the generated database types widen it to
// string; isPracticeRole is what narrows a value back to this union.

export const PRACTICE_ROLES = [
  "owner",
  "admin",
  "clinician",
  "front_desk",
  "read_only",
] as const;

export type PracticeRole = (typeof PRACTICE_ROLES)[number];

export function isPracticeRole(
  value: string | null | undefined
): value is PracticeRole {
  return (
    value !== null &&
    value !== undefined &&
    (PRACTICE_ROLES as readonly string[]).includes(value)
  );
}

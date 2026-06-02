export const SCOPES = {
  document: "document",
  session: "session",
  presence: "presence",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

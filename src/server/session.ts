import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { getDbFromContext, getEnv } from "./cf";

const COOKIE_NAME = "bb_guest";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const GUEST_COLORS = [
  "#E03131",
  "#F08C00",
  "#2F9E44",
  "#1971C2",
  "#9C36B5",
  "#0CA678",
  "#E8590C",
  "#5F3DC4",
];

export interface Guest {
  userId: string;
  displayName: string;
  color: string;
}

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return GUEST_COLORS[hash % GUEST_COLORS.length];
}

function toBase64Url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const str = atob(padded);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  const env = await getEnv();
  const secret = env.AUTH_SECRET ?? "boardboard-dev-secret";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(new Uint8Array(sig));
}

async function encodeCookie(guest: Guest): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(guest)));
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

async function decodeCookie(value: string): Promise<Guest | null> {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = await sign(payload);
  if (expected !== signature) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(payload));
    const guest = JSON.parse(json) as Guest;
    if (!guest.userId) return null;
    return guest;
  } catch {
    return null;
  }
}

/** Reads and verifies the guest cookie without creating anything. */
export async function getGuest(): Promise<Guest | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decodeCookie(raw);
}

/**
 * Returns the current guest, creating a signed cookie and a `users` row the
 * first time. No login: identity is an anonymous, generated user id.
 */
export async function getOrCreateGuest(): Promise<Guest> {
  const existing = await getGuest();
  const guest: Guest =
    existing ??
    (() => {
      const userId = crypto.randomUUID();
      return { userId, displayName: "Guest", color: colorFor(userId) };
    })();

  if (!existing) {
    const store = await cookies();
    store.set(COOKIE_NAME, await encodeCookie(guest), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  // Ensure a users row exists for foreign-key references (board_members).
  const db = await getDbFromContext();
  await db
    .insert(users)
    .values({
      id: guest.userId,
      displayName: guest.displayName,
      email: null,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();

  return guest;
}

/** Updates the guest's display name on the cookie and the `users` row. */
export async function setGuestName(name: string): Promise<Guest> {
  const current = await getOrCreateGuest();
  const displayName = name.trim().slice(0, 40) || "Guest";
  const guest: Guest = { ...current, displayName };

  const store = await cookies();
  store.set(COOKIE_NAME, await encodeCookie(guest), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  const db = await getDbFromContext();
  await db
    .update(users)
    .set({ displayName })
    .where(eq(users.id, guest.userId));

  return guest;
}

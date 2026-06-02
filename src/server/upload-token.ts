import { getEnv } from "./cf";

export interface UploadTokenPayload {
  fileId: string;
  boardId: string;
  r2Key: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  exp: number;
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

const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;

export async function createUploadToken(
  data: Omit<UploadTokenPayload, "exp">,
): Promise<string> {
  const payload: UploadTokenPayload = {
    ...data,
    exp: Date.now() + UPLOAD_TOKEN_TTL_MS,
  };
  const encoded = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await sign(encoded);
  return `${encoded}.${signature}`;
}

export async function verifyUploadToken(
  token: string,
  fileId: string,
): Promise<UploadTokenPayload | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = await sign(encoded);
  if (expected !== signature) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded));
    const payload = JSON.parse(json) as UploadTokenPayload;
    if (payload.fileId !== fileId) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type Db } from "@/db/client";

export interface CloudflareEnv {
  DB: D1Database;
  STORAGE: R2Bucket;
  BOARD: DurableObjectNamespace;
  AUTH_SECRET?: string;
}

export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as CloudflareEnv;
}

export async function getDbFromContext(): Promise<Db> {
  const env = await getEnv();
  return getDb(env.DB);
}

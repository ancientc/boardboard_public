import { NextResponse } from "next/server";
import { getOrCreateGuest, setGuestName } from "@/server/session";

export async function GET() {
  const guest = await getOrCreateGuest();
  return NextResponse.json(guest);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    displayName?: string;
  };
  const guest = await setGuestName(body.displayName ?? "");
  return NextResponse.json(guest);
}

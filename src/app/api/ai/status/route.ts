import { NextResponse } from "next/server";

import { getAiStatus } from "@/lib/ai/ai-status";

export const runtime = "nodejs";

/** Local-first probe — never returns key values, only configured flags. */
export async function GET() {
  return NextResponse.json(getAiStatus());
}

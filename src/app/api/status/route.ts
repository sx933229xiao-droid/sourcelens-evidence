import { NextResponse } from "next/server";
import { getConfigurationStatus } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  // Presence only. Never return credentials, provider URLs, or model configuration.
  return NextResponse.json(getConfigurationStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}

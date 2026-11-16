import { NextResponse } from "next/server";
import { comparisonRequestSchema } from "@/lib/comparison-schema";
import { compareSources, ComparisonError } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The request must contain valid JSON." }, { status: 400 });
  }

  const parsed = comparisonRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Add text to both sources before comparing." },
      { status: 400 },
    );
  }

  try {
    const result = await compareSources(parsed.data, request.signal);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ComparisonError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "This comparison could not be completed. Please try again." }, { status: 500 });
  }
}

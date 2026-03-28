import { NextResponse } from "next/server";

import { persistMatchReport } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await persistMatchReport(body);
  return NextResponse.json(result);
}

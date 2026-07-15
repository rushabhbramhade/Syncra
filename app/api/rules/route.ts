import { NextRequest, NextResponse } from "next/server";

const userRulesStore = new Map<string, any[]>();

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const rules = userRulesStore.get(userId) || [];
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, rules } = body;
  if (!userId || !rules) return NextResponse.json({ error: "userId and rules required" }, { status: 400 });
  userRulesStore.set(userId, rules);
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, eventId, action, previousPriority, newPriority } = body;
  if (!userId || !eventId || !action) {
    return NextResponse.json({ error: "userId, eventId, action required" }, { status: 400 });
  }
  console.log("[Feedback]", { userId, eventId, action, previousPriority, newPriority, timestamp: new Date().toISOString() });
  return NextResponse.json({ success: true });
}

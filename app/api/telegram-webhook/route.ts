import { NextRequest, NextResponse } from "next/server";
import { TelegramService } from "@/lib/telegram/telegram-service";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import { createAdminDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    const body = await request.json();
    const message = body.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const repo = new IntegrationsRepository(createAdminDb());
    const record = await repo.findByUserAndProvider(userId, "telegram");
    if (!record) {
      return NextResponse.json({ ok: true });
    }

    const token = repo.decryptToken(record.encrypted_access_token);
    if (!token) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat?.id || message.from?.id || "");
    const text = message.text || "";
    const username = message.from?.username || "";
    const firstName = message.from?.first_name || "";
    const date = new Date(message.date * 1000).toISOString();

    console.log(`[TelegramWebhook] message from ${username || firstName} (${chatId}): ${text.slice(0, 100)}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[TelegramWebhook] error:", err);
    return NextResponse.json({ ok: true });
  }
}

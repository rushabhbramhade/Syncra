import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { telegramWebhookSecret } from "@/lib/telegram/telegram-service";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import { createAdminDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    const bodyText = await request.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
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

    const expected = telegramWebhookSecret(token, userId);
    const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    ) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    const message = body.message as Record<string, unknown> | undefined;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String((message.chat as { id?: number } | undefined)?.id || (message.from as { id?: number } | undefined)?.id || "");
    const text = (message.text as string) || "";
    const username = (message.from as { username?: string } | undefined)?.username || "";
    const firstName = (message.from as { first_name?: string } | undefined)?.first_name || "";
    const date = new Date((message.date as number) * 1000).toISOString();

    console.log(`[TelegramWebhook] message from ${username || firstName} (${chatId}): ${text.slice(0, 100)}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[TelegramWebhook] error:", err);
    return NextResponse.json({ ok: true });
  }
}

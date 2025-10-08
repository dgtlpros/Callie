// app/api/voice/inbound/route.ts
import twilio from "twilio";
import { NextResponse } from "next/server";
export const runtime = "nodejs";

const xml = (x: string) =>
  new NextResponse(x, { headers: { "Content-Type": "text/xml" } });

export async function POST(req: Request) {
  const raw = await req.text();
  const p = new URLSearchParams(raw);
  const callSid = p.get("CallSid") || "";
  const wsUrl = process.env.VOICE_WS_URL!;

  const vr = new twilio.twiml.VoiceResponse();
  const connect = vr.connect();
  connect.stream({ url: `${wsUrl}?callSid=${encodeURIComponent(callSid)}` });

  return xml(vr.toString());
}

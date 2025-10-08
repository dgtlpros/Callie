// app/api/voice/inbound/route.ts
import twilio from "twilio";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
const xml = (x: string) =>
  new NextResponse(x, { headers: { "Content-Type": "text/xml" } });

export async function POST(req: Request) {
  const body = await req.text();
  const p = new URLSearchParams(body);
  const callSid = p.get("CallSid") || "";
  const vr = new twilio.twiml.VoiceResponse();
  vr.connect().stream({
    url: `${process.env.VOICE_WS_URL}?callSid=${encodeURIComponent(callSid)}`,
  });
  return xml(vr.toString());
}

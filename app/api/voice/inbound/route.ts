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
  vr.say("Connecting you now.");
  const connect = vr.connect();
  connect.stream({ url: `${wsUrl}?callSid=${encodeURIComponent(callSid)}` });

  // (optional) keep full-call recording so your transcription webhook still fires
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
    client
      .calls(callSid)
      .recordings.create({
        recordingStatusCallback: `${process.env.NEXT_PUBLIC_BASE_URL}/api/voice/recording`,
        recordingStatusCallbackEvent: ["completed"],
      })
      .catch(() => {});
  } catch {}

  return xml(vr.toString());
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/voice/inbound/route.ts
import twilio from "twilio";
import { NextResponse } from "next/server";

// Force Node runtime (Twilio SDK needs Node, not Edge)
export const runtime = "nodejs";

function xml(body: string) {
  return new NextResponse(body, { headers: { "Content-Type": "text/xml" } });
}

export async function GET() {
  return new NextResponse(
    "OK: /api/voice/inbound is reachable (expects POST x-www-form-urlencoded from Twilio)"
  );
}

export async function POST(req: Request) {
  try {
    // Twilio sends application/x-www-form-urlencoded
    const raw = await req.text();
    const params = new URLSearchParams(raw);
    const to = params.get("To") || process.env.TWILIO_NUMBER || "";
    const forwardTo = process.env.FORWARD_TO;

    if (!forwardTo) {
      console.error("FORWARD_TO env var is missing");
      const vr = new twilio.twiml.VoiceResponse();
      vr.say("Configuration error. Please try again later.");
      return xml(vr.toString());
    }

    const vr = new twilio.twiml.VoiceResponse();
    vr.say("Thanks for calling! One moment please.");

    const dial = vr.dial({
      callerId: to,
      timeout: 18,
      answerOnBridge: true,
    });
    dial.number(forwardTo);

    return xml(vr.toString());
  } catch (err: any) {
    console.error("Inbound error:", err?.message || err);
    const vr = new twilio.twiml.VoiceResponse();
    vr.say("We are sorry. An application error occurred.");
    return xml(vr.toString());
  }
}

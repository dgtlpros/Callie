// app/api/voice/inbound/route.ts
import twilio from "twilio";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function xml(body: string) {
  return new NextResponse(body, { headers: { "Content-Type": "text/xml" } });
}

export async function GET() {
  return new NextResponse("OK: /api/voice/inbound (POST expected)");
}

export async function POST(req: Request) {
  try {
    const raw = await req.text(); // Twilio sends x-www-form-urlencoded
    const params = new URLSearchParams(raw);
    const to = params.get("To") || process.env.TWILIO_NUMBER || "";
    const forwardTo = process.env.FORWARD_TO;

    const vr = new twilio.twiml.VoiceResponse();

    // Small greeting so you hear it’s your TwiML
    vr.say("Thanks for calling! One moment please.");

    // 🟢 Record the live leg after the called party answers.
    //     - recordingStatusCallback: Twilio will POST here when the MP3 is ready.
    const dial = vr.dial({
      callerId: to,
      timeout: 18,
      answerOnBridge: true,
      record: "record-from-answer", // only record after the callee answers
      recordingStatusCallback: `${
        process.env.NEXT_PUBLIC_BASE_URL || ""
      }/api/voice/recording`,
      recordingStatusCallbackEvent: "completed", // only when the file is finalized
    });

    dial.number(forwardTo!);

    return xml(vr.toString());
  } catch (e) {
    const vr = new twilio.twiml.VoiceResponse();
    vr.say("We are sorry. An application error occurred.");
    return xml(vr.toString());
  }
}

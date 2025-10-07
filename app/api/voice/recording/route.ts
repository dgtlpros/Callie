// app/api/voice/recording/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST x-www-form-urlencoded from Twilio",
  });
}

export async function POST(req: Request) {
  const raw = await req.text(); // Twilio posts form-encoded
  const params = new URLSearchParams(raw);

  // Useful fields Twilio sends:
  const callSid = params.get("CallSid");
  const recordingSid = params.get("RecordingSid");
  const recordingUrl = params.get("RecordingUrl"); // add ".mp3" to fetch media
  const from = params.get("From");
  const to = params.get("To");
  const duration = params.get("RecordingDuration");

  console.log("📼 Recording complete:", {
    callSid,
    recordingSid,
    recordingUrl,
    from,
    to,
    duration,
  });

  // Respond 200 so Twilio knows we received it
  return new NextResponse("OK", { status: 200 });
}

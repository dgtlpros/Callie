// app/api/voice/recording/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);

  const recordingUrl = params.get("RecordingUrl");
  const callSid = params.get("CallSid");
  const duration = params.get("RecordingDuration");

  if (!recordingUrl) {
    console.error("❌ No RecordingUrl in payload");
    return new NextResponse("Missing RecordingUrl", { status: 400 });
  }

  console.log(`📼 Received recording for ${callSid}, duration ${duration}s`);

  try {
    // 1️⃣  Fetch the mp3 from Twilio using Basic Auth
    const twilioRes = await fetch(`${recordingUrl}.mp3`, {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString("base64"),
      },
    });

    const audioBuffer = await twilioRes.arrayBuffer();
    const blob = new Blob([audioBuffer], { type: "audio/mpeg" });

    // 2️⃣  Send to OpenAI Whisper for transcription
    const form = new FormData();
    form.append("file", blob, "recording.mp3");
    form.append("model", "whisper-1");

    const openaiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },
        body: form,
      }
    );

    const data = await openaiRes.json();
    console.log("🗒️  Transcript:", data.text);

    return NextResponse.json({ ok: true, transcript: data.text });
  } catch (err: any) {
    console.error("Transcription error:", err);
    return new NextResponse("Error transcribing", { status: 500 });
  }
}

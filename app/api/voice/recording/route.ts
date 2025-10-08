/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/voice/recording/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);

  const recordingUrl = params.get("RecordingUrl"); // Twilio gives URL w/o extension
  const callSid = params.get("CallSid") || "(unknown)";
  const duration = params.get("RecordingDuration") || "(unknown)";

  const acct = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!recordingUrl) {
    console.error("❌ Missing RecordingUrl");
    return new NextResponse("Missing RecordingUrl", { status: 400 });
  }
  if (!acct || !token) {
    console.error("❌ Missing Twilio creds in env");
    return new NextResponse("Missing Twilio creds", { status: 500 });
  }
  if (!openaiKey) {
    console.error("❌ Missing OPENAI_API_KEY in env");
    return new NextResponse("Missing OPENAI_API_KEY", { status: 500 });
  }

  console.log(`📼 Received recording for ${callSid}, duration ${duration}s`);

  try {
    // 1) Fetch MP3 from Twilio (requires Basic Auth)
    const mediaUrl = `${recordingUrl}.mp3`;
    const twilioRes = await fetch(mediaUrl, {
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${acct}:${token}`).toString("base64"),
      },
    });

    if (!twilioRes.ok) {
      const errTxt = await twilioRes.text();
      console.error("❌ Twilio media fetch failed", twilioRes.status, errTxt);
      return new NextResponse("Twilio media fetch failed", { status: 502 });
    }

    const audioArrayBuf = await twilioRes.arrayBuffer();

    // 2) Build multipart form-data for Whisper
    const file = new File([new Uint8Array(audioArrayBuf)], "recording.mp3", {
      type: "audio/mpeg",
    });
    const form = new FormData();
    form.append("file", file);
    form.append("model", "whisper-1"); // if this ever changes, we’ll see the error text
    // Optional extras:
    // form.append("temperature", "0");
    // form.append("language", "en");

    const openaiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      }
    );

    // If Whisper returns an error, log the raw body so we see what’s wrong
    if (!openaiRes.ok) {
      const errTxt = await openaiRes.text();
      console.error("❌ Whisper error", openaiRes.status, errTxt);
      return new NextResponse("Whisper error", { status: 502 });
    }

    const data = await openaiRes.json();
    console.log("🗒️ Transcript payload:", data);

    const transcript = data?.text ?? "";
    console.log("🗒️ Transcript:", transcript);

    return NextResponse.json({ ok: true, transcript });
  } catch (err: any) {
    console.error(
      "❌ Transcription exception:",
      err?.stack || err?.message || err
    );
    return new NextResponse("Transcription failed", { status: 500 });
  }
}

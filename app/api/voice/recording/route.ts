import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function summarize(text: string) {
  if (!text?.trim()) return "";
  const body = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You summarize phone calls for small businesses. Be concise (1–2 sentences). Include intent, next step, and any contact info if present.",
      },
      { role: "user", content: text.slice(0, 12000) }, // guard token size
    ],
    temperature: 0.2,
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Summary error:", res.status, t);
    return "";
  }
  const j = await res.json();
  return j?.choices?.[0]?.message?.content?.trim() || "";
}

export async function POST(req: Request) {
  const raw = await req.text();
  const p = new URLSearchParams(raw);

  const callSid = p.get("CallSid") || undefined;
  const recordingUrl = p.get("RecordingUrl") || undefined; // add .mp3 to fetch
  const from = p.get("From") || undefined;
  const to = p.get("To") || undefined;
  const duration = p.get("RecordingDuration") || "0";

  if (!recordingUrl)
    return new NextResponse("Missing RecordingUrl", { status: 400 });

  console.log(`📼 Received recording for ${callSid} (${duration}s)`);

  // 1) Fetch MP3 from Twilio (Basic Auth)
  const mediaUrl = `${recordingUrl}.mp3`;
  const twilioRes = await fetch(mediaUrl, {
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString("base64"),
    },
  });
  if (!twilioRes.ok) {
    const t = await twilioRes.text();
    console.error("Twilio media fetch failed:", twilioRes.status, t);
    return new NextResponse("Twilio media fetch failed", { status: 502 });
  }
  const audioArrayBuf = await twilioRes.arrayBuffer();

  // 2) Transcribe with Whisper
  const file = new File([new Uint8Array(audioArrayBuf)], "recording.mp3", {
    type: "audio/mpeg",
  });
  const form = new FormData();
  form.append("file", file);
  form.append("model", "whisper-1");

  const openaiKey = process.env.OPENAI_API_KEY!;
  const wRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  });

  if (!wRes.ok) {
    const t = await wRes.text();
    console.error("Whisper error:", wRes.status, t);
    return new NextResponse("Whisper error", { status: 502 });
  }

  const wData = await wRes.json();
  const transcript: string = wData?.text || "";

  // 3) Summarize (1–2 sentences)
  const summary = await summarize(transcript);

  // 4) Insert into Supabase
  const { error } = await supabaseAdmin.from("calls").insert({
    call_sid: callSid,
    from_number: from,
    to_number: to,
    duration_seconds: parseInt(duration || "0", 10) || 0,
    recording_url: mediaUrl,
    transcript,
    summary,
  });

  if (error) {
    console.error("Supabase insert error:", error);
    return new NextResponse("DB insert failed", { status: 500 });
  }

  console.log("🗒️ Transcript saved. 🧾 Summary:", summary);
  return NextResponse.json({ ok: true });
}

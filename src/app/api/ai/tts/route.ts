import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { text, voice = "alloy" } = await JSON.parse(await request.text());

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API Key missing in .env.local" }, { status: 500 });
    }

    if (!text || text.length < 2) {
      return NextResponse.json({ error: "Text too short" }, { status: 400 });
    }

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice, // 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (err: any) {
    console.error("TTS Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
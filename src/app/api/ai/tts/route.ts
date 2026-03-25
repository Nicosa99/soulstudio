import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API Key missing in .env.local" }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { text, voice = "alloy" } = await JSON.parse(await request.text());

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
    } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("TTS Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
    }
    }
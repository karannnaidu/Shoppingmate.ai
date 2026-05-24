import { GoogleGenerativeAI } from '@google/generative-ai';

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

export async function geminiVisionCall(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`fetch image ${imageUrl} failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const out = await model.generateContent([
    'Describe this image in one sentence suitable as HTML alt text for an e-commerce product page. Be concrete; mention subject, color, and context. No filler words.',
    { inlineData: { data: buf.toString('base64'), mimeType } },
  ]);
  return out.response.text().trim();
}

import { GoogleGenerativeAI } from '@google/generative-ai';

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

export async function geminiExtractCall(prompt: string): Promise<unknown> {
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const res = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });
  const text = res.response.text();
  return JSON.parse(text);
}

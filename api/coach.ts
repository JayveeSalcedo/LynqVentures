// Vercel serverless function: POST /api/coach. Set GROQ_API_KEY (and optionally GROQ_MODEL) in the
// Vercel project's Environment Variables. The key stays on the server.
import { handleCoach } from '../server/coach';

declare const process: { env: Record<string, string | undefined> };

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const result = await handleCoach(body, { GROQ_API_KEY: process.env.GROQ_API_KEY, GROQ_MODEL: process.env.GROQ_MODEL }, client);
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

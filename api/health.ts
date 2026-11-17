import type { IncomingMessage, ServerResponse } from 'node:http';

type VercelResponse = ServerResponse & {
  status?: (code: number) => VercelResponse;
  json?: (data: unknown) => void;
};

export default function handler(_req: IncomingMessage, res: VercelResponse): void {
  const payload = {
    ok: true,
    configured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

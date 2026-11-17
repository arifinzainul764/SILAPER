import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

type VercelRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
};

type VercelResponse = ServerResponse & {
  status?: (code: number) => VercelResponse;
  json?: (data: unknown) => void;
};

const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-4-hydrogen';

function sendJson(res: VercelResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: VercelRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    return (req.body ? JSON.parse(req.body) : {}) as Record<string, unknown>;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function extractErrorDetails(err: unknown): { status?: number; message: string; isTimeout: boolean } {
  if (!err || typeof err !== 'object') {
    return { message: String(err || ''), isTimeout: false };
  }
  const record = err as { name?: unknown; status?: unknown; code?: unknown; message?: unknown };
  const rawName = typeof record.name === 'string' ? record.name : '';
  const rawMessage = typeof record.message === 'string' ? record.message : String(err);
  const lower = rawMessage.toLowerCase();
  const isTimeout =
    rawName === 'AbortError' ||
    rawName === 'TimeoutError' ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted');

  let status =
    typeof record.status === 'number'
      ? record.status
      : typeof record.code === 'number'
        ? record.code
        : undefined;

  if (!status) {
    try {
      const parsed = JSON.parse(rawMessage) as { error?: { code?: number } };
      if (typeof parsed?.error?.code === 'number') {
        status = parsed.error.code;
      }
    } catch {
      const match = rawMessage.match(/"code"\s*:\s*(\d{3})/);
      if (match) {
        status = Number(match[1]);
      }
    }
  }

  return { status, message: rawMessage, isTimeout };
}

function isTransientGeminiError(err: unknown): boolean {
  const { status, message, isTimeout } = extractErrorDetails(err);
  if (isTimeout) return true;
  if (status && [408, 429, 500, 502, 503, 504].includes(status)) return true;

  const lower = message.toLowerCase();
  return (
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('fetch failed')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateSptWithRetry(
  ai: GoogleGenAI,
  cleanBase64: string,
  fileName: string,
) {
  const attemptsPlan: {
    model: string;
    thinkingLevel: ThinkingLevel;
    delayBeforeMs: number;
    timeoutMs: number;
  }[] = [
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.MINIMAL, delayBeforeMs: 0, timeoutMs: 12000 },
    { model: FALLBACK_MODEL, thinkingLevel: ThinkingLevel.LOW, delayBeforeMs: 250, timeoutMs: 14000 },
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.MINIMAL, delayBeforeMs: 500, timeoutMs: 12000 },
  ];

  let lastError: unknown;

  for (const step of attemptsPlan) {
    if (step.delayBeforeMs > 0) {
      await sleep(step.delayBeforeMs);
    }

    try {
      return await ai.models.generateContent({
        model: step.model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: cleanBase64,
              },
            },
            {
              text: `Anda adalah asisten administrasi pemerintahan tingkat Kecamatan di Indonesia.
Ekstrak seluruh informasi penting dari dokumen PDF Surat Perintah Tugas (SPT) berikut (${fileName || 'SPT.pdf'}) secara akurat dalam bahasa Indonesia formal.
Jika ada kolom yang tidak tertulis secara eksplisit di PDF, isi dengan string kosong "" (jangan mengarang NIP atau nomor surat).
Untuk dasarHukum, gabungkan poin-poin dasar hukum dengan format bernomor yang rapi jika ada lebih dari satu.`,
            },
          ],
        },
        config: {
          abortSignal: AbortSignal.timeout(step.timeoutMs),
          thinkingConfig: { thinkingLevel: step.thinkingLevel },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              namaKabupaten: { type: Type.STRING, description: 'Nama Pemerintah Kabupaten/Kota di Kop Surat' },
              namaKecamatan: { type: Type.STRING, description: 'Nama Kecamatan di Kop Surat' },
              alamatKecamatan: { type: Type.STRING, description: 'Alamat lengkap kantor kecamatan' },
              nomorSpt: { type: Type.STRING, description: 'Nomor Surat Perintah Tugas' },
              tanggalSpt: { type: Type.STRING, description: 'Tanggal penetapan SPT' },
              dasarHukum: { type: Type.STRING, description: 'Dasar hukum atau menimbang dalam SPT' },
              namaPegawai: { type: Type.STRING, description: 'Nama lengkap pegawai yang ditugaskan' },
              nip: { type: Type.STRING, description: 'Nomor Induk Pegawai (NIP)' },
              pangkatGolongan: { type: Type.STRING, description: 'Pangkat dan Golongan ruang pegawai' },
              jabatan: { type: Type.STRING, description: 'Jabatan pegawai yang ditugaskan' },
              tujuan: { type: Type.STRING, description: 'Lokasi atau instansi tujuan perjalanan dinas' },
              maksudPerjalanan: { type: Type.STRING, description: 'Maksud/keperluan tugas perjalanan dinas' },
              tanggalBerangkat: { type: Type.STRING, description: 'Tanggal mulai/berangkat pelaksanaan tugas' },
              tanggalKembali: { type: Type.STRING, description: 'Tanggal selesai/kembali pelaksanaan tugas' },
              tempatLaporan: { type: Type.STRING, description: 'Nama tempat/kota/kecamatan penetapan surat' },
              namaCamat: { type: Type.STRING, description: 'Nama pejabat penandatangan SPT (Camat/Sekcam)' },
              nipCamat: { type: Type.STRING, description: 'NIP pejabat penandatangan SPT' },
              pangkatCamat: { type: Type.STRING, description: 'Pangkat pejabat penandatangan SPT' },
            },
          },
        },
      });
    } catch (err) {
      lastError = err;
      if (!isTransientGeminiError(err)) {
        throw err;
      }
    }
  }

  throw lastError;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Metode tidak diizinkan. Gunakan POST.' });
    return;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      sendJson(res, 503, {
        error:
          'Layanan ekstraksi AI belum dikonfigurasi: tambahkan Environment Variable GEMINI_API_KEY di pengaturan proyek Vercel lalu lakukan Redeploy.',
      });
      return;
    }

    const body = await readJsonBody(req);
    const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : '';
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'SPT.pdf';

    if (!pdfBase64) {
      sendJson(res, 400, { error: 'Data PDF tidak valid atau kosong.' });
      return;
    }

    const cleanBase64 = pdfBase64.replace(/^data:[^;]*;base64,/, '').trim();
    if (!cleanBase64) {
      sendJson(res, 400, { error: 'Isi file PDF kosong atau tidak terbaca.' });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 14000,
        retryOptions: { attempts: 1 },
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await generateSptWithRetry(ai, cleanBase64, fileName);
    const rawText = (response.text ?? '{}')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    const parsed = JSON.parse(rawText || '{}');

    sendJson(res, 200, { extracted: parsed });
  } catch (err) {
    console.error('Vercel /api/extract-spt error:', err);
    const { status, message, isTimeout } = extractErrorDetails(err);

    if (isTimeout) {
      sendJson(res, 504, {
        error:
          'Waktu tunggu ekstraksi AI habis karena server sedang padat. Silakan klik "Coba Lagi" atau gunakan "Simulasi Ekstraksi SPT".',
      });
      return;
    }

    if (status === 503 || isTransientGeminiError(err)) {
      sendJson(res, 503, {
        error:
          'Layanan ekstraksi AI sedang mengalami lonjakan permintaan sementara (503 UNAVAILABLE). Silakan tunggu beberapa detik lalu klik "Coba Lagi".',
      });
      return;
    }

    sendJson(res, status && status >= 400 && status < 600 ? status : 500, {
      error: message || 'Gagal mengekstrak dokumen PDF SPT.',
    });
  }
}

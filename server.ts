import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '18mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-4-hydrogen';
const ATTEMPT_TIMEOUT_MS = 12000;

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
  if (isTimeout) {
    return true;
  }
  if (status && [408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
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
  const attemptsPlan: { model: string; thinkingLevel: ThinkingLevel; delayBeforeMs: number; timeoutMs: number }[] = [
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.MINIMAL, delayBeforeMs: 0, timeoutMs: 10000 },
    { model: FALLBACK_MODEL, thinkingLevel: ThinkingLevel.LOW, delayBeforeMs: 250, timeoutMs: 12000 },
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.MINIMAL, delayBeforeMs: 500, timeoutMs: 12000 },
  ];

  let lastError: unknown;

  for (let i = 0; i < attemptsPlan.length; i++) {
    const step = attemptsPlan[i];
    if (step.delayBeforeMs > 0) {
      await sleep(step.delayBeforeMs);
    }

    const startedAt = Date.now();
    try {
      const result = await ai.models.generateContent({
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
      console.log(`[SPT Extract] ${step.model} succeeded in ${Date.now() - startedAt}ms`);
      return result;
    } catch (err) {
      lastError = err;
      const details = extractErrorDetails(err);
      console.warn(
        `[SPT Extract] ${step.model} failed in ${Date.now() - startedAt}ms (status=${details.status ?? 'n/a'}, timeout=${details.isTimeout}): ${details.message.slice(0, 180)}`,
      );
      if (!isTransientGeminiError(err)) {
        throw err;
      }
    }
  }

  throw lastError;
}

app.post('/api/extract-spt', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'Layanan ekstraksi AI belum dikonfigurasi (GEMINI_API_KEY tidak tersedia pada server).',
      });
      return;
    }

    const { pdfBase64, fileName } = req.body as {
      pdfBase64?: string;
      fileName?: string;
    };

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      res.status(400).json({ error: 'Data PDF tidak valid atau kosong.' });
      return;
    }

    const cleanBase64 = pdfBase64.replace(/^data:[^;]*;base64,/, '').trim();
    if (!cleanBase64) {
      res.status(400).json({ error: 'Isi file PDF kosong atau tidak terbaca.' });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: ATTEMPT_TIMEOUT_MS,
        retryOptions: { attempts: 1 },
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await generateSptWithRetry(ai, cleanBase64, fileName || 'SPT.pdf');

    const rawText = (response.text ?? '{}')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    const parsed = JSON.parse(rawText || '{}');
    res.json({ extracted: parsed });
  } catch (err) {
    console.error('Error extracting SPT PDF:', err);
    const { status, message, isTimeout } = extractErrorDetails(err);

    if (isTimeout) {
      res.status(504).json({
        error:
          'Waktu tunggu ekstraksi AI habis karena server sedang padat. Silakan klik "Coba Lagi" atau gunakan "Simulasi Ekstraksi SPT".',
      });
      return;
    }

    if (status === 503 || isTransientGeminiError(err)) {
      res.status(503).json({
        error:
          'Layanan ekstraksi AI sedang mengalami lonjakan permintaan sementara (503 UNAVAILABLE). Silakan tunggu beberapa detik lalu klik "Coba Lagi".',
      });
      return;
    }

    res.status(status && status >= 400 && status < 600 ? status : 500).json({
      error: message || 'Gagal mengekstrak dokumen PDF SPT.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SILAPER server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

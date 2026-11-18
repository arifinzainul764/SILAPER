import dotenv from 'dotenv';
import express from 'express';
import http from 'node:http';
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

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const ATTEMPT_TIMEOUT_MS = 45000;

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

const MAX_A4_LINE_CHARS = 74;

function clampMaxOneA4Line(rawText: unknown, maxChars = MAX_A4_LINE_CHARS): string {
  if (typeof rawText !== 'string') return '';
  const cleaned = rawText.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return '';

  const firstLine = (
    cleaned
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) || cleaned
  )
    .replace(/^\d+\.\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const boundaryMatch = firstLine.match(/[a-z]{3,}[.!?](?=\s+[A-Z])/);
  const singleSentence =
    boundaryMatch && boundaryMatch.index !== undefined
      ? firstLine.slice(0, boundaryMatch.index + boundaryMatch[0].length).trim()
      : firstLine;

  if (singleSentence.length <= maxChars) {
    return singleSentence;
  }

  const slice = singleSentence.slice(0, maxChars - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = (lastSpace > 25 ? slice.slice(0, lastSpace) : slice)
    .replace(/[,;:\s]+$/, '')
    .trim();
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

interface SptExtractionPayload {
  fileName: string;
  extractedText?: string;
  kopImageBase64?: string;
  pageImagesBase64?: string[];
  pdfBase64?: string;
}

async function generateSptWithRetry(
  ai: GoogleGenAI,
  input: SptExtractionPayload,
) {
  const attemptsPlan: { model: string; thinkingLevel: ThinkingLevel; delayBeforeMs: number; timeoutMs: number }[] = [
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.LOW, delayBeforeMs: 0, timeoutMs: 38000 },
    { model: FALLBACK_MODEL, thinkingLevel: ThinkingLevel.MINIMAL, delayBeforeMs: 250, timeoutMs: 32000 },
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.LOW, delayBeforeMs: 500, timeoutMs: 32000 },
  ];

  const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];
  const hasPageImages = Array.isArray(input.pageImagesBase64) && input.pageImagesBase64.length > 0;
  const hasText = typeof input.extractedText === 'string' && input.extractedText.trim().length >= 80;

  if (hasPageImages) {
    for (const imgBase64 of (input.pageImagesBase64 || []).slice(0, 2)) {
      const cleanImg = String(imgBase64 || '').replace(/^data:[^;]*;base64,/, '').trim();
      if (cleanImg) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanImg,
          },
        });
      }
    }
  } else if (hasText) {
    const cleanKop = String(input.kopImageBase64 || '').replace(/^data:[^;]*;base64,/, '').trim();
    if (cleanKop) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanKop,
        },
      });
    }
  } else if (input.pdfBase64) {
    parts.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: input.pdfBase64,
      },
    });
  }

  const textContextSection = hasText
    ? `\n\nTeks hasil pembacaan PDF (${input.fileName || 'SPT.pdf'}):\n"""\n${input.extractedText!.trim().slice(0, 18000)}\n"""`
    : '';
  const logoImageHint = !hasPageImages && hasText && input.kopImageBase64
    ? ' Gambar yang dilampirkan adalah potongan bagian atas Kop Surat halaman pertama; gunakan gambar tersebut untuk membaca format teks Kop Surat secara persis serta mendeteksi hasKopLogo, logoBox, dan kopBox (koordinat 0-1000 relatif terhadap gambar potongan Kop Surat).'
    : '';

  parts.push({
    text: `Anda adalah asisten administrasi pemerintahan tingkat Kecamatan di Indonesia.
Ekstrak seluruh informasi penting dari dokumen Surat Perintah Tugas (SPT) berikut (${input.fileName || 'SPT.pdf'}) secara akurat dalam bahasa Indonesia formal.
Jika ada kolom identitas atau nomor yang tidak tertulis secara eksplisit di SPT, isi dengan string kosong "" (jangan mengarang NIP atau nomor surat).
Untuk dasarHukum, tulis dengan teks biasa (tanpa format tebal/bold, miring/italic, atau garis bawah/underline) dan pisahkan setiap poin dengan baris baru serta penomoran 1., 2., 3., dst. jika terdapat lebih dari satu dasar hukum.
Periksa bagian Kop Surat pada halaman pertama SPT dengan sangat teliti:
- Baca susunan teks Kop Surat persis seperti yang tampil (namaKabupaten untuk baris induk instansi seperti PEMERINTAH KABUPATEN ..., namaKecamatan untuk baris nama instansi/kecamatan utama, dan alamatKecamatan untuk seluruh baris alamat, telepon, pos-el/email, laman, serta kode pos dengan mempertahankan jeda baris \\n agar format barisnya sesuai Kop asli).
- Jika terdapat lambang/logo instansi di kiri atas Kop Surat, set hasKopLogo: true dan isi logoBox dengan koordinat bounding box [ymin, xmin, ymax, xmax] berskala 0 sampai 1000 yang melingkupi HANYA gambar/lambang logo secara ketat dan presisi — JANGAN menyertakan garis pembatas hitam horizontal di bawah kop surat maupun teks di samping logo (jika tidak ada logo di Kop Surat, set hasKopLogo: false dan logoBox: []).
- Isi kopBox dengan bounding box [ymin, xmin, ymax, xmax] berskala 0 sampai 1000 yang melingkupi seluruh blok Kop Surat halaman pertama (mulai dari sisi atas logo/baris pertama Kop hingga tepat di bawah garis pembatas bawah Kop Surat, TIDAK termasuk judul "SURAT PERINTAH TUGAS").${logoImageHint}
Selain itu, buatlah draf otomatis untuk kolom hasilPelaksanaan (V. Hasil Pelaksanaan Kegiatan) dan kesimpulanSaran (VI. Kesimpulan dan Saran) yang selaras dengan maksud perjalanan dan tujuan pada SPT dalam bahasa Indonesia dinas yang formal. Masing-masing kolom hasilPelaksanaan dan kesimpulanSaran WAJIB berupa 1 kalimat sangat singkat (maksimal 65–72 karakter, tanpa penomoran dan tanpa baris baru) agar tepat muat dalam paling banyak 1 baris pada kertas A4.${textContextSection}`,
  });

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
        contents: { parts },
        config: {
          abortSignal: AbortSignal.timeout(step.timeoutMs),
          thinkingConfig: { thinkingLevel: step.thinkingLevel },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              namaKabupaten: { type: Type.STRING, description: 'Nama Pemerintah Kabupaten/Kota di Kop Surat persis seperti dokumen SPT' },
              namaKecamatan: { type: Type.STRING, description: 'Nama Instansi/Kecamatan di Kop Surat persis seperti dokumen SPT' },
              alamatKecamatan: { type: Type.STRING, description: 'Alamat lengkap kantor kecamatan beserta telp/email/laman/kode pos dengan pemisah baris \\n sesuai Kop Surat SPT' },
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
              hasilPelaksanaan: {
                type: Type.STRING,
                description:
                  'Draf otomatis V. Hasil Pelaksanaan Kegiatan dalam bahasa dinas formal berdasarkan tujuan dan maksud perjalanan SPT, paling banyak 1 baris kertas A4 (1 kalimat singkat maksimal 70 karakter).',
              },
              kesimpulanSaran: {
                type: Type.STRING,
                description:
                  'Draf otomatis VI. Kesimpulan dan Saran dalam bahasa dinas formal berdasarkan tujuan dan maksud perjalanan SPT, paling banyak 1 baris kertas A4 (1 kalimat singkat maksimal 70 karakter).',
              },
              tempatLaporan: { type: Type.STRING, description: 'Nama tempat/kota/kecamatan penetapan surat' },
              namaCamat: { type: Type.STRING, description: 'Nama pejabat penandatangan SPT (Camat/Sekcam)' },
              nipCamat: { type: Type.STRING, description: 'NIP pejabat penandatangan SPT' },
              pangkatCamat: { type: Type.STRING, description: 'Pangkat pejabat penandatangan SPT' },
              hasKopLogo: {
                type: Type.BOOLEAN,
                description: 'Bernilai true jika terdapat lambang/logo instansi di kiri atas Kop Surat halaman pertama.',
              },
              logoBox: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: 'Koordinat bounding box ketat HANYA untuk gambar logo instansi di Kop Surat halaman pertama [ymin, xmin, ymax, xmax] berskala 0-1000 tanpa garis pembatas bawah kop.',
              },
              kopBox: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: 'Koordinat bounding box seluruh blok Kop Surat halaman pertama termasuk logo, teks kop, dan garis pembatas bawah kop [ymin, xmin, ymax, xmax] berskala 0-1000.',
              },
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

    const {
      pdfBase64,
      extractedText,
      kopImageBase64,
      pageImagesBase64,
      fileName,
    } = req.body as {
      pdfBase64?: string;
      extractedText?: string;
      kopImageBase64?: string;
      pageImagesBase64?: string[];
      fileName?: string;
    };

    const cleanBase64 =
      typeof pdfBase64 === 'string'
        ? pdfBase64.replace(/^data:[^;]*;base64,/, '').trim()
        : '';
    const hasExtractedText =
      typeof extractedText === 'string' && extractedText.trim().length >= 80;
    const hasPageImages =
      Array.isArray(pageImagesBase64) && pageImagesBase64.some((img) => Boolean(img));

    if (!cleanBase64 && !hasExtractedText && !hasPageImages) {
      res.status(400).json({ error: 'Data PDF kosong atau tidak terbaca.' });
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

    const response = await generateSptWithRetry(ai, {
      fileName: fileName || 'SPT.pdf',
      extractedText,
      kopImageBase64,
      pageImagesBase64,
      pdfBase64: cleanBase64,
    });

    const rawText = (response.text ?? '{}')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    const parsed = JSON.parse(rawText || '{}') as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      parsed.hasilPelaksanaan = clampMaxOneA4Line(parsed.hasilPelaksanaan);
      parsed.kesimpulanSaran = clampMaxOneA4Line(parsed.kesimpulanSaran);
    }
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
  const httpServer = http.createServer(app);
  const hmrDisabled = process.env.DISABLE_HMR === 'true';

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        watch: hmrDisabled ? null : {},
      },
      appType: 'spa',
    });

    if (hmrDisabled || vite.config.server.hmr === false) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const result = await vite.transformRequest('/@vite/client');
          if (!result?.code) {
            return next();
          }
          const patchedCode = result.code.replace(
            'transport.connect(createHMRHandler(handleMessage))',
            'Promise.resolve()',
          );
          res.type('application/javascript').send(patchedCode);
        } catch (err) {
          next(err);
        }
      });
    }

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SILAPER server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '18mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

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

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
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

    const rawText = response.text?.trim() || '{}';
    const parsed = JSON.parse(rawText);
    res.json({ extracted: parsed });
  } catch (err) {
    console.error('Error extracting SPT PDF:', err);
    const message = err instanceof Error ? err.message : 'Gagal mengekstrak dokumen PDF SPT.';
    res.status(500).json({ error: message });
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

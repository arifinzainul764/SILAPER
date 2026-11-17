import { jsPDF } from 'jspdf';
import { TravelReportData } from '../types/report';
import { loadImageForExport } from './imageUtils';

export async function exportReportToPdf(report: TravelReportData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = 210;
  const pageH = 297;
  const marginL = 22;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  const maxY = pageH - 20;
  let y = 18;

  const checkPageBreak = (neededH = 12) => {
    if (y + neededH > maxY) {
      doc.addPage();
      y = 20;
    }
  };

  // Kop Surat + Logo di sisi kiri judul
  try {
    const logo = await loadImageForExport('/assets/aistudio/image_08502736.png');
    doc.addImage(logo.dataUrl, 'JPEG', marginL, y - 2, 18, 18);
  } catch {
    // Abaikan jika logo gagal dimuat saat ekspor
  }

  const textCenterX = pageW / 2 + 4;
  const headerTextW = contentW - 24;

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text((report.namaKabupaten || 'PEMERINTAH KABUPATEN').toUpperCase(), textCenterX, y, {
    align: 'center',
  });
  y += 6;

  doc.setFontSize(16);
  doc.text((report.namaKecamatan || 'KECAMATAN').toUpperCase(), textCenterX, y, {
    align: 'center',
  });
  y += 5;

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  const alamatLines = doc.splitTextToSize(report.alamatKecamatan || '-', headerTextW);
  doc.text(alamatLines, textCenterX, y, { align: 'center' });
  y = Math.max(y + alamatLines.length * 4 + 2, 36);

  // Double line border Kop Surat
  doc.setLineWidth(0.8);
  doc.line(marginL, y, pageW - marginR, y);
  doc.setLineWidth(0.25);
  doc.line(marginL, y + 1.2, pageW - marginR, y + 1.2);
  y += 9;

  // Judul Dokumen
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  const titleText = 'LAPORAN PERJALANAN DINAS';
  doc.text(titleText, pageW / 2, y, { align: 'center' });
  const titleWidth = doc.getTextWidth(titleText);
  doc.setLineWidth(0.35);
  doc.line(pageW / 2 - titleWidth / 2, y + 1, pageW / 2 + titleWidth / 2, y + 1);
  y += 5.5;

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.text(`Berdasarkan SPT Nomor: ${report.nomorSpt || '-'}`, pageW / 2, y, {
    align: 'center',
  });
  y += 9;

  const addSectionHeading = (title: string) => {
    checkPageBreak(14);
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text(title, marginL, y);
    y += 5.5;
  };

  const addParagraph = (text: string, indentMm = 7) => {
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    const paragraphs = (text || '-').split('\n');
    for (const para of paragraphs) {
      const wrapped = doc.splitTextToSize(para.trim() || '-', contentW - indentMm);
      for (const line of wrapped) {
        checkPageBreak(6);
        doc.text(line, marginL + indentMm, y);
        y += 5.2;
      }
      y += 1.2;
    }
  };

  const addKeyValueRow = (label: string, value: string) => {
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    const labelX = marginL + 7;
    const colonX = marginL + 52;
    const valX = marginL + 56;
    const valLines = doc.splitTextToSize(value || '-', contentW - 56);
    checkPageBreak(valLines.length * 5.2 + 2);
    doc.text(label, labelX, y);
    doc.text(':', colonX, y);
    doc.text(valLines, valX, y);
    y += valLines.length * 5.2 + 1.2;
  };

  // I. PENDAHULUAN / DASAR
  addSectionHeading('I. PENDAHULUAN / DASAR');
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  const sptLine = doc.splitTextToSize(
    `Surat Perintah Tugas (SPT) Nomor ${report.nomorSpt || '-'} tanggal ${report.tanggalSpt || '-'}.`,
    contentW - 7,
  );
  checkPageBreak(sptLine.length * 5.2 + 2);
  doc.text(sptLine, marginL + 7, y);
  y += sptLine.length * 5.2 + 1.5;
  addParagraph(report.dasarHukum);
  y += 2;

  // II. MAKSUD DAN TUJUAN
  addSectionHeading('II. MAKSUD DAN TUJUAN');
  addKeyValueRow('Tujuan / Lokasi', report.tujuan);
  addKeyValueRow('Maksud Perjalanan', report.maksudPerjalanan);
  y += 2;

  // III. WAKTU PELAKSANAAN
  addSectionHeading('III. WAKTU PELAKSANAAN');
  addKeyValueRow('Tanggal Berangkat', report.tanggalBerangkat || report.tanggalSpt);
  addKeyValueRow('Tanggal Kembali', report.tanggalKembali || report.tanggalSpt);
  y += 2;

  // IV. PETUGAS YANG MELAKSANAKAN
  addSectionHeading('IV. PETUGAS YANG MELAKSANAKAN');
  addKeyValueRow('Nama Pegawai', report.namaPegawai);
  addKeyValueRow('NIP', report.nip);
  addKeyValueRow('Pangkat / Golongan', report.pangkatGolongan);
  addKeyValueRow('Jabatan', report.jabatan);
  y += 2;

  // V. HASIL PELAKSANAAN KEGIATAN
  addSectionHeading('V. HASIL PELAKSANAAN KEGIATAN');
  addParagraph(report.hasilPelaksanaan);
  y += 2;

  // VI. KESIMPULAN DAN SARAN
  addSectionHeading('VI. KESIMPULAN DAN SARAN');
  addParagraph(report.kesimpulanSaran);
  y += 2;

  // VII. PENUTUP
  addSectionHeading('VII. PENUTUP');
  addParagraph(report.penutup);

  // Signature block
  checkPageBreak(48);
  y += 8;
  const leftColCenter = marginL + contentW * 0.24;
  const rightColCenter = marginL + contentW * 0.76;

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text('Mengetahui,', leftColCenter, y, { align: 'center' });
  doc.text(
    `${report.tempatLaporan || 'Cisarua'}, ${report.tanggalLaporan || report.tanggalSpt || '-'}`,
    rightColCenter,
    y,
    { align: 'center' },
  );
  y += 5.5;

  doc.setFont('times', 'bold');
  const camatTitle = `Camat ${(report.namaKecamatan || '').replace(/^kecamatan\s+/i, '') || 'Kecamatan'}`;
  doc.text(camatTitle, leftColCenter, y, { align: 'center' });
  doc.text('Pelaksana Perjalanan Dinas,', rightColCenter, y, { align: 'center' });
  y += 22;

  const camatName = report.namaCamat || '...................................';
  const pegName = report.namaPegawai || '...................................';
  doc.text(camatName, leftColCenter, y, { align: 'center' });
  const cw = doc.getTextWidth(camatName);
  doc.line(leftColCenter - cw / 2, y + 0.8, leftColCenter + cw / 2, y + 0.8);

  doc.text(pegName, rightColCenter, y, { align: 'center' });
  const pw = doc.getTextWidth(pegName);
  doc.line(rightColCenter - pw / 2, y + 0.8, rightColCenter + pw / 2, y + 0.8);
  y += 5;

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  if (report.pangkatCamat || report.pangkatGolongan) {
    doc.text(report.pangkatCamat || '', leftColCenter, y, { align: 'center' });
    doc.text(report.pangkatGolongan || '', rightColCenter, y, { align: 'center' });
    y += 4.5;
  }
  doc.text(`NIP. ${report.nipCamat || '-'}`, leftColCenter, y, { align: 'center' });
  doc.text(`NIP. ${report.nip || '-'}`, rightColCenter, y, { align: 'center' });

  // Lampiran Foto
  if (report.photos && report.photos.length > 0) {
    doc.addPage();
    y = 20;

    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    const lampTitle = 'LAMPIRAN DOKUMENTASI KEGIATAN';
    doc.text(lampTitle, pageW / 2, y, { align: 'center' });
    const lw = doc.getTextWidth(lampTitle);
    doc.line(pageW / 2 - lw / 2, y + 1, pageW / 2 + lw / 2, y + 1);
    y += 6;

    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text(`Laporan Perjalanan Dinas — SPT Nomor: ${report.nomorSpt || '-'}`, pageW / 2, y, {
      align: 'center',
    });
    y += 10;

    const loaded = await Promise.all(
      report.photos.slice(0, 4).map(async (photo, idx) => {
        try {
          const img = await loadImageForExport(photo.dataUrl);
          return { photo, img, idx };
        } catch {
          return null;
        }
      }),
    );

    const cardW = (contentW - 8) / 2;
    const cardImgH = 58;

    loaded.forEach((entry, i) => {
      if (!entry) return;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = marginL + col * (cardW + 8);
      const boxY = y + row * (cardImgH + 28);

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.rect(x, boxY, cardW, cardImgH + 20);

      const ratio = Math.min((cardW - 4) / entry.img.width, (cardImgH - 4) / entry.img.height);
      const drawW = entry.img.width * ratio;
      const drawH = entry.img.height * ratio;
      const drawX = x + (cardW - drawW) / 2;
      const drawY = boxY + 2 + (cardImgH - 4 - drawH) / 2;

      doc.addImage(entry.img.dataUrl, 'JPEG', drawX, drawY, drawW, drawH);

      doc.setFont('times', 'italic');
      doc.setFontSize(9);
      const cap = doc.splitTextToSize(
        `Foto ${entry.idx + 1}: ${entry.photo.caption || entry.photo.name}`,
        cardW - 6,
      );
      doc.text(cap.slice(0, 2), x + cardW / 2, boxY + cardImgH + 5, { align: 'center' });
    });
  }

  const safeSpt = (report.nomorSpt || 'Laporan').replace(/[^a-zA-Z0-9_\-]/g, '_');
  doc.save(`Laporan_Perjalanan_Dinas_${safeSpt}.pdf`);
}

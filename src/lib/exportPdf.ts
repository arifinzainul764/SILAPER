import { jsPDF } from 'jspdf';
import { TravelReportData } from '../types/report';
import { buildPendahuluanDasarItems } from './dasarUtils';
import { loadDefaultEmblemForExport, loadImageForExport } from './imageUtils';

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

  let renderedBanner = false;
  if (report.kopBannerDataUrl) {
    try {
      const banner = await loadImageForExport(report.kopBannerDataUrl);
      const drawW = contentW;
      const drawH = (banner.height / Math.max(1, banner.width)) * drawW;
      doc.addImage(banner.dataUrl, banner.format, marginL, y, drawW, drawH);
      y += drawH + 7;
      renderedBanner = true;
    } catch {
      renderedBanner = false;
    }
  }

  if (!renderedBanner) {
    // Kop Surat + Logo di sisi kiri judul
    try {
      const logo = report.logoDataUrl
        ? await loadImageForExport(report.logoDataUrl)
        : await loadDefaultEmblemForExport();
      const maxW = 18;
      const maxH = 20;
      const scale = Math.min(maxW / Math.max(1, logo.width), maxH / Math.max(1, logo.height));
      const drawW = logo.width * scale;
      const drawH = logo.height * scale;
      const drawX = marginL + (maxW - drawW) / 2;
      const drawY = y - 2 + (maxH - drawH) / 2;
      doc.addImage(logo.dataUrl, logo.format, drawX, drawY, drawW, drawH);
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
    const rawAlamatLines = (report.alamatKecamatan || '-').split('\n');
    const alamatLines: string[] = [];
    for (const rawLine of rawAlamatLines) {
      const wrapped = doc.splitTextToSize(rawLine.trim() || ' ', headerTextW) as string[];
      alamatLines.push(...wrapped);
    }
    doc.text(alamatLines, textCenterX, y, { align: 'center' });
    y = Math.max(y + alamatLines.length * 4 + 2, 36);

    // Double line border Kop Surat
    doc.setLineWidth(0.8);
    doc.line(marginL, y, pageW - marginR, y);
    doc.setLineWidth(0.25);
    doc.line(marginL, y + 1.2, pageW - marginR, y + 1.2);
    y += 9;
  }

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
  const { items: dasarItems, useNumbering: useDasarNumbering } = buildPendahuluanDasarItems(report);
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  dasarItems.forEach((item, idx) => {
    if (useDasarNumbering) {
      const prefix = `${idx + 1}.`;
      const prefixX = marginL + 7;
      const textX = marginL + 13;
      const wrapped = doc.splitTextToSize(item, contentW - 13) as string[];
      wrapped.forEach((line, lineIdx) => {
        checkPageBreak(6);
        if (lineIdx === 0) {
          doc.text(prefix, prefixX, y);
        }
        doc.text(line, textX, y);
        y += 5.2;
      });
      y += 1.2;
    } else {
      const wrapped = doc.splitTextToSize(item, contentW - 7) as string[];
      for (const line of wrapped) {
        checkPageBreak(6);
        doc.text(line, marginL + 7, y);
        y += 5.2;
      }
      y += 1.2;
    }
  });
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

  // Signature block (Pelaksana Perjalanan Dinas)
  checkPageBreak(48);
  y += 8;
  const rightColCenter = marginL + contentW * 0.75;

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text(
    `${report.tempatLaporan || 'Cisarua'}, ${report.tanggalLaporan || report.tanggalSpt || '-'}`,
    rightColCenter,
    y,
    { align: 'center' },
  );
  y += 5.5;

  doc.setFont('times', 'bold');
  doc.text('Pelaksana Perjalanan Dinas,', rightColCenter, y, { align: 'center' });
  y += 22;

  const pegName = report.namaPegawai || '...................................';
  doc.text(pegName, rightColCenter, y, { align: 'center' });
  const pw = doc.getTextWidth(pegName);
  doc.line(rightColCenter - pw / 2, y + 0.8, rightColCenter + pw / 2, y + 0.8);
  y += 5;

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  if (report.pangkatGolongan) {
    doc.text(report.pangkatGolongan, rightColCenter, y, { align: 'center' });
    y += 4.5;
  }
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

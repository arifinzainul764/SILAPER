import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import { TravelReportData } from '../types/report';
import { buildPendahuluanDasarItems } from './dasarUtils';
import { loadDefaultEmblemForExport, loadImageForExport } from './imageUtils';

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function makeTextLines(text: string, size = 22): Paragraph[] {
  const lines = (text || '-').split('\n').filter((line, idx, arr) => line.trim() !== '' || idx === 0 && arr.length === 1);
  if (lines.length === 0) {
    return [
      new Paragraph({
        spacing: { after: 80, line: 276 },
        children: [new TextRun({ text: '-', font: 'Times New Roman', size })],
      }),
    ];
  }
  return lines.map(
    (line) =>
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80, line: 276 },
        indent: { left: 360 },
        children: [new TextRun({ text: line, font: 'Times New Roman', size })],
      }),
  );
}

function makeSectionHeading(title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        font: 'Times New Roman',
        size: 22,
      }),
    ],
  });
}

function makeInfoRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: NO_BORDER,
        children: [
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: label, font: 'Times New Roman', size: 22 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 4, type: WidthType.PERCENTAGE },
        borders: NO_BORDER,
        children: [
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: ':', font: 'Times New Roman', size: 22 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 66, type: WidthType.PERCENTAGE },
        borders: NO_BORDER,
        children: [
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: value || '-', font: 'Times New Roman', size: 22 })],
          }),
        ],
      }),
    ],
  });
}

export async function exportReportToDocx(report: TravelReportData): Promise<void> {
  let kopHeaderBlock: Paragraph | Table | null = null;

  if (report.kopBannerDataUrl) {
    try {
      const loadedBanner = await loadImageForExport(report.kopBannerDataUrl);
      const bannerWidth = 472;
      const bannerHeight = Math.max(
        48,
        Math.round((loadedBanner.height / Math.max(1, loadedBanner.width)) * bannerWidth),
      );
      kopHeaderBlock = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 140 },
        children: [
          new ImageRun({
            type: loadedBanner.format === 'PNG' ? 'png' : 'jpg',
            data: loadedBanner.bytes,
            transformation: { width: bannerWidth, height: bannerHeight },
          }),
        ],
      });
    } catch {
      kopHeaderBlock = null;
    }
  }

  if (!kopHeaderBlock) {
    let logoBytes: Uint8Array | null = null;
    let logoType: 'png' | 'jpg' = 'png';
    let logoWidth = 62;
    let logoHeight = 62;
    try {
      const loadedLogo = report.logoDataUrl
        ? await loadImageForExport(report.logoDataUrl)
        : await loadDefaultEmblemForExport();
      logoBytes = loadedLogo.bytes;
      logoType = loadedLogo.format === 'PNG' ? 'png' : 'jpg';
      const ratio = loadedLogo.width / Math.max(1, loadedLogo.height);
      if (ratio >= 1) {
        logoWidth = 64;
        logoHeight = Math.max(32, Math.round(64 / ratio));
      } else {
        logoHeight = 68;
        logoWidth = Math.max(32, Math.round(68 * ratio));
      }
    } catch {
      logoBytes = null;
    }

    const headerBottomBorder = {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.DOUBLE, size: 18, color: '000000' },
    };

    const alamatParagraphs = (report.alamatKecamatan || '-')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const resolvedAlamatLines = alamatParagraphs.length > 0 ? alamatParagraphs : ['-'];

    kopHeaderBlock = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              borders: headerBottomBorder,
              margins: { bottom: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: logoBytes
                    ? [
                        new ImageRun({
                          type: logoType,
                          data: logoBytes,
                          transformation: { width: logoWidth, height: logoHeight },
                        }),
                      ]
                    : [],
                }),
              ],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              borders: headerBottomBorder,
              margins: { bottom: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 20 },
                  children: [
                    new TextRun({
                      text: (report.namaKabupaten || 'PEMERINTAH KABUPATEN').toUpperCase(),
                      bold: true,
                      font: 'Times New Roman',
                      size: 26,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 30 },
                  children: [
                    new TextRun({
                      text: (report.namaKecamatan || 'KECAMATAN').toUpperCase(),
                      bold: true,
                      font: 'Times New Roman',
                      size: 32,
                    }),
                  ],
                }),
                ...resolvedAlamatLines.map(
                  (line) =>
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: line,
                          font: 'Times New Roman',
                          size: 18,
                        }),
                      ],
                    }),
                ),
              ],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              borders: headerBottomBorder,
              margins: { bottom: 100 },
              children: [new Paragraph({ children: [] })],
            }),
          ],
        }),
      ],
    });
  }

  const children: (Paragraph | Table)[] = [
    kopHeaderBlock,

    // Title
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 40 },
      children: [
        new TextRun({
          text: 'LAPORAN PERJALANAN DINAS',
          bold: true,
          underline: {},
          font: 'Times New Roman',
          size: 26,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: `Berdasarkan SPT Nomor: ${report.nomorSpt || '-'}`,
          font: 'Times New Roman',
          size: 21,
        }),
      ],
    }),

    // I. PENDAHULUAN / DASAR
    makeSectionHeading('I. PENDAHULUAN / DASAR'),
    ...(() => {
      const { items: dasarItems, useNumbering } = buildPendahuluanDasarItems(report);
      return dasarItems.map(
        (item, idx) =>
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 80, line: 276 },
            indent: useNumbering ? { left: 640, hanging: 280 } : { left: 360 },
            children: [
              new TextRun({
                text: useNumbering ? `${idx + 1}. ${item}` : item,
                bold: false,
                italics: false,
                font: 'Times New Roman',
                size: 22,
              }),
            ],
          }),
      );
    })(),

    // II. MAKSUD DAN TUJUAN
    makeSectionHeading('II. MAKSUD DAN TUJUAN'),
    new Table({
      width: { size: 95, type: WidthType.PERCENTAGE },
      indent: { size: 360, type: WidthType.DXA },
      rows: [
        makeInfoRow('Tujuan / Lokasi', report.tujuan),
        makeInfoRow('Maksud Perjalanan', report.maksudPerjalanan),
      ],
    }),

    // III. WAKTU PELAKSANAAN
    makeSectionHeading('III. WAKTU PELAKSANAAN'),
    new Table({
      width: { size: 95, type: WidthType.PERCENTAGE },
      indent: { size: 360, type: WidthType.DXA },
      rows: [
        makeInfoRow('Tanggal Berangkat', report.tanggalBerangkat || report.tanggalSpt),
        makeInfoRow('Tanggal Kembali', report.tanggalKembali || report.tanggalSpt),
      ],
    }),

    // IV. PETUGAS YANG MELAKSANAKAN
    makeSectionHeading('IV. PETUGAS YANG MELAKSANAKAN'),
    new Table({
      width: { size: 95, type: WidthType.PERCENTAGE },
      indent: { size: 360, type: WidthType.DXA },
      rows: [
        makeInfoRow('Nama Pegawai', report.namaPegawai),
        makeInfoRow('NIP', report.nip),
        makeInfoRow('Pangkat / Golongan', report.pangkatGolongan),
        makeInfoRow('Jabatan', report.jabatan),
      ],
    }),

    // V. HASIL PELAKSANAAN KEGIATAN
    makeSectionHeading('V. HASIL PELAKSANAAN KEGIATAN'),
    ...makeTextLines(report.hasilPelaksanaan),

    // VI. KESIMPULAN DAN SARAN
    makeSectionHeading('VI. KESIMPULAN DAN SARAN'),
    ...makeTextLines(report.kesimpulanSaran),

    // VII. PENUTUP
    makeSectionHeading('VII. PENUTUP'),
    ...makeTextLines(report.penutup),

    // Spacer before signature
    new Paragraph({ spacing: { before: 280 }, children: [] }),

    // Right-aligned Signature Block (Pelaksana Perjalanan Dinas)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: NO_BORDER,
              children: [new Paragraph({ children: [] })],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: NO_BORDER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `${report.tempatLaporan || 'Cisarua'}, ${report.tanggalLaporan || report.tanggalSpt || '-'}`,
                      font: 'Times New Roman',
                      size: 22,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 700 },
                  children: [
                    new TextRun({
                      text: 'Pelaksana Perjalanan Dinas,',
                      bold: true,
                      font: 'Times New Roman',
                      size: 22,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: report.namaPegawai || '........................................',
                      bold: true,
                      underline: {},
                      font: 'Times New Roman',
                      size: 22,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: report.pangkatGolongan || '',
                      font: 'Times New Roman',
                      size: 20,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `NIP. ${report.nip || '-'}`,
                      font: 'Times New Roman',
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  // Lampiran Foto Dokumentasi (Maksimal 4 Foto)
  if (report.photos && report.photos.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: 'LAMPIRAN DOKUMENTASI KEGIATAN',
            bold: true,
            underline: {},
            font: 'Times New Roman',
            size: 24,
          }),
        ],
      }),
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `Laporan Perjalanan Dinas — SPT Nomor: ${report.nomorSpt || '-'}`,
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      }),
    );

    const loadedImages = await Promise.all(
      report.photos.slice(0, 4).map(async (photo, idx) => {
        try {
          const loaded = await loadImageForExport(photo.dataUrl);
          return { photo, loaded, idx };
        } catch {
          return null;
        }
      }),
    );

    const validItems = loadedImages.filter((item): item is NonNullable<typeof item> => item !== null);
    const rows: TableRow[] = [];

    for (let i = 0; i < validItems.length; i += 2) {
      const pair = [validItems[i], validItems[i + 1]];
      rows.push(
        new TableRow({
          children: pair.map((entry) => {
            if (!entry) {
              return new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: NO_BORDER,
                children: [new Paragraph({ children: [] })],
              });
            }
            const targetW = 240;
            const targetH = Math.round((entry.loaded.height / entry.loaded.width) * targetW) || 180;
            return new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 80 },
                  children: [
                    new ImageRun({
                      type: 'jpg',
                      data: entry.loaded.bytes,
                      transformation: {
                        width: targetW,
                        height: Math.min(200, targetH),
                      },
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `Foto ${entry.idx + 1}: ${entry.photo.caption || entry.photo.name}`,
                      italics: true,
                      font: 'Times New Roman',
                      size: 18,
                    }),
                  ],
                }),
              ],
            });
          }),
        }),
      );
    }

    if (rows.length > 0) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows,
        }),
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1020,
              bottom: 1020,
              left: 1247,
              right: 1134,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeSpt = (report.nomorSpt || 'Laporan').replace(/[^a-zA-Z0-9_\-]/g, '_');
  saveAs(blob, `Laporan_Perjalanan_Dinas_${safeSpt}.docx`);
}

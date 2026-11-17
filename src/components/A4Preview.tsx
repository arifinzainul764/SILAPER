import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { TravelReportData } from '../types/report';
import { OfficialEmblem } from './OfficialEmblem';

interface A4PreviewProps {
  report: TravelReportData;
}

const PhotoPreviewCard: React.FC<{
  index: number;
  src: string;
  caption: string;
  name: string;
}> = ({ index, src, caption, name }) => {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="border border-slate-300 bg-white p-2.5 flex flex-col justify-between break-inside-avoid">
      <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
        {hasError || !src ? (
          <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
            <ImageOff className="w-6 h-6 mb-1.5" />
            <span className="text-[11px] font-sans">{name}</span>
          </div>
        ) : (
          <img
            src={src}
            alt={caption || `Dokumentasi kegiatan ${index + 1}`}
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <p className="mt-2 text-[10.5pt] leading-snug text-center italic text-slate-800">
        Foto {index + 1}: {caption || name || 'Dokumentasi kegiatan perjalanan dinas'}
      </p>
    </div>
  );
};

const KopLogo: React.FC = () => {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return <OfficialEmblem className="w-[64px] h-[72px]" />;
  }

  return (
    <img
      src="/assets/aistudio/image_08502736.png"
      alt="Logo Resmi Instansi"
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className="w-[68px] h-[68px] object-contain"
    />
  );
};

export const A4Preview: React.FC<A4PreviewProps> = ({ report }) => {
  const kecamatanShort =
    (report.namaKecamatan || '').replace(/^kecamatan\s+/i, '').trim() || 'Kecamatan';

  const renderLines = (text: string) => {
    const clean = (text || '').trim();
    if (!clean) {
      return <p className="text-slate-400 italic">[Belum diisi]</p>;
    }
    return clean.split('\n').map((line, i) => (
      <p key={i} className="mb-1.5 last:mb-0 text-justify leading-[1.55]">
        {line}
      </p>
    ));
  };

  return (
    <div id="a4-print-area" className="print-only-container flex flex-col items-center gap-8">
      {/* Halaman 1: Kop Surat & Batang Tubuh I - VII */}
      <article className="a4-sheet font-official-doc text-[11pt] text-[#0F172A]">
        {/* Kop Surat Resmi */}
        <header className="grid grid-cols-[74px_1fr_74px] items-center gap-3 pb-3 border-b-[3px] border-double border-slate-950">
          <div className="flex items-center justify-center">
            <KopLogo />
          </div>
          <div className="text-center">
            <p className="text-[12pt] font-bold tracking-wide uppercase leading-tight">
              {report.namaKabupaten || 'PEMERINTAH KABUPATEN'}
            </p>
            <h1 className="text-[15.5pt] font-bold tracking-wider uppercase leading-tight mt-0.5">
              {report.namaKecamatan || 'KECAMATAN'}
            </h1>
            <p className="text-[9pt] text-slate-700 leading-snug mt-1">
              {report.alamatKecamatan || 'Alamat Kantor Kecamatan'}
            </p>
          </div>
          <div aria-hidden="true" />
        </header>
        <div className="border-b border-slate-950 mt-[2px] mb-5" />

        {/* Judul Dokumen */}
        <div className="text-center mb-6">
          <h2 className="text-[12.5pt] font-bold uppercase underline underline-offset-4 tracking-wide">
            LAPORAN PERJALANAN DINAS
          </h2>
          <p className="text-[10.5pt] mt-1">
            Berdasarkan SPT Nomor:{' '}
            <span className="font-semibold">{report.nomorSpt || '........................................'}</span>
          </p>
        </div>

        {/* Batang Tubuh I s.d. VII */}
        <div className="space-y-4 text-[10.8pt]">
          {/* I. PENDAHULUAN / DASAR */}
          <section>
            <h3 className="font-bold uppercase tracking-tight mb-1">
              I. PENDAHULUAN / DASAR
            </h3>
            <div className="pl-6 space-y-1.5">
              <p className="font-semibold text-justify leading-[1.55]">
                Surat Perintah Tugas (SPT) Nomor {report.nomorSpt || '-'} tanggal{' '}
                {report.tanggalSpt || '-'}.
              </p>
              {renderLines(report.dasarHukum)}
            </div>
          </section>

          {/* II. MAKSUD DAN TUJUAN */}
          <section>
            <h3 className="font-bold uppercase tracking-tight mb-1">
              II. MAKSUD DAN TUJUAN
            </h3>
            <div className="pl-6">
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="align-top">
                    <td className="w-40 py-0.5">Tujuan / Lokasi</td>
                    <td className="w-4 py-0.5">:</td>
                    <td className="py-0.5 text-justify">{report.tujuan || '-'}</td>
                  </tr>
                  <tr className="align-top">
                    <td className="w-40 py-0.5">Maksud Perjalanan</td>
                    <td className="w-4 py-0.5">:</td>
                    <td className="py-0.5 text-justify">{report.maksudPerjalanan || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* III. WAKTU PELAKSANAAN */}
          <section>
            <h3 className="font-bold uppercase tracking-tight mb-1">
              III. WAKTU PELAKSANAAN
            </h3>
            <div className="pl-6">
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="align-top">
                    <td className="w-40 py-0.5">Tanggal Berangkat</td>
                    <td className="w-4 py-0.5">:</td>
                    <td className="py-0.5">{report.tanggalBerangkat || report.tanggalSpt || '-'}</td>
                  </tr>
                  <tr className="align-top">
                    <td className="w-40 py-0.5">Tanggal Kembali</td>
                    <td className="w-4 py-0.5">:</td>
                    <td className="py-0.5">{report.tanggalKembali || report.tanggalSpt || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* IV. PETUGAS YANG MELAKSANAKAN */}
          <section>
            <h3 className="font-bold uppercase tracking-tight mb-1">
              IV. PETUGAS YANG MELAKSANAKAN
            </h3>
            <div className="pl-6">
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="align-top">
                    <td className="w-40 py-0.5">Nama Pegawai</td>
                    <td className="w-4 py-0.5">:</td>
                    <td className="py-0.5 font-semibold">{report.namaPegawai || '-'}</td>
                  </tr>
                  <tr className="align-top">
                    <td className="w-40 py-0.5">NIP</td>
                    <td className="w-4 py-0.5">:</td>
                    <td className="py-0.5 tabular-nums">{report.nip || '-'}</td>
                  </tr>
                  <tr className="align-top">
                    <td className="w-40 py-0.5">Pangkat / Golongan</td>
                    <td className="w-4 py-0.5">:</td>
                    <td className="py-0.5">{report.pangkatGolongan || '-'}</td>
                  </tr>
                  <tr className="align-top">
                    <td className="w-40 py-0.5">Jabatan</td>
                    <td className="w-4 py-0.5">:</td>
                    <td className="py-0.5">{report.jabatan || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* V. HASIL PELAKSANAAN KEGIATAN */}
          <section>
            <h3 className="font-bold uppercase tracking-tight mb-1">
              V. HASIL PELAKSANAAN KEGIATAN
            </h3>
            <div className="pl-6">{renderLines(report.hasilPelaksanaan)}</div>
          </section>

          {/* VI. KESIMPULAN DAN SARAN */}
          <section>
            <h3 className="font-bold uppercase tracking-tight mb-1">
              VI. KESIMPULAN DAN SARAN
            </h3>
            <div className="pl-6">{renderLines(report.kesimpulanSaran)}</div>
          </section>

          {/* VII. PENUTUP */}
          <section>
            <h3 className="font-bold uppercase tracking-tight mb-1">
              VII. PENUTUP
            </h3>
            <div className="pl-6">{renderLines(report.penutup)}</div>
          </section>
        </div>

        {/* Blok Tanggal & Tanda Tangan Pejabat */}
        <footer className="mt-10 grid grid-cols-2 gap-8 text-[10.5pt] break-inside-avoid">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p className="font-bold">Camat {kecamatanShort}</p>
            <div className="h-20" />
            <p className="font-bold underline underline-offset-2">
              {report.namaCamat || '........................................'}
            </p>
            {report.pangkatCamat && <p className="text-[9.8pt]">{report.pangkatCamat}</p>}
            <p className="text-[9.8pt] tabular-nums">NIP. {report.nipCamat || '-'}</p>
          </div>

          <div className="text-center">
            <p>
              {report.tempatLaporan || kecamatanShort},{' '}
              {report.tanggalLaporan || report.tanggalSpt || '....................'}
            </p>
            <p className="font-bold">Pelaksana Perjalanan Dinas,</p>
            <div className="h-20" />
            <p className="font-bold underline underline-offset-2">
              {report.namaPegawai || '........................................'}
            </p>
            {report.pangkatGolongan && <p className="text-[9.8pt]">{report.pangkatGolongan}</p>}
            <p className="text-[9.8pt] tabular-nums">NIP. {report.nip || '-'}</p>
          </div>
        </footer>
      </article>

      {/* Halaman 2: Lampiran Dokumentasi Kegiatan (Maksimal 4 Foto) */}
      <article className="a4-sheet font-official-doc text-[11pt] text-[#0F172A] print-page-break">
        <div className="text-center mb-6 pb-3 border-b border-slate-300">
          <h2 className="text-[12pt] font-bold uppercase underline underline-offset-4 tracking-wide">
            LAMPIRAN DOKUMENTASI KEGIATAN
          </h2>
          <p className="text-[10pt] text-slate-700 mt-1">
            Laporan Perjalanan Dinas — SPT Nomor: {report.nomorSpt || '-'}
          </p>
        </div>

        {report.photos && report.photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-5">
            {report.photos.slice(0, 4).map((photo, idx) => (
              <PhotoPreviewCard
                key={photo.id}
                index={idx}
                src={photo.dataUrl}
                caption={photo.caption}
                name={photo.name}
              />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-slate-300 rounded-md py-16 px-6 text-center text-slate-500 font-sans">
            <p className="text-sm font-medium text-slate-600">
              Belum ada foto dokumentasi yang dilampirkan.
            </p>
            <p className="text-xs mt-1">
              Unggah maksimal 4 foto kegiatan (JPG/PNG) pada panel formulir di sebelah kiri untuk menampilkan galeri lampiran resmi.
            </p>
          </div>
        )}
      </article>
    </div>
  );
};

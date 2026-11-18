import React from 'react';
import { FileText, Lock, Printer, ShieldCheck, Upload } from 'lucide-react';

export const GuidePanel: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="bg-white border border-[#D8E0EB] rounded-lg p-6 md:p-8 space-y-6">
        <div className="border-b border-[#E2E8F0] pb-4">
          <h2 className="text-xl font-bold text-[#0F172A]">
            Panduan Alur Kerja SILAPER Kecamatan
          </h2>
          <p className="text-sm text-[#475569] mt-1">
            Standar otomasi penyusunan Laporan Perjalanan Dinas berdasarkan Surat Perintah Tugas (SPT) dan Tata Naskah Dinas Pemerintah Daerah.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-[#E2E8F0] rounded-md p-4">
            <div className="flex items-center gap-2 text-[#0F2A56] font-semibold text-sm mb-2">
              <FileText className="w-4 h-4" />
              01. Ekstraksi Otomatis PDF SPT
            </div>
            <p className="text-xs text-[#475569] leading-relaxed">
              Unggah file PDF Surat Perintah Tugas resmi pada panel kiri. Sistem membaca Nomor SPT, Tanggal SPT, Dasar Hukum, Nama Pegawai, NIP, Pangkat/Golongan, Jabatan, Tujuan, dan Maksud Perjalanan secara otomatis.
            </p>
          </div>

          <div className="border border-[#E2E8F0] rounded-md p-4">
            <div className="flex items-center gap-2 text-[#0F2A56] font-semibold text-sm mb-2">
              <Lock className="w-4 h-4" />
              02. Kunci Pengaman & Tombol Ubah Data
            </div>
            <p className="text-xs text-[#475569] leading-relaxed">
              Secara bawaan groupbox 04 &amp; 05 disembunyikan agar Live Preview A4 lebih mudah terlihat dan aman dari salah ketik. Tekan tombol &ldquo;Ubah Data&rdquo; untuk menampilkan dan menyunting seluruh kolom secara manual.
            </p>
          </div>

          <div className="border border-[#E2E8F0] rounded-md p-4">
            <div className="flex items-center gap-2 text-[#0F2A56] font-semibold text-sm mb-2">
              <Upload className="w-4 h-4" />
              03. Lampiran Maksimal 4 Foto (JPG/PNG)
            </div>
            <p className="text-xs text-[#475569] leading-relaxed">
              Unggah hingga 4 foto dokumentasi kegiatan lapangan. Setiap foto otomatis dikompres dan ditata menjadi galeri grid 2×2 pada halaman Lampiran dokumen A4, lengkap dengan keterangan kegiatan.
            </p>
          </div>

          <div className="border border-[#E2E8F0] rounded-md p-4">
            <div className="flex items-center gap-2 text-[#0F2A56] font-semibold text-sm mb-2">
              <Printer className="w-4 h-4" />
              04. Ekspor DOCX, PDF, & Cetak Langsung
            </div>
            <p className="text-xs text-[#475569] leading-relaxed">
              Unduh laporan sebagai dokumen Word (.DOCX) apabila memerlukan penyesuaian lanjutan, unduh PDF siap cetak, atau gunakan Cetak / Print langsung dengan format kertas A4 standar instansi.
            </p>
          </div>
        </div>

        <div className="border border-[#BFDBFE] bg-[#EFF6FF]/60 rounded-md p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#0F2A56] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">
              Kerahasiaan Arsip Berbasis Autentikasi Staf
            </h3>
            <p className="text-xs text-[#475569] mt-1 leading-relaxed">
              Masuk menggunakan akun resmi (NIP atau Email dan Kata Sandi) yang dibuat oleh Administrator untuk menyimpan laporan ke menu SPD. Setiap dokumen dilindungi aturan keamanan database sehingga hanya pemilik akun bersangkutan yang dapat membaca, menyunting, atau menghapus laporannya.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

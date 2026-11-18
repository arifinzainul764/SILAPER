const DEFAULT_EMBLEM_SVG = `<svg viewBox="0 0 80 92" width="160" height="184" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M40 4L72 14V44C72 64.5 57.5 80.2 40 88C22.5 80.2 8 64.5 8 44V14L40 4Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.5"/>
  <path d="M40 10L66 18.2V43.8C66 60.8 54 74 40 80.8C26 74 14 60.8 14 43.8V18.2L40 10Z" fill="#F8FAFC" stroke="#0F172A" stroke-width="1.2"/>
  <path d="M40 17L42.2 22.8L48.4 23L43.5 26.8L45.2 32.7L40 29.3L34.8 32.7L36.5 26.8L31.6 23L37.8 22.8L40 17Z" fill="#0F172A"/>
  <path d="M23 35C21 48 26 60 37 67" stroke="#0F172A" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M57 35C59 48 54 60 43 67" stroke="#0F172A" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M36 60H44V41L40 35L36 41V60Z" fill="#0F172A"/>
  <path d="M31 63H49V60H31V63Z" fill="#0F172A"/>
  <path d="M24 68H56V74H24V68Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.3"/>
</svg>`;

export async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid.'));
      img.onload = () => {
        const maxW = 900;
        const maxH = 675;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        const ratio = Math.min(1, maxW / width, maxH / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let result = canvas.toDataURL('image/jpeg', 0.76);
        if (result.length > 180000) {
          result = canvas.toDataURL('image/jpeg', 0.56);
        }
        if (result.length > 210000) {
          const smaller = document.createElement('canvas');
          smaller.width = Math.round(width * 0.75);
          smaller.height = Math.round(height * 0.75);
          const sCtx = smaller.getContext('2d');
          if (sCtx) {
            sCtx.fillStyle = '#FFFFFF';
            sCtx.fillRect(0, 0, smaller.width, smaller.height);
            sCtx.drawImage(canvas, 0, 0, smaller.width, smaller.height);
            result = smaller.toDataURL('image/jpeg', 0.55);
          }
        }
        resolve(result);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export interface ExportImagePayload {
  bytes: Uint8Array;
  dataUrl: string;
  width: number;
  height: number;
  format: 'JPEG' | 'PNG';
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64Part = dataUrl.split(',')[1] || '';
  const binary = atob(base64Part);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function loadImageForExport(src: string): Promise<ExportImagePayload> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/png')) {
      resolve(src);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error(`Gagal memuat gambar: ${src}`));
    img.src = src;
  });

  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
    img.onerror = () => resolve({ width: 800, height: 600 });
    img.src = dataUrl;
  });

  const format: 'JPEG' | 'PNG' = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';

  return {
    bytes: dataUrlToBytes(dataUrl),
    dataUrl,
    width: dims.width,
    height: dims.height,
    format,
  };
}

export async function loadDefaultEmblemForExport(): Promise<ExportImagePayload> {
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DEFAULT_EMBLEM_SVG)}`;
  const pngDataUrl = await new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 184;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Gagal merender logo instansi default'));
    img.src = svgDataUrl;
  });

  return {
    bytes: dataUrlToBytes(pngDataUrl),
    dataUrl: pngDataUrl,
    width: 160,
    height: 184,
    format: 'PNG',
  };
}

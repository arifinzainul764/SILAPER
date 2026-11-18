import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface KopLogoScanOptions {
  logoBox?: unknown;
  logoBoxScope?: 'kop' | 'page';
  hasKopLogo?: unknown;
}

export interface PreparedPdfExtraction {
  page1Canvas: HTMLCanvasElement | null;
  extractedText: string;
  kopImageBase64: string;
  pageImagesBase64: string[];
  logoBoxScope: 'kop' | 'page';
}

const KOP_CROP_HEIGHT_RATIO = 0.28;

function isInkPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 25) return false;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const saturation = maxC - minC;
  const brightness = (r + g + b) / 3;
  return brightness < 235 || saturation > 18;
}

function isDarkNeutralPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 40) return false;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const saturation = maxC - minC;
  const brightness = (r + g + b) / 3;
  return brightness < 165 && saturation < 28;
}

export interface KopBannerScanOptions {
  kopBox?: unknown;
  logoBoxScope?: 'kop' | 'page';
}

interface KopDividerBand {
  dTop: number;
  dBottom: number;
  ruleMinX: number;
  ruleMaxX: number;
}

/**
 * Detects the top & bottom Y coordinates (and horizontal span) of the Kop Surat
 * horizontal divider rule (single, double, or thick-thin) on page 1.
 */
function detectKopDividerBand(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): KopDividerBand | null {
  const startY = Math.floor(height * 0.05);
  const endY = Math.floor(height * 0.32);
  const startX = Math.floor(width * 0.05);
  const endX = Math.floor(width * 0.95);
  const spanW = endX - startX;
  if (spanW <= 40 || endY <= startY) return null;

  const imgData = ctx.getImageData(startX, startY, spanW, endY - startY);
  const { data } = imgData;

  const midOffsetStart = Math.floor(width * 0.28) - startX;
  const midOffsetEnd = Math.floor(width * 0.86) - startX;

  const analyzeRow = (row: number) => {
    let darkColsFull = 0;
    let totalSamplesFull = 0;
    let darkColsMid = 0;
    let totalSamplesMid = 0;
    let firstDarkX = -1;
    let lastDarkX = -1;

    for (let col = 0; col < spanW; col += 2) {
      const idx = (row * spanW + col) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const isDark = data[idx + 3] >= 40 && brightness < 195;
      totalSamplesFull++;
      if (isDark) {
        darkColsFull++;
        if (firstDarkX === -1) firstDarkX = startX + col;
        lastDarkX = startX + col;
      }

      if (col >= midOffsetStart && col <= midOffsetEnd) {
        totalSamplesMid++;
        if (isDark) darkColsMid++;
      }
    }

    const fullRatio = darkColsFull / Math.max(1, totalSamplesFull);
    const midRatio = darkColsMid / Math.max(1, totalSamplesMid);
    const isRuleRow = fullRatio > 0.55 || midRatio > 0.70;
    return { isRuleRow, firstDarkX, lastDarkX };
  };

  const totalRows = endY - startY;
  for (let row = 0; row < totalRows; row++) {
    const first = analyzeRow(row);
    if (!first.isRuleRow) continue;

    const dTop = startY + row;
    let dBottom = dTop;
    let ruleMinX = first.firstDarkX >= 0 ? first.firstDarkX : startX;
    let ruleMaxX = first.lastDarkX >= 0 ? first.lastDarkX : endX;

    // Scan slightly below dTop to include thick or double horizontal divider rules
    const lookaheadEnd = Math.min(totalRows - 1, row + 26);
    for (let r2 = row + 1; r2 <= lookaheadEnd; r2++) {
      if (startY + r2 - dBottom > 12) break;
      const sub = analyzeRow(r2);
      if (sub.isRuleRow) {
        dBottom = startY + r2;
        if (sub.firstDarkX >= 0) ruleMinX = Math.min(ruleMinX, sub.firstDarkX);
        if (sub.lastDarkX >= 0) ruleMaxX = Math.max(ruleMaxX, sub.lastDarkX);
      }
    }

    return { dTop, dBottom, ruleMinX, ruleMaxX };
  }

  return null;
}

function stripEdgeHorizontalRules(
  data: Uint8ClampedArray,
  roiW: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): { minX: number; minY: number; maxX: number; maxY: number } {
  let { minX, minY, maxX, maxY } = bounds;
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  if (boxW < 16 || boxH < 16) return bounds;

  const rowDarkCount: number[] = [];
  const rowInkCount: number[] = [];
  const rowSpanRatio: number[] = [];

  for (let py = minY; py <= maxY; py++) {
    let darkNeutral = 0;
    let ink = 0;
    let firstInk = -1;
    let lastInk = -1;
    for (let px = minX; px <= maxX; px++) {
      const idx = (py * roiW + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (isInkPixel(r, g, b, a)) {
        ink++;
        if (firstInk === -1) firstInk = px;
        lastInk = px;
      }
      if (isDarkNeutralPixel(r, g, b, a)) {
        darkNeutral++;
      }
    }
    rowDarkCount.push(darkNeutral);
    rowInkCount.push(ink);
    rowSpanRatio.push(firstInk >= 0 ? (lastInk - firstInk + 1) / boxW : 0);
  }

  const len = rowInkCount.length;

  // Case A: Whitespace gap followed by wide thin horizontal rule near bottom
  const bottomSearchStart = Math.max(Math.floor(len * 0.68), len - 28);
  for (let i = len - 1; i >= bottomSearchStart; i--) {
    const isGapRow = rowInkCount[i] <= Math.max(1, Math.floor(boxW * 0.03));
    if (isGapRow) {
      const belowHeight = len - 1 - i;
      if (belowHeight >= 1 && belowHeight <= 16) {
        const belowSlice = rowDarkCount.slice(i + 1);
        const belowSpans = rowSpanRatio.slice(i + 1);
        const avgSpan =
          belowSpans.reduce((acc, v) => acc + v, 0) / Math.max(1, belowSpans.length);
        const maxDarkRatio = Math.max(...belowSlice.map((d) => d / boxW), 0);
        if (avgSpan >= 0.65 && maxDarkRatio >= 0.55) {
          maxY = minY + i - 1;
          break;
        }
      }
    }
  }

  // Case B: Full-width solid dark neutral rule touching bottom edge
  let cutBottom = maxY;
  const maxStripRows = Math.min(14, Math.floor((maxY - minY + 1) * 0.16));
  let matchedRuleRows = 0;

  for (let offset = 0; offset < maxStripRows; offset++) {
    const idx = cutBottom - minY;
    if (idx < 8) break;
    const darkRatio = rowDarkCount[idx] / boxW;
    const spanRatio = rowSpanRatio[idx];
    if (darkRatio >= 0.72 && spanRatio >= 0.84) {
      matchedRuleRows++;
      cutBottom--;
    } else {
      break;
    }
  }

  if (matchedRuleRows > 0 && cutBottom - minY >= 12) {
    const checkStart = Math.max(0, cutBottom - minY - 6);
    const checkEnd = cutBottom - minY;
    let narrowerRows = 0;
    for (let j = checkStart; j <= checkEnd; j++) {
      if (rowDarkCount[j] / boxW < 0.62 || rowSpanRatio[j] < 0.82) {
        narrowerRows++;
      }
    }
    if (narrowerRows >= 2) {
      maxY = cutBottom;
    }
  }

  while (maxY > minY) {
    const idx = maxY - minY;
    if (idx < rowInkCount.length && rowInkCount[idx] === 0) {
      maxY--;
    } else {
      break;
    }
  }

  return { minX, minY, maxX, maxY };
}

function extractEmblemBoundsInRegion(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number; w: number; h: number; inkRatio: number } | null {
  const rx = Math.max(0, Math.floor(x0));
  const ry = Math.max(0, Math.floor(y0));
  const rw = Math.max(1, Math.ceil(x1) - rx);
  const rh = Math.max(1, Math.ceil(y1) - ry);
  if (rw < 16 || rh < 16) return null;

  const imgData = ctx.getImageData(rx, ry, rw, rh);
  const { data } = imgData;

  const mask = new Uint8Array(rw * rh);
  for (let py = 0; py < rh; py++) {
    for (let px = 0; px < rw; px++) {
      const idx = (py * rw + px) * 4;
      if (isInkPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
        mask[py * rw + px] = 1;
      }
    }
  }

  const visited = new Uint8Array(rw * rh);
  const queue = new Int32Array(rw * rh);

  interface Component {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    w: number;
    h: number;
    inkCount: number;
  }

  const components: Component[] = [];
  const dx8 = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy8 = [-1, -1, -1, 0, 0, 1, 1, 1];

  for (let i = 0; i < rw * rh; i++) {
    if (!mask[i] || visited[i]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    visited[i] = 1;

    let minX = rw;
    let minY = rh;
    let maxX = -1;
    let maxY = -1;
    let inkCount = 0;

    while (head < tail) {
      const curr = queue[head++];
      const cx = curr % rw;
      const cy = Math.floor(curr / rw);
      inkCount++;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      for (let d = 0; d < 8; d++) {
        const nx = cx + dx8[d];
        const ny = cy + dy8[d];
        if (nx < 0 || nx >= rw || ny < 0 || ny >= rh) continue;
        const nIdx = ny * rw + nx;
        if (!visited[nIdx] && mask[nIdx]) {
          visited[nIdx] = 1;
          queue[tail++] = nIdx;
        }
      }
    }

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const aspect = w / Math.max(1, h);

    const isHorizontalRule =
      (h <= Math.max(14, rh * 0.09) && aspect >= 3.4) ||
      (w >= rw * 0.7 && h <= 16 && aspect >= 2.8);

    if (isHorizontalRule || inkCount < 12) {
      continue;
    }

    components.push({ minX, minY, maxX, maxY, w, h, inkCount });
  }

  if (components.length === 0) return null;

  let primary: Component | null = null;
  for (const comp of components) {
    const aspect = comp.w / Math.max(1, comp.h);
    if (aspect < 0.35 || aspect > 2.5) continue;
    if (!primary || comp.inkCount > primary.inkCount) {
      primary = comp;
    }
  }

  if (!primary) return null;

  let mergedMinX = primary.minX;
  let mergedMinY = primary.minY;
  let mergedMaxX = primary.maxX;
  let mergedMaxY = primary.maxY;
  let totalInk = primary.inkCount;

  const horizMargin = primary.w * 0.16;
  const vertMargin = primary.h * 0.22;

  for (const comp of components) {
    if (comp === primary) continue;
    const withinX =
      comp.minX >= primary.minX - horizMargin && comp.maxX <= primary.maxX + horizMargin;
    const withinY =
      comp.minY >= primary.minY - vertMargin && comp.maxY <= primary.maxY + vertMargin;
    const aspect = comp.w / Math.max(1, comp.h);

    if (withinX && withinY && aspect <= 3.2) {
      mergedMinX = Math.min(mergedMinX, comp.minX);
      mergedMinY = Math.min(mergedMinY, comp.minY);
      mergedMaxX = Math.max(mergedMaxX, comp.maxX);
      mergedMaxY = Math.max(mergedMaxY, comp.maxY);
      totalInk += comp.inkCount;
    }
  }

  const stripped = stripEdgeHorizontalRules(data, rw, {
    minX: mergedMinX,
    minY: mergedMinY,
    maxX: mergedMaxX,
    maxY: mergedMaxY,
  });

  const finalW = stripped.maxX - stripped.minX + 1;
  const finalH = stripped.maxY - stripped.minY + 1;
  if (finalW < 16 || finalH < 16) return null;

  const inkRatio = Math.min(1, totalInk / Math.max(1, finalW * finalH));

  return {
    x: rx + stripped.minX,
    y: ry + stripped.minY,
    w: finalW,
    h: finalH,
    inkRatio,
  };
}

function detectFallbackKopEmblemBox(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  dividerY: number | null,
): { x: number; y: number; w: number; h: number } | null {
  const roiX0 = Math.floor(pageW * 0.025);
  const roiX1 = Math.floor(pageW * 0.25);
  const roiY0 = Math.floor(pageH * 0.015);
  const roiY1 = Math.min(
    Math.floor(pageH * 0.25),
    dividerY !== null ? Math.max(roiY0 + 30, dividerY - 4) : Math.floor(pageH * 0.25),
  );

  const roiW = roiX1 - roiX0;
  const roiH = roiY1 - roiY0;
  if (roiW < 30 || roiH < 30) return null;

  const imgData = ctx.getImageData(roiX0, roiY0, roiW, roiH);
  const { data } = imgData;

  const step = 2;
  const gw = Math.floor(roiW / step);
  const gh = Math.floor(roiH / step);
  if (gw < 10 || gh < 10) return null;

  const mask = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let hasInk = false;
      for (let dy = 0; dy < step && !hasInk; dy++) {
        for (let dx = 0; dx < step; dx++) {
          const px = gx * step + dx;
          const py = gy * step + dy;
          const idx = (py * roiW + px) * 4;
          if (isInkPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
            hasInk = true;
            break;
          }
        }
      }
      if (hasInk) mask[gy * gw + gx] = 1;
    }
  }

  const dilated = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (!mask[gy * gw + gx]) continue;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = gx + ox;
          const ny = gy + oy;
          if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) {
            dilated[ny * gw + nx] = 1;
          }
        }
      }
    }
  }

  const visited = new Uint8Array(gw * gh);
  const queue = new Int32Array(gw * gh);

  let bestComponent: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    area: number;
  } | null = null;

  for (let i = 0; i < gw * gh; i++) {
    if (!dilated[i] || visited[i]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    visited[i] = 1;

    let minX = gw;
    let minY = gh;
    let maxX = -1;
    let maxY = -1;
    let inkCells = 0;

    while (head < tail) {
      const curr = queue[head++];
      const cx = curr % gw;
      const cy = Math.floor(curr / gw);
      if (mask[curr]) inkCells++;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      const neighbors = [curr - 1, curr + 1, curr - gw, curr + gw];
      for (const n of neighbors) {
        if (n < 0 || n >= gw * gh || visited[n] || !dilated[n]) continue;
        const nx = n % gw;
        if (Math.abs(nx - cx) > 1) continue;
        visited[n] = 1;
        queue[tail++] = n;
      }
    }

    const compW = (maxX - minX + 1) * step;
    const compH = (maxY - minY + 1) * step;
    const aspect = compW / Math.max(1, compH);

    if (
      compW >= pageW * 0.032 &&
      compH >= pageH * 0.032 &&
      compW <= pageW * 0.22 &&
      compH <= pageH * 0.22 &&
      aspect >= 0.45 &&
      aspect <= 2.1 &&
      inkCells >= 40
    ) {
      if (!bestComponent || inkCells > bestComponent.area) {
        bestComponent = { minX, minY, maxX, maxY, area: inkCells };
      }
    }
  }

  if (!bestComponent) return null;

  return {
    x: roiX0 + bestComponent.minX * step,
    y: roiY0 + bestComponent.minY * step,
    w: (bestComponent.maxX - bestComponent.minX + 1) * step,
    h: (bestComponent.maxY - bestComponent.minY + 1) * step,
  };
}

function parseNormalizedLogoBox(
  rawBox: unknown,
  scope: 'kop' | 'page' = 'page',
): [number, number, number, number] | null {
  if (!Array.isArray(rawBox) || rawBox.length !== 4) return null;
  const nums = rawBox.map((n) => Number(n));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  let [ymin, xmin, ymax, xmax] = nums;
  if (ymin < 0 || xmin < 0 || ymax <= ymin || xmax <= xmin) return null;

  if (scope === 'kop') {
    ymin = ymin * KOP_CROP_HEIGHT_RATIO;
    ymax = ymax * KOP_CROP_HEIGHT_RATIO;
  }

  if (ymax > 400 || xmax > 450) return null;
  if (ymax - ymin < 18 || xmax - xmin < 18) return null;
  return [ymin, xmin, ymax, xmax];
}

function encodeCroppedLogo(
  sourceCanvas: HTMLCanvasElement,
  box: { x: number; y: number; w: number; h: number },
): string {
  const sx = Math.max(0, Math.floor(box.x));
  const sy = Math.max(0, Math.floor(box.y));
  const sw = Math.min(sourceCanvas.width - sx, Math.ceil(box.w));
  const sh = Math.min(sourceCanvas.height - sy, Math.ceil(box.h));
  if (sw < 16 || sh < 16) return '';

  const pad = 6;
  const maxInnerDim = 248;
  const scale = Math.min(1, maxInnerDim / Math.max(sw, sh));
  const innerW = Math.max(24, Math.round(sw * scale));
  const innerH = Math.max(24, Math.round(sh * scale));
  const outW = innerW + pad * 2;
  const outH = innerH + pad * 2;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return '';

  outCtx.fillStyle = '#FFFFFF';
  outCtx.fillRect(0, 0, outW, outH);
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(sourceCanvas, sx, sy, sw, sh, pad, pad, innerW, innerH);

  let dataUrl = outCanvas.toDataURL('image/png');
  if (dataUrl.length > 180000) {
    dataUrl = outCanvas.toDataURL('image/jpeg', 0.85);
  }
  if (dataUrl.length > 205000) {
    dataUrl = outCanvas.toDataURL('image/jpeg', 0.7);
  }

  return dataUrl.length <= 215000 ? dataUrl : '';
}

async function renderPdfPageToCanvas(
  page: pdfjsLib.PDFPageProxy,
  targetWidth: number,
): Promise<HTMLCanvasElement | null> {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2.4, Math.max(1.1, targetWidth / Math.max(1, baseViewport.width)));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise;

  return canvas;
}

async function extractPageTextOrdered(page: pdfjsLib.PDFPageProxy): Promise<string> {
  const content = await page.getTextContent();
  interface TextItemChunk {
    str: string;
    x: number;
    y: number;
  }

  const chunks: TextItemChunk[] = [];
  for (const item of content.items) {
    if (!item || typeof item !== 'object' || !('str' in item)) continue;
    const rawStr = String((item as { str?: unknown }).str || '');
    if (!rawStr.trim()) continue;
    const transform = (item as { transform?: number[] }).transform;
    const x = Array.isArray(transform) && typeof transform[4] === 'number' ? transform[4] : 0;
    const y = Array.isArray(transform) && typeof transform[5] === 'number' ? transform[5] : 0;
    chunks.push({ str: rawStr, x, y });
  }

  if (chunks.length === 0) return '';

  // Sort top-to-bottom (higher PDF Y first), then left-to-right
  chunks.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: TextItemChunk[][] = [];
  const yTolerance = 4.5;

  for (const chunk of chunks) {
    const lastLine = lines[lines.length - 1];
    if (!lastLine) {
      lines.push([chunk]);
      continue;
    }
    const lineY = lastLine[0].y;
    if (Math.abs(lineY - chunk.y) <= yTolerance) {
      lastLine.push(chunk);
    } else {
      lines.push([chunk]);
    }
  }

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      return line
        .map((c) => c.str.trim())
        .filter(Boolean)
        .join(' ');
    })
    .filter(Boolean)
    .join('\n');
}

function canvasToCompactJpegBase64(
  sourceCanvas: HTMLCanvasElement,
  cropHeightRatio = 1,
  maxWidth = 1100,
  quality = 0.74,
): string {
  const srcW = sourceCanvas.width;
  const srcH = Math.max(1, Math.round(sourceCanvas.height * cropHeightRatio));
  const scale = Math.min(1, maxWidth / Math.max(1, srcW));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return '';

  outCtx.fillStyle = '#FFFFFF';
  outCtx.fillRect(0, 0, outW, outH);
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(sourceCanvas, 0, 0, srcW, srcH, 0, 0, outW, outH);

  const dataUrl = outCanvas.toDataURL('image/jpeg', quality);
  return dataUrl.replace(/^data:[^;]*;base64,/, '');
}

/**
 * Prepares lightweight extraction inputs from SPT.PDF in the browser (~150-350ms):
 * - Renders Page 1 at 1400px for crisp Kop logo scanning.
 * - Extracts ordered text from pages 1-4 (for instant 1-2s Gemini text extraction).
 * - Creates a tiny ~20KB Kop strip JPEG for logoBox confirmation, or compact page JPEGs
 *   if the PDF is a scanned image-only document without selectable text.
 */
export async function preparePdfForExtraction(file: File): Promise<PreparedPdfExtraction> {
  let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
  let pdf: pdfjsLib.PDFDocumentProxy | null = null;

  try {
    const buffer = await file.arrayBuffer();
    loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    pdf = await loadingTask.promise;
    if (pdf.numPages < 1) {
      return {
        page1Canvas: null,
        extractedText: '',
        kopImageBase64: '',
        pageImagesBase64: [],
        logoBoxScope: 'page',
      };
    }

    const maxPagesToRead = Math.min(4, pdf.numPages);
    const textPages: string[] = [];
    let page1Canvas: HTMLCanvasElement | null = null;

    for (let pageNum = 1; pageNum <= maxPagesToRead; pageNum++) {
      const page = await pdf.getPage(pageNum);
      if (pageNum === 1) {
        page1Canvas = await renderPdfPageToCanvas(page, 1400);
      }
      const text = await extractPageTextOrdered(page);
      if (text) {
        textPages.push(text);
      }
    }

    const extractedText = textPages.join('\n\n--- HALAMAN BERIKUTNYA ---\n\n').slice(0, 18000);
    const hasDigitalText = extractedText.replace(/\s+/g, '').length >= 120;

    if (hasDigitalText) {
      const kopImageBase64 = page1Canvas
        ? canvasToCompactJpegBase64(page1Canvas, KOP_CROP_HEIGHT_RATIO, 680, 0.68)
        : '';
      return {
        page1Canvas,
        extractedText,
        kopImageBase64,
        pageImagesBase64: [],
        logoBoxScope: 'kop',
      };
    }

    // Scanned / image-only PDF: send up to 2 compact page JPEGs for fast multimodal extraction
    const pageImagesBase64: string[] = [];
    if (page1Canvas) {
      const img1 = canvasToCompactJpegBase64(page1Canvas, 1, 1050, 0.7);
      if (img1) pageImagesBase64.push(img1);
    }
    if (pdf.numPages >= 2) {
      const page2 = await pdf.getPage(2);
      const page2Canvas = await renderPdfPageToCanvas(page2, 980);
      if (page2Canvas) {
        const img2 = canvasToCompactJpegBase64(page2Canvas, 1, 960, 0.66);
        if (img2) pageImagesBase64.push(img2);
      }
    }

    return {
      page1Canvas,
      extractedText,
      kopImageBase64: '',
      pageImagesBase64,
      logoBoxScope: 'page',
    };
  } catch (err) {
    console.warn('[PDF Logo Scanner] Gagal memproses pra-ekstraksi PDF di browser:', err);
    return {
      page1Canvas: null,
      extractedText: '',
      kopImageBase64: '',
      pageImagesBase64: [],
      logoBoxScope: 'page',
    };
  } finally {
    if (pdf) {
      await pdf.cleanup().catch(() => {});
    }
    if (loadingTask) {
      await loadingTask.destroy().catch(() => {});
    }
  }
}

export async function renderPdfFirstPageToCanvas(file: File): Promise<HTMLCanvasElement | null> {
  const prepared = await preparePdfForExtraction(file);
  return prepared.page1Canvas;
}

export function extractKopLogoFromCanvas(
  canvas: HTMLCanvasElement | null,
  options?: KopLogoScanOptions,
): string {
  if (!canvas) return '';
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const pageW = canvas.width;
  const pageH = canvas.height;
  const dividerBand = detectKopDividerBand(ctx, pageW, pageH);
  const dividerY = dividerBand ? dividerBand.dTop : null;
  const normalizedBox = parseNormalizedLogoBox(options?.logoBox, options?.logoBoxScope || 'page');

  if (normalizedBox) {
    const [ymin, xmin, ymax, xmax] = normalizedBox;
    const marginX = 0.006 * pageW;
    const marginTop = 0.006 * pageH;
    const marginBottom = 0.003 * pageH;
    const x0 = Math.max(0, (xmin / 1000) * pageW - marginX);
    const y0 = Math.max(0, (ymin / 1000) * pageH - marginTop);
    const x1 = Math.min(pageW, (xmax / 1000) * pageW + marginX);
    let y1 = Math.min(pageH, (ymax / 1000) * pageH + marginBottom);

    if (dividerY !== null && dividerY > y0 + 24) {
      y1 = Math.min(y1, dividerY - 3);
    }

    const isolated = extractEmblemBoundsInRegion(ctx, x0, y0, x1, y1);
    if (isolated) {
      const aspect = isolated.w / Math.max(1, isolated.h);
      if (
        isolated.w >= pageW * 0.025 &&
        isolated.h >= pageH * 0.025 &&
        aspect >= 0.4 &&
        aspect <= 2.2 &&
        isolated.inkRatio >= 0.04 &&
        isolated.inkRatio <= 0.96
      ) {
        const encoded = encodeCroppedLogo(canvas, isolated);
        if (encoded) return encoded;
      }
    }
  }

  if (options?.hasKopLogo === false && !normalizedBox) {
    return '';
  }

  const fallbackBox = detectFallbackKopEmblemBox(ctx, pageW, pageH, dividerY);
  if (!fallbackBox) return '';

  const isolatedFallback = extractEmblemBoundsInRegion(
    ctx,
    fallbackBox.x,
    fallbackBox.y,
    fallbackBox.x + fallbackBox.w,
    fallbackBox.y + fallbackBox.h,
  );
  if (!isolatedFallback) return '';

  return encodeCroppedLogo(canvas, isolatedFallback);
}

/**
 * Extracts the entire Kop Surat header banner (emblem + exact typography layout
 * + horizontal divider line(s)) from page 1 of the uploaded SPT.PDF so the
 * generated report reproduces the exact Kop Surat format.
 */
export function extractKopBannerFromCanvas(
  canvas: HTMLCanvasElement | null,
  options?: KopBannerScanOptions,
): string {
  if (!canvas) return '';
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const pageW = canvas.width;
  const pageH = canvas.height;
  const band = detectKopDividerBand(ctx, pageW, pageH);

  let cropBottomY: number | null = band ? Math.min(pageH - 1, band.dBottom + 2) : null;
  let hintTopY: number | null = null;
  let hintMinX: number | null = null;
  let hintMaxX: number | null = null;

  if (Array.isArray(options?.kopBox) && options.kopBox.length === 4) {
    const nums = options.kopBox.map((n) => Number(n));
    if (nums.every((n) => Number.isFinite(n))) {
      let [ymin, xmin, ymax, xmax] = nums;
      if ((options?.logoBoxScope || 'page') === 'kop') {
        ymin = ymin * KOP_CROP_HEIGHT_RATIO;
        ymax = ymax * KOP_CROP_HEIGHT_RATIO;
      }
      if (ymin >= 0 && xmin >= 0 && ymax > ymin + 25 && xmax > xmin + 120 && ymax <= 360) {
        hintTopY = Math.max(0, Math.floor((ymin / 1000) * pageH) - 4);
        hintMinX = Math.max(0, Math.floor((xmin / 1000) * pageW) - 6);
        hintMaxX = Math.min(pageW - 1, Math.ceil((xmax / 1000) * pageW) + 6);
        if (cropBottomY === null) {
          cropBottomY = Math.min(pageH - 1, Math.ceil((ymax / 1000) * pageH) + 3);
        }
      }
    }
  }

  if (cropBottomY === null) return '';

  const scanTopY =
    hintTopY !== null
      ? Math.max(Math.floor(pageH * 0.008), Math.min(hintTopY, Math.floor(pageH * 0.06)))
      : Math.floor(pageH * 0.01);
  const scanX0 = Math.floor(pageW * 0.025);
  const scanX1 = Math.ceil(pageW * 0.975);
  const scanW = scanX1 - scanX0;
  const scanH = cropBottomY - scanTopY + 1;
  if (scanW < 120 || scanH < 45 || scanH > pageH * 0.34) return '';

  const roi = ctx.getImageData(scanX0, scanTopY, scanW, scanH);
  const { data } = roi;

  let topInkRow = -1;
  let bottomInkRow = -1;
  let minInkCol = scanW;
  let maxInkCol = -1;

  for (let py = 0; py < scanH; py++) {
    let rowInk = 0;
    let firstCol = -1;
    let lastCol = -1;
    for (let px = 0; px < scanW; px++) {
      const idx = (py * scanW + px) * 4;
      if (isInkPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
        rowInk++;
        if (firstCol === -1) firstCol = px;
        lastCol = px;
      }
    }
    if (rowInk >= 4) {
      if (topInkRow === -1) topInkRow = py;
      bottomInkRow = py;
      if (firstCol >= 0 && firstCol < minInkCol) minInkCol = firstCol;
      if (lastCol > maxInkCol) maxInkCol = lastCol;
    }
  }

  if (topInkRow === -1 || bottomInkRow <= topInkRow) return '';

  const inkHeight = bottomInkRow - topInkRow + 1;
  if (inkHeight < pageH * 0.045 || inkHeight > pageH * 0.30) return '';

  let sx = scanX0 + Math.max(0, minInkCol - 2);
  let ex = scanX0 + Math.min(scanW - 1, maxInkCol + 2);
  if (band) {
    sx = Math.min(sx, band.ruleMinX);
    ex = Math.max(ex, band.ruleMaxX);
  }
  if (hintMinX !== null && hintMaxX !== null && !band) {
    sx = Math.min(sx, hintMinX);
    ex = Math.max(ex, hintMaxX);
  }

  const sy = Math.max(0, scanTopY + topInkRow - 2);
  const ey = Math.min(pageH - 1, Math.max(scanTopY + bottomInkRow + 2, cropBottomY));
  const sw = ex - sx + 1;
  const sh = ey - sy + 1;

  if (sw < pageW * 0.45 || sh < 45) return '';

  const maxOutWidth = 1240;
  const scale = Math.min(1, maxOutWidth / Math.max(1, sw));
  const outW = Math.max(120, Math.round(sw * scale));
  const outH = Math.max(40, Math.round(sh * scale));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return '';

  outCtx.fillStyle = '#FFFFFF';
  outCtx.fillRect(0, 0, outW, outH);
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, outW, outH);

  // Snap light paper/compression noise to pure #FFFFFF so Kop integrates seamlessly on A4 sheet
  const outImg = outCtx.getImageData(0, 0, outW, outH);
  const pxData = outImg.data;
  for (let i = 0; i < pxData.length; i += 4) {
    const r = pxData[i];
    const g = pxData[i + 1];
    const b = pxData[i + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const saturation = maxC - minC;
    const brightness = (r + g + b) / 3;
    if (brightness > 234 && saturation < 16) {
      pxData[i] = 255;
      pxData[i + 1] = 255;
      pxData[i + 2] = 255;
      pxData[i + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);

  let dataUrl = outCanvas.toDataURL('image/png');
  if (dataUrl.length > 175000) {
    dataUrl = outCanvas.toDataURL('image/jpeg', 0.92);
  }
  if (dataUrl.length > 200000) {
    dataUrl = outCanvas.toDataURL('image/jpeg', 0.82);
  }
  if (dataUrl.length > 215000) {
    dataUrl = outCanvas.toDataURL('image/jpeg', 0.72);
  }

  return dataUrl.length <= 215000 ? dataUrl : '';
}

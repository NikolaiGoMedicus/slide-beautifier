import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import PptxGenJSModule from 'pptxgenjs';

// Handle ESM/CommonJS interop
const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;

const execAsync = promisify(exec);

export interface SlideImage {
  slideNumber: number;
  imageData: string; // base64
  mimeType: 'image/png';
  width?: number;
  height?: number;
}

export interface PptxDimensions {
  width: number;  // in inches
  height: number; // in inches
}

/**
 * Extract slides from a PPTX file as PNG images.
 * Uses LibreOffice to convert PPTX to PDF, then pdftoppm to convert PDF to PNG.
 */
export async function extractSlidesFromPptx(pptxBuffer: Buffer): Promise<{
  slides: SlideImage[];
  dimensions: PptxDimensions;
}> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-'));
  const pptxPath = path.join(tempDir, 'presentation.pptx');
  const pdfPath = path.join(tempDir, 'presentation.pdf');

  try {
    // Write PPTX buffer to temp file
    await fs.writeFile(pptxPath, pptxBuffer);

    // Convert PPTX to PDF using LibreOffice (soffice on macOS)
    await execAsync(
      `soffice --headless --convert-to pdf --outdir "${tempDir}" "${pptxPath}"`,
      { timeout: 120000 } // 2 minute timeout
    );

    // Verify PDF was created
    try {
      await fs.access(pdfPath);
    } catch {
      throw new Error('LibreOffice failed to convert PPTX to PDF');
    }

    // Get PDF page count and dimensions using pdfinfo
    const { stdout: pdfInfo } = await execAsync(`pdfinfo "${pdfPath}"`);
    const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
    const sizeMatch = pdfInfo.match(/Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/);

    if (!pageMatch) {
      throw new Error('Could not determine PDF page count');
    }

    const pageCount = parseInt(pageMatch[1], 10);

    // Default to 16:9 dimensions if we can't parse
    let dimensions: PptxDimensions = { width: 10, height: 5.625 };
    if (sizeMatch) {
      // Convert pts to inches (72 pts = 1 inch)
      dimensions = {
        width: parseFloat(sizeMatch[1]) / 72,
        height: parseFloat(sizeMatch[2]) / 72,
      };
    }

    // Convert PDF pages to PNG using pdftoppm
    const outputPrefix = path.join(tempDir, 'slide');
    await execAsync(
      `pdftoppm -png -r 150 "${pdfPath}" "${outputPrefix}"`,
      { timeout: 120000 }
    );

    // Read the generated PNG files
    const slides: SlideImage[] = [];

    for (let i = 1; i <= pageCount; i++) {
      // pdftoppm names files with padding (e.g., slide-01.png or slide-1.png)
      let pngPath: string;
      const paddedNum = i.toString().padStart(pageCount.toString().length, '0');

      // Try different naming conventions
      const candidates = [
        path.join(tempDir, `slide-${paddedNum}.png`),
        path.join(tempDir, `slide-${i}.png`),
      ];

      pngPath = '';
      for (const candidate of candidates) {
        try {
          await fs.access(candidate);
          pngPath = candidate;
          break;
        } catch {
          // Try next candidate
        }
      }

      if (!pngPath) {
        console.warn(`Could not find PNG for slide ${i}`);
        continue;
      }

      const imageBuffer = await fs.readFile(pngPath);
      slides.push({
        slideNumber: i,
        imageData: imageBuffer.toString('base64'),
        mimeType: 'image/png',
      });
    }

    if (slides.length === 0) {
      throw new Error('No slides could be extracted from the PPTX');
    }

    return { slides, dimensions };
  } finally {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch (err) {
      console.warn('Failed to cleanup temp directory:', err);
    }
  }
}

/**
 * Create a PPTX file from a list of slide images.
 * Each image becomes a full-slide background.
 */
export async function createPptxFromImages(
  images: SlideImage[],
  dimensions: PptxDimensions = { width: 10, height: 5.625 }
): Promise<Buffer> {
  const pptx = new PptxGenJS();

  // Set slide dimensions
  pptx.defineLayout({
    name: 'CUSTOM',
    width: dimensions.width,
    height: dimensions.height,
  });
  pptx.layout = 'CUSTOM';

  // Sort images by slide number
  const sortedImages = [...images].sort((a, b) => a.slideNumber - b.slideNumber);

  for (const image of sortedImages) {
    const slide = pptx.addSlide();

    // Add image as full-slide background
    slide.addImage({
      data: `data:${image.mimeType};base64,${image.imageData}`,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
    });
  }

  // Generate PPTX as base64
  const pptxBase64 = await pptx.write({ outputType: 'base64' }) as string;
  return Buffer.from(pptxBase64, 'base64');
}

/**
 * Check if required system dependencies are installed.
 */
export async function checkDependencies(): Promise<{
  libreoffice: boolean;
  pdftoppm: boolean;
  pdfinfo: boolean;
  errors: string[];
}> {
  const result = {
    libreoffice: false,
    pdftoppm: false,
    pdfinfo: false,
    errors: [] as string[],
  };

  // Check LibreOffice (soffice on macOS)
  try {
    await execAsync('soffice --version');
    result.libreoffice = true;
  } catch {
    result.errors.push('LibreOffice is not installed. Install with: brew install --cask libreoffice');
  }

  // Check pdftoppm (from poppler)
  try {
    await execAsync('pdftoppm -v');
    result.pdftoppm = true;
  } catch {
    result.errors.push('pdftoppm is not installed. Install with: brew install poppler');
  }

  // Check pdfinfo (from poppler)
  try {
    await execAsync('pdfinfo -v');
    result.pdfinfo = true;
  } catch {
    result.errors.push('pdfinfo is not installed. Install with: brew install poppler');
  }

  return result;
}

/**
 * Validate that a buffer contains a valid PPTX file.
 */
export function isValidPptx(buffer: Buffer): boolean {
  // PPTX files are ZIP archives that start with PK signature
  if (buffer.length < 4) return false;

  const signature = buffer.slice(0, 4);
  return (
    signature[0] === 0x50 && // P
    signature[1] === 0x4b && // K
    signature[2] === 0x03 &&
    signature[3] === 0x04
  );
}

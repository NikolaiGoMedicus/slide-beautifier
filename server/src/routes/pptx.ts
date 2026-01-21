import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import sharp from 'sharp';
import {
  createPptxJob,
  getPptxJob,
  getPptxSlides,
  getPptxSlide,
  getPptxJobs,
  resetPptxSlide,
  decrementPptxFailed,
  updatePptxJobStatus,
} from '../services/database.js';
import {
  extractSlidesFromPptx,
  isValidPptx,
  checkDependencies,
} from '../services/pptxService.js';
import {
  processPptxJob,
  isProcessingPptxJob,
  cancelPptxJob,
  getPptxResultPath,
} from '../services/pptxProcessor.js';

const THUMBNAIL_WIDTH = 300;

export const pptxRouter = Router();

const COST_PER_SLIDE = 0.24;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Check system dependencies
pptxRouter.get('/check', async (_req: Request, res: Response): Promise<void> => {
  const deps = await checkDependencies();
  res.json({
    ready: deps.libreoffice && deps.pdftoppm && deps.pdfinfo,
    dependencies: {
      libreoffice: deps.libreoffice,
      pdftoppm: deps.pdftoppm,
      pdfinfo: deps.pdfinfo,
    },
    errors: deps.errors,
  });
});

// In-memory storage for extracted slides (temporary, before job creation)
const extractedSlidesCache = new Map<string, {
  slides: Array<{ slideNumber: number; imageData: string; thumbnail: string }>;
  dimensions: { width: number; height: number };
  filename: string;
  createdAt: number;
}>();

// Clean up old cached extractions (older than 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of extractedSlidesCache.entries()) {
    if (now - value.createdAt > 30 * 60 * 1000) {
      extractedSlidesCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Extract slides from PPTX without starting a job (for selective processing)
pptxRouter.post('/extract', async (req: Request, res: Response): Promise<void> => {
  const { pptxData, filename } = req.body;

  // Validate required fields
  if (!pptxData || typeof pptxData !== 'string') {
    res.status(400).json({ error: 'PPTX data is required (base64 encoded)' });
    return;
  }

  if (!filename || typeof filename !== 'string') {
    res.status(400).json({ error: 'Filename is required' });
    return;
  }

  // Decode and validate PPTX
  let pptxBuffer: Buffer;
  try {
    pptxBuffer = Buffer.from(pptxData, 'base64');
  } catch {
    res.status(400).json({ error: 'Invalid base64 data' });
    return;
  }

  if (pptxBuffer.length > MAX_FILE_SIZE) {
    res.status(400).json({ error: 'File too large (max 100MB)' });
    return;
  }

  if (!isValidPptx(pptxBuffer)) {
    res.status(400).json({ error: 'Invalid PPTX file' });
    return;
  }

  // Check dependencies
  const deps = await checkDependencies();
  if (!deps.libreoffice || !deps.pdftoppm || !deps.pdfinfo) {
    res.status(500).json({
      error: 'System dependencies not installed',
      details: deps.errors,
    });
    return;
  }

  try {
    // Extract slides from PPTX
    console.log(`Extracting slides from ${filename} (for selection)`);
    const { slides, dimensions } = await extractSlidesFromPptx(pptxBuffer);
    console.log(`Extracted ${slides.length} slides`);

    // Generate thumbnails for each slide
    const slidesWithThumbnails = await Promise.all(
      slides.map(async (slide) => ({
        slideNumber: slide.slideNumber,
        imageData: slide.imageData,
        thumbnail: await resizeBase64Image(slide.imageData, THUMBNAIL_WIDTH),
      }))
    );

    // Generate a unique extraction ID
    const extractionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Cache the extracted slides
    extractedSlidesCache.set(extractionId, {
      slides: slidesWithThumbnails,
      dimensions,
      filename,
      createdAt: Date.now(),
    });

    res.json({
      extractionId,
      slideCount: slides.length,
      estimatedCost: slides.length * COST_PER_SLIDE,
      dimensions: {
        width: dimensions.width,
        height: dimensions.height,
      },
      slides: slidesWithThumbnails.map(s => ({
        slideNumber: s.slideNumber,
        thumbnail: s.thumbnail,
      })),
    });
  } catch (error) {
    console.error('PPTX extraction error:', error);
    res.status(500).json({
      error: 'Failed to extract slides from PPTX',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start beautification job (can use extractionId from /extract or pptxData directly)
pptxRouter.post('/beautify', async (req: Request, res: Response): Promise<void> => {
  const { pptxData, filename, prompt, preset, aspectRatio, extractionId, selectedSlides } = req.body;

  // Validate required fields
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  let slides: Array<{ slideNumber: number; imageData: string }>;
  let dimensions: { width: number; height: number };
  let resolvedFilename: string;

  // If extractionId is provided, use cached slides
  if (extractionId && typeof extractionId === 'string') {
    const cached = extractedSlidesCache.get(extractionId);
    if (!cached) {
      res.status(400).json({ error: 'Extraction expired or not found. Please re-upload the file.' });
      return;
    }

    resolvedFilename = cached.filename;
    dimensions = cached.dimensions;

    // Filter slides if selectedSlides is provided
    if (selectedSlides && Array.isArray(selectedSlides)) {
      const selectedSet = new Set(selectedSlides as number[]);
      slides = cached.slides
        .filter(s => selectedSet.has(s.slideNumber))
        .map(s => ({ slideNumber: s.slideNumber, imageData: s.imageData }));

      if (slides.length === 0) {
        res.status(400).json({ error: 'No slides selected for beautification' });
        return;
      }
    } else {
      // Use all slides
      slides = cached.slides.map(s => ({ slideNumber: s.slideNumber, imageData: s.imageData }));
    }

    // Clean up cache after use
    extractedSlidesCache.delete(extractionId);
  } else {
    // Original flow: extract from pptxData directly
    if (!pptxData || typeof pptxData !== 'string') {
      res.status(400).json({ error: 'PPTX data or extractionId is required' });
      return;
    }

    if (!filename || typeof filename !== 'string') {
      res.status(400).json({ error: 'Filename is required' });
      return;
    }

    resolvedFilename = filename;

    // Decode and validate PPTX
    let pptxBuffer: Buffer;
    try {
      pptxBuffer = Buffer.from(pptxData, 'base64');
    } catch {
      res.status(400).json({ error: 'Invalid base64 data' });
      return;
    }

    if (pptxBuffer.length > MAX_FILE_SIZE) {
      res.status(400).json({ error: 'File too large (max 100MB)' });
      return;
    }

    if (!isValidPptx(pptxBuffer)) {
      res.status(400).json({ error: 'Invalid PPTX file' });
      return;
    }

    // Check dependencies
    const deps = await checkDependencies();
    if (!deps.libreoffice || !deps.pdftoppm || !deps.pdfinfo) {
      res.status(500).json({
        error: 'System dependencies not installed',
        details: deps.errors,
      });
      return;
    }

    try {
      // Extract slides from PPTX
      console.log(`Extracting slides from ${filename}`);
      const extracted = await extractSlidesFromPptx(pptxBuffer);
      console.log(`Extracted ${extracted.slides.length} slides`);

      dimensions = extracted.dimensions;
      slides = extracted.slides.map(s => ({
        slideNumber: s.slideNumber,
        imageData: s.imageData,
      }));
    } catch (error) {
      console.error('PPTX extraction error:', error);
      res.status(500).json({
        error: 'Failed to extract slides from PPTX',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  }

  try {
    // Create job in database
    const jobId = createPptxJob({
      filename: resolvedFilename,
      prompt,
      preset,
      aspectRatio,
      slideWidth: dimensions.width,
      slideHeight: dimensions.height,
      slides,
    });

    // Start processing in background
    processPptxJob(jobId).catch(err => {
      console.error(`PPTX job ${jobId} processing error:`, err);
    });

    res.json({
      jobId,
      slideCount: slides.length,
      estimatedCost: slides.length * COST_PER_SLIDE,
      dimensions: {
        width: dimensions.width,
        height: dimensions.height,
      },
    });
  } catch (error) {
    console.error('PPTX job creation error:', error);
    res.status(500).json({
      error: 'Failed to create beautification job',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get job status
pptxRouter.get('/:jobId/status', (req: Request, res: Response): void => {
  const jobId = parseInt(req.params.jobId as string);

  if (isNaN(jobId)) {
    res.status(400).json({ error: 'Invalid job ID' });
    return;
  }

  const job = getPptxJob(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const slides = getPptxSlides(jobId);

  // Don't include full images in status response
  const slideSummaries = slides.map(slide => ({
    id: slide.id,
    slideNumber: slide.slide_number,
    status: slide.status,
    error: slide.error,
    processingTime: slide.processing_time,
    hasResult: !!slide.beautified_image,
  }));

  res.json({
    jobId: job.id,
    status: job.status,
    filename: job.original_filename,
    totalSlides: job.total_slides,
    completedSlides: job.completed_slides,
    failedSlides: job.failed_slides,
    prompt: job.prompt,
    preset: job.preset,
    aspectRatio: job.aspect_ratio,
    estimatedCost: job.estimated_cost,
    createdAt: job.created_at,
    completedAt: job.completed_at,
    slides: slideSummaries,
    isProcessing: isProcessingPptxJob(jobId),
  });
});

// Get single slide with images
pptxRouter.get('/:jobId/slides/:slideId', (req: Request, res: Response): void => {
  const jobId = parseInt(req.params.jobId as string);
  const slideId = parseInt(req.params.slideId as string);

  if (isNaN(jobId) || isNaN(slideId)) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }

  const slide = getPptxSlide(slideId);

  if (!slide || slide.job_id !== jobId) {
    res.status(404).json({ error: 'Slide not found' });
    return;
  }

  res.json({
    id: slide.id,
    slideNumber: slide.slide_number,
    status: slide.status,
    error: slide.error,
    processingTime: slide.processing_time,
    originalImage: slide.original_image,
    beautifiedImage: slide.beautified_image,
  });
});

// Helper function to resize base64 image
async function resizeBase64Image(base64: string, width: number): Promise<string> {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const resizedBuffer = await sharp(buffer)
    .resize(width, null, { fit: 'inside' })
    .png({ quality: 80 })
    .toBuffer();

  return resizedBuffer.toString('base64');
}

// Get slide thumbnail (resized images for preview)
pptxRouter.get('/:jobId/slides/:slideId/thumbnail', async (req: Request, res: Response): Promise<void> => {
  const jobId = parseInt(req.params.jobId as string);
  const slideId = parseInt(req.params.slideId as string);

  if (isNaN(jobId) || isNaN(slideId)) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }

  const slide = getPptxSlide(slideId);

  if (!slide || slide.job_id !== jobId) {
    res.status(404).json({ error: 'Slide not found' });
    return;
  }

  try {
    const originalThumbnail = await resizeBase64Image(slide.original_image, THUMBNAIL_WIDTH);
    const beautifiedThumbnail = slide.beautified_image
      ? await resizeBase64Image(slide.beautified_image, THUMBNAIL_WIDTH)
      : null;

    res.json({
      id: slide.id,
      slideNumber: slide.slide_number,
      status: slide.status,
      originalThumbnail,
      beautifiedThumbnail,
    });
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

// Retry a failed slide
pptxRouter.post('/:jobId/slides/:slideId/retry', async (req: Request, res: Response): Promise<void> => {
  const jobId = parseInt(req.params.jobId as string);
  const slideId = parseInt(req.params.slideId as string);

  if (isNaN(jobId) || isNaN(slideId)) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }

  const job = getPptxJob(jobId);
  const slide = getPptxSlide(slideId);

  if (!job || !slide || slide.job_id !== jobId) {
    res.status(404).json({ error: 'Slide not found' });
    return;
  }

  if (slide.status !== 'failed') {
    res.status(400).json({ error: 'Can only retry failed slides' });
    return;
  }

  // Reset the slide
  resetPptxSlide(slideId);
  decrementPptxFailed(jobId);

  // Update job status if needed
  if (job.status === 'completed' || job.status === 'failed') {
    updatePptxJobStatus(jobId, 'processing');
  }

  // Start processing if not already running
  if (!isProcessingPptxJob(jobId)) {
    processPptxJob(jobId).catch(err => {
      console.error(`PPTX job ${jobId} retry processing error:`, err);
    });
  }

  res.json({ success: true });
});

// Cancel job
pptxRouter.post('/:jobId/cancel', (req: Request, res: Response): void => {
  const jobId = parseInt(req.params.jobId as string);

  if (isNaN(jobId)) {
    res.status(400).json({ error: 'Invalid job ID' });
    return;
  }

  const job = getPptxJob(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  cancelPptxJob(jobId);
  updatePptxJobStatus(jobId, 'failed');

  res.json({ success: true });
});

// Download beautified PPTX
pptxRouter.get('/:jobId/download', async (req: Request, res: Response): Promise<void> => {
  const jobId = parseInt(req.params.jobId as string);

  if (isNaN(jobId)) {
    res.status(400).json({ error: 'Invalid job ID' });
    return;
  }

  const job = getPptxJob(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const filePath = await getPptxResultPath(jobId);

  if (!filePath) {
    res.status(404).json({ error: 'PPTX result not found (may have been deleted)' });
    return;
  }

  // Generate filename
  const originalName = job.original_filename.replace(/\.pptx$/i, '');
  const downloadFilename = `${originalName}-beautified.pptx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);

  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// List all jobs
pptxRouter.get('/', (req: Request, res: Response): void => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const jobs = getPptxJobs(limit, offset);

  res.json({
    jobs: jobs.map(job => ({
      id: job.id,
      status: job.status,
      filename: job.original_filename,
      totalSlides: job.total_slides,
      completedSlides: job.completed_slides,
      failedSlides: job.failed_slides,
      preset: job.preset,
      estimatedCost: job.estimated_cost,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    })),
  });
});

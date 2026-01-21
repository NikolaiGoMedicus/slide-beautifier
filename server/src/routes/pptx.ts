import { Router, type Request, type Response } from 'express';
import fs from 'fs';
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

// Upload PPTX and start beautification
pptxRouter.post('/beautify', async (req: Request, res: Response): Promise<void> => {
  const { pptxData, filename, prompt, preset, aspectRatio } = req.body;

  // Validate required fields
  if (!pptxData || typeof pptxData !== 'string') {
    res.status(400).json({ error: 'PPTX data is required (base64 encoded)' });
    return;
  }

  if (!filename || typeof filename !== 'string') {
    res.status(400).json({ error: 'Filename is required' });
    return;
  }

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt is required' });
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
    console.log(`Extracting slides from ${filename}`);
    const { slides, dimensions } = await extractSlidesFromPptx(pptxBuffer);
    console.log(`Extracted ${slides.length} slides`);

    // Create job in database
    const jobId = createPptxJob({
      filename,
      prompt,
      preset,
      aspectRatio,
      slideWidth: dimensions.width,
      slideHeight: dimensions.height,
      slides: slides.map(s => ({
        slideNumber: s.slideNumber,
        imageData: s.imageData,
      })),
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
    console.error('PPTX extraction error:', error);
    res.status(500).json({
      error: 'Failed to extract slides from PPTX',
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

import {
  getPptxJob,
  getNextPendingPptxSlide,
  getPptxSlides,
  updatePptxJobStatus,
  updatePptxSlideStatus,
  incrementPptxCompleted,
} from './database.js';
import { generateImage } from './gemini.js';
import { createPptxFromImages, type SlideImage } from './pptxService.js';
import type { MimeType, AspectRatio } from '../types/index.js';

// Track active PPTX processing
const activeJobs = new Map<number, boolean>();

// Store generated PPTX files temporarily (in production, use file storage or database)
const pptxResults = new Map<number, Buffer>();

export function isProcessingPptxJob(jobId: number): boolean {
  return activeJobs.get(jobId) === true;
}

export function getPptxResult(jobId: number): Buffer | undefined {
  return pptxResults.get(jobId);
}

export async function processPptxJob(jobId: number): Promise<void> {
  // Prevent duplicate processing
  if (activeJobs.get(jobId)) {
    console.log(`PPTX job ${jobId} is already being processed`);
    return;
  }

  activeJobs.set(jobId, true);

  try {
    const job = getPptxJob(jobId);
    if (!job) {
      console.error(`PPTX job ${jobId} not found`);
      return;
    }

    // Update job status to processing
    updatePptxJobStatus(jobId, 'processing');

    // Process slides one by one
    let slide = getNextPendingPptxSlide(jobId);

    while (slide) {
      // Check if job was cancelled
      if (!activeJobs.get(jobId)) {
        console.log(`PPTX job ${jobId} was cancelled`);
        break;
      }

      console.log(`Processing PPTX slide ${slide.slide_number} (job ${jobId})`);

      // Update slide status to processing
      updatePptxSlideStatus(slide.id, 'processing');

      const startTime = Date.now();

      try {
        const result = await generateImage({
          image: slide.original_image,
          mimeType: 'image/png' as MimeType,
          prompt: job.prompt,
          aspectRatio: job.aspect_ratio as AspectRatio | undefined,
        });

        const processingTime = Date.now() - startTime;

        if (result.success && result.image) {
          updatePptxSlideStatus(slide.id, 'completed', {
            beautifiedImage: result.image,
            processingTime,
          });
          incrementPptxCompleted(jobId, false);
          console.log(`PPTX slide ${slide.slide_number} completed in ${processingTime}ms`);
        } else {
          updatePptxSlideStatus(slide.id, 'failed', {
            error: result.error || 'Unknown error',
            processingTime,
          });
          incrementPptxCompleted(jobId, true);
          console.log(`PPTX slide ${slide.slide_number} failed: ${result.error}`);
        }
      } catch (error) {
        const processingTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        updatePptxSlideStatus(slide.id, 'failed', {
          error: errorMessage,
          processingTime,
        });
        incrementPptxCompleted(jobId, true);
        console.error(`PPTX slide ${slide.slide_number} error:`, error);
      }

      // Small delay between slides to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get next pending slide
      slide = getNextPendingPptxSlide(jobId);
    }

    // Assemble final PPTX
    const finalJob = getPptxJob(jobId);
    if (finalJob) {
      if (finalJob.failed_slides === finalJob.total_slides) {
        updatePptxJobStatus(jobId, 'failed');
      } else {
        // Assemble PPTX from beautified slides
        updatePptxJobStatus(jobId, 'assembling');

        try {
          const slides = getPptxSlides(jobId);
          const beautifiedSlides: SlideImage[] = slides
            .filter(s => s.status === 'completed' && s.beautified_image)
            .map(s => ({
              slideNumber: s.slide_number,
              imageData: s.beautified_image!,
              mimeType: 'image/png' as const,
            }));

          // For failed slides, use original images as fallback
          const failedSlides: SlideImage[] = slides
            .filter(s => s.status === 'failed')
            .map(s => ({
              slideNumber: s.slide_number,
              imageData: s.original_image,
              mimeType: 'image/png' as const,
            }));

          const allSlides = [...beautifiedSlides, ...failedSlides].sort(
            (a, b) => a.slideNumber - b.slideNumber
          );

          const pptxBuffer = await createPptxFromImages(allSlides, {
            width: finalJob.slide_width || 10,
            height: finalJob.slide_height || 5.625,
          });

          // Store the result
          pptxResults.set(jobId, pptxBuffer);

          updatePptxJobStatus(jobId, 'completed');
          console.log(`PPTX job ${jobId} completed, result size: ${pptxBuffer.length} bytes`);
        } catch (error) {
          console.error(`Failed to assemble PPTX for job ${jobId}:`, error);
          updatePptxJobStatus(jobId, 'failed');
        }
      }
    }

    console.log(`PPTX job ${jobId} processing complete`);
  } finally {
    activeJobs.delete(jobId);
  }
}

export function cancelPptxJob(jobId: number): void {
  activeJobs.set(jobId, false);
}

// Cleanup old results (call periodically)
export function cleanupOldResults(_maxAgeMs: number = 3600000): void {
  // In a production system, you'd track creation time with _maxAgeMs
  // For now, we just limit the size
  if (pptxResults.size > 100) {
    const keysToDelete = Array.from(pptxResults.keys()).slice(0, 50);
    for (const key of keysToDelete) {
      pptxResults.delete(key);
    }
  }
}

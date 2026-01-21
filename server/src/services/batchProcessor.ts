import {
  getBatch,
  getNextPendingBatchItem,
  updateBatchStatus,
  updateBatchItemStatus,
  incrementBatchCompleted,
} from './database.js';
import { generateImage } from './gemini.js';
import type { MimeType, AspectRatio } from '../types/index.js';

// Track active batch processing
const activeBatches = new Map<number, boolean>();

export function isProcessingBatch(batchId: number): boolean {
  return activeBatches.get(batchId) === true;
}

export async function processBatch(batchId: number): Promise<void> {
  // Prevent duplicate processing
  if (activeBatches.get(batchId)) {
    console.log(`Batch ${batchId} is already being processed`);
    return;
  }

  activeBatches.set(batchId, true);

  try {
    const batch = getBatch(batchId);
    if (!batch) {
      console.error(`Batch ${batchId} not found`);
      return;
    }

    // Update batch status to processing
    updateBatchStatus(batchId, 'processing');

    // Process items one by one
    let item = getNextPendingBatchItem(batchId);

    while (item) {
      // Check if batch was cancelled
      if (!activeBatches.get(batchId)) {
        console.log(`Batch ${batchId} was cancelled`);
        break;
      }

      console.log(`Processing batch item ${item.id} (${item.filename})`);

      // Update item status to processing
      updateBatchItemStatus(item.id, 'processing');

      const startTime = Date.now();

      try {
        const result = await generateImage({
          image: item.original_image,
          mimeType: item.original_mime_type as MimeType,
          prompt: batch.prompt,
          aspectRatio: batch.aspect_ratio as AspectRatio | undefined,
        });

        const processingTime = Date.now() - startTime;

        if (result.success && result.image && result.mimeType) {
          updateBatchItemStatus(item.id, 'completed', {
            generatedImage: result.image,
            generatedMimeType: result.mimeType,
            processingTime,
          });
          incrementBatchCompleted(batchId, false);
          console.log(`Batch item ${item.id} completed in ${processingTime}ms`);
        } else {
          updateBatchItemStatus(item.id, 'failed', {
            error: result.error || 'Unknown error',
            processingTime,
          });
          incrementBatchCompleted(batchId, true);
          console.log(`Batch item ${item.id} failed: ${result.error}`);
        }
      } catch (error) {
        const processingTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        updateBatchItemStatus(item.id, 'failed', {
          error: errorMessage,
          processingTime,
        });
        incrementBatchCompleted(batchId, true);
        console.error(`Batch item ${item.id} error:`, error);
      }

      // Small delay between items to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get next pending item
      item = getNextPendingBatchItem(batchId);
    }

    // Check final status
    const finalBatch = getBatch(batchId);
    if (finalBatch) {
      if (finalBatch.failed_items === finalBatch.total_items) {
        updateBatchStatus(batchId, 'failed');
      } else {
        updateBatchStatus(batchId, 'completed');
      }
    }

    console.log(`Batch ${batchId} processing complete`);
  } finally {
    activeBatches.delete(batchId);
  }
}

export function cancelBatch(batchId: number): void {
  activeBatches.set(batchId, false);
}

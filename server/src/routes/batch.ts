import { Router, type Request, type Response } from 'express';
import archiver from 'archiver';
import {
  createBatch,
  getBatch,
  getBatchItems,
  getBatchItem,
  getBatches,
  resetBatchItem,
  decrementBatchFailed,
  updateBatchStatus,
} from '../services/database.js';
import { processBatch, isProcessingBatch, cancelBatch } from '../services/batchProcessor.js';

export const batchRouter = Router();

const COST_PER_IMAGE = 0.24;

// Create a new batch
batchRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const { prompt, preset, aspectRatio, items } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'At least one item is required' });
    return;
  }

  if (items.length > 100) {
    res.status(400).json({ error: 'Maximum 100 items per batch' });
    return;
  }

  // Validate items
  for (const item of items) {
    if (!item.filename || !item.image || !item.mimeType) {
      res.status(400).json({ error: 'Each item must have filename, image, and mimeType' });
      return;
    }
  }

  try {
    const batchId = createBatch({
      prompt,
      preset,
      aspectRatio,
      items,
    });

    // Start processing in background
    processBatch(batchId).catch(err => {
      console.error(`Batch ${batchId} processing error:`, err);
    });

    res.json({
      id: batchId,
      estimatedCost: items.length * COST_PER_IMAGE,
      totalItems: items.length,
    });
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// Get batch status
batchRouter.get('/:id', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid batch ID' });
    return;
  }

  const batch = getBatch(id);

  if (!batch) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }

  const items = getBatchItems(id);

  // Don't include full images in status response
  const itemSummaries = items.map(item => ({
    id: item.id,
    filename: item.filename,
    status: item.status,
    error: item.error,
    processingTime: item.processing_time,
    hasResult: !!item.generated_image,
  }));

  res.json({
    id: batch.id,
    status: batch.status,
    totalItems: batch.total_items,
    completedItems: batch.completed_items,
    failedItems: batch.failed_items,
    prompt: batch.prompt,
    preset: batch.preset,
    aspectRatio: batch.aspect_ratio,
    estimatedCost: batch.estimated_cost,
    createdAt: batch.created_at,
    completedAt: batch.completed_at,
    items: itemSummaries,
    isProcessing: isProcessingBatch(id),
  });
});

// Get single batch item with images
batchRouter.get('/:batchId/items/:itemId', (req: Request, res: Response): void => {
  const batchId = parseInt(req.params.batchId as string);
  const itemId = parseInt(req.params.itemId as string);

  if (isNaN(batchId) || isNaN(itemId)) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }

  const item = getBatchItem(itemId);

  if (!item || item.batch_id !== batchId) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  res.json({
    id: item.id,
    filename: item.filename,
    status: item.status,
    error: item.error,
    processingTime: item.processing_time,
    originalImage: item.original_image,
    originalMimeType: item.original_mime_type,
    generatedImage: item.generated_image,
    generatedMimeType: item.generated_mime_type,
  });
});

// Retry a failed item
batchRouter.post('/:batchId/items/:itemId/retry', async (req: Request, res: Response): Promise<void> => {
  const batchId = parseInt(req.params.batchId as string);
  const itemId = parseInt(req.params.itemId as string);

  if (isNaN(batchId) || isNaN(itemId)) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }

  const batch = getBatch(batchId);
  const item = getBatchItem(itemId);

  if (!batch || !item || item.batch_id !== batchId) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  if (item.status !== 'failed') {
    res.status(400).json({ error: 'Can only retry failed items' });
    return;
  }

  // Reset the item
  resetBatchItem(itemId);
  decrementBatchFailed(batchId);

  // Update batch status if needed
  if (batch.status === 'completed' || batch.status === 'failed') {
    updateBatchStatus(batchId, 'processing');
  }

  // Start processing if not already running
  if (!isProcessingBatch(batchId)) {
    processBatch(batchId).catch(err => {
      console.error(`Batch ${batchId} retry processing error:`, err);
    });
  }

  res.json({ success: true });
});

// Cancel batch processing
batchRouter.post('/:id/cancel', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid batch ID' });
    return;
  }

  const batch = getBatch(id);

  if (!batch) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }

  cancelBatch(id);
  updateBatchStatus(id, 'failed');

  res.json({ success: true });
});

// Download batch as ZIP
batchRouter.get('/:id/download', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid batch ID' });
    return;
  }

  const batch = getBatch(id);

  if (!batch) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }

  const items = getBatchItems(id);
  const completedItems = items.filter(item => item.status === 'completed' && item.generated_image);

  if (completedItems.length === 0) {
    res.status(400).json({ error: 'No completed items to download' });
    return;
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="batch-${id}-beautified.zip"`);

  const archive = archiver('zip', { zlib: { level: 5 } });

  archive.on('error', (err) => {
    console.error('Archive error:', err);
    res.status(500).end();
  });

  archive.pipe(res);

  for (const item of completedItems) {
    if (item.generated_image && item.generated_mime_type) {
      const buffer = Buffer.from(item.generated_image, 'base64');
      const ext = item.generated_mime_type.split('/')[1] || 'png';
      const filename = item.filename.replace(/\.[^/.]+$/, '') + `-beautified.${ext}`;
      archive.append(buffer, { name: filename });
    }
  }

  archive.finalize();
});

// List all batches
batchRouter.get('/', (req: Request, res: Response): void => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const batches = getBatches(limit, offset);

  res.json({
    batches: batches.map(batch => ({
      id: batch.id,
      status: batch.status,
      totalItems: batch.total_items,
      completedItems: batch.completed_items,
      failedItems: batch.failed_items,
      preset: batch.preset,
      estimatedCost: batch.estimated_cost,
      createdAt: batch.created_at,
      completedAt: batch.completed_at,
    })),
  });
});

import { Router, type Request, type Response } from 'express';
import { getHistory, getHistoryEntry, deleteHistoryEntry, getHistoryCount } from '../services/database.js';

export const historyRouter = Router();

// Get paginated history
historyRouter.get('/', (req: Request, res: Response): void => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const entries = getHistory(limit, offset);
  const total = getHistoryCount();

  // Return entries without full image data for list view
  const summaries = entries.map(entry => ({
    id: entry.id,
    prompt: entry.prompt.substring(0, 100) + (entry.prompt.length > 100 ? '...' : ''),
    preset: entry.preset,
    aspectRatio: entry.aspect_ratio,
    processingTime: entry.processing_time,
    createdAt: entry.created_at,
    // Include small thumbnail hint (first 100 chars of base64)
    hasThumbnail: true,
  }));

  res.json({
    entries: summaries,
    total,
    limit,
    offset,
    hasMore: offset + entries.length < total,
  });
});

// Get single history entry with full images
historyRouter.get('/:id', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }

  const entry = getHistoryEntry(id);

  if (!entry) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  res.json({
    id: entry.id,
    originalImage: entry.original_image,
    originalMimeType: entry.original_mime_type,
    generatedImage: entry.generated_image,
    generatedMimeType: entry.generated_mime_type,
    prompt: entry.prompt,
    preset: entry.preset,
    aspectRatio: entry.aspect_ratio,
    processingTime: entry.processing_time,
    createdAt: entry.created_at,
  });
});

// Get thumbnail for history entry
historyRouter.get('/:id/thumbnail', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }

  const entry = getHistoryEntry(id);

  if (!entry) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  // Return just the generated image for thumbnail
  res.json({
    id: entry.id,
    generatedImage: entry.generated_image,
    generatedMimeType: entry.generated_mime_type,
  });
});

// Delete history entry
historyRouter.delete('/:id', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }

  const deleted = deleteHistoryEntry(id);

  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Entry not found' });
  }
});

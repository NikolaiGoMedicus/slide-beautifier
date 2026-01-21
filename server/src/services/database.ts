import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/history.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db: DatabaseType = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_image TEXT NOT NULL,
    original_mime_type TEXT NOT NULL,
    generated_image TEXT NOT NULL,
    generated_mime_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    preset TEXT,
    aspect_ratio TEXT,
    processing_time INTEGER,
    batch_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'pending',
    total_items INTEGER NOT NULL,
    completed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    prompt TEXT NOT NULL,
    preset TEXT,
    aspect_ratio TEXT,
    estimated_cost REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS batch_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_image TEXT NOT NULL,
    original_mime_type TEXT NOT NULL,
    generated_image TEXT,
    generated_mime_type TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    processing_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  )
`);

// PPTX Jobs table
db.exec(`
  CREATE TABLE IF NOT EXISTS pptx_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'pending',
    original_filename TEXT NOT NULL,
    total_slides INTEGER NOT NULL,
    completed_slides INTEGER NOT NULL DEFAULT 0,
    failed_slides INTEGER NOT NULL DEFAULT 0,
    prompt TEXT NOT NULL,
    preset TEXT,
    aspect_ratio TEXT,
    slide_width REAL,
    slide_height REAL,
    estimated_cost REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  )
`);

// PPTX Slides table
db.exec(`
  CREATE TABLE IF NOT EXISTS pptx_slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    slide_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    original_image TEXT NOT NULL,
    beautified_image TEXT,
    error TEXT,
    processing_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES pptx_jobs(id)
  )
`);

export interface HistoryEntry {
  id: number;
  original_image: string;
  original_mime_type: string;
  generated_image: string;
  generated_mime_type: string;
  prompt: string;
  preset: string | null;
  aspect_ratio: string | null;
  processing_time: number | null;
  created_at: string;
}

export interface CreateHistoryInput {
  originalImage: string;
  originalMimeType: string;
  generatedImage: string;
  generatedMimeType: string;
  prompt: string;
  preset?: string;
  aspectRatio?: string;
  processingTime?: number;
}

export function saveToHistory(input: CreateHistoryInput): number {
  const stmt = db.prepare(`
    INSERT INTO history (
      original_image, original_mime_type, generated_image, generated_mime_type,
      prompt, preset, aspect_ratio, processing_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.originalImage,
    input.originalMimeType,
    input.generatedImage,
    input.generatedMimeType,
    input.prompt,
    input.preset || null,
    input.aspectRatio || null,
    input.processingTime || null
  );

  return result.lastInsertRowid as number;
}

export function getHistory(limit = 50, offset = 0): HistoryEntry[] {
  const stmt = db.prepare(`
    SELECT * FROM history
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(limit, offset) as HistoryEntry[];
}

export function getHistoryEntry(id: number): HistoryEntry | undefined {
  const stmt = db.prepare('SELECT * FROM history WHERE id = ?');
  return stmt.get(id) as HistoryEntry | undefined;
}

export function deleteHistoryEntry(id: number): boolean {
  const stmt = db.prepare('DELETE FROM history WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getHistoryCount(): number {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM history');
  const result = stmt.get() as { count: number };
  return result.count;
}

// Batch types
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type BatchItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Batch {
  id: number;
  status: BatchStatus;
  total_items: number;
  completed_items: number;
  failed_items: number;
  prompt: string;
  preset: string | null;
  aspect_ratio: string | null;
  estimated_cost: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface BatchItem {
  id: number;
  batch_id: number;
  filename: string;
  original_image: string;
  original_mime_type: string;
  generated_image: string | null;
  generated_mime_type: string | null;
  status: BatchItemStatus;
  error: string | null;
  processing_time: number | null;
  created_at: string;
}

export interface CreateBatchInput {
  prompt: string;
  preset?: string;
  aspectRatio?: string;
  items: Array<{
    filename: string;
    image: string;
    mimeType: string;
  }>;
}

const COST_PER_IMAGE = 0.24; // Max cost estimate (4K)

export function createBatch(input: CreateBatchInput): number {
  const estimatedCost = input.items.length * COST_PER_IMAGE;

  const batchStmt = db.prepare(`
    INSERT INTO batches (status, total_items, prompt, preset, aspect_ratio, estimated_cost)
    VALUES ('pending', ?, ?, ?, ?, ?)
  `);

  const batchResult = batchStmt.run(
    input.items.length,
    input.prompt,
    input.preset || null,
    input.aspectRatio || null,
    estimatedCost
  );

  const batchId = batchResult.lastInsertRowid as number;

  const itemStmt = db.prepare(`
    INSERT INTO batch_items (batch_id, filename, original_image, original_mime_type, status)
    VALUES (?, ?, ?, ?, 'pending')
  `);

  for (const item of input.items) {
    itemStmt.run(batchId, item.filename, item.image, item.mimeType);
  }

  return batchId;
}

export function getBatch(id: number): Batch | undefined {
  const stmt = db.prepare('SELECT * FROM batches WHERE id = ?');
  return stmt.get(id) as Batch | undefined;
}

export function getBatchItems(batchId: number): BatchItem[] {
  const stmt = db.prepare('SELECT * FROM batch_items WHERE batch_id = ? ORDER BY id');
  return stmt.all(batchId) as BatchItem[];
}

export function getBatchItem(id: number): BatchItem | undefined {
  const stmt = db.prepare('SELECT * FROM batch_items WHERE id = ?');
  return stmt.get(id) as BatchItem | undefined;
}

export function getNextPendingBatchItem(batchId: number): BatchItem | undefined {
  const stmt = db.prepare(`
    SELECT * FROM batch_items
    WHERE batch_id = ? AND status = 'pending'
    ORDER BY id LIMIT 1
  `);
  return stmt.get(batchId) as BatchItem | undefined;
}

export function updateBatchStatus(id: number, status: BatchStatus): void {
  const stmt = db.prepare(`
    UPDATE batches SET status = ?, completed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = ?
  `);
  stmt.run(status, status, id);
}

export function updateBatchItemStatus(
  id: number,
  status: BatchItemStatus,
  result?: { generatedImage?: string; generatedMimeType?: string; error?: string; processingTime?: number }
): void {
  const stmt = db.prepare(`
    UPDATE batch_items
    SET status = ?, generated_image = ?, generated_mime_type = ?, error = ?, processing_time = ?
    WHERE id = ?
  `);
  stmt.run(
    status,
    result?.generatedImage || null,
    result?.generatedMimeType || null,
    result?.error || null,
    result?.processingTime || null,
    id
  );
}

export function incrementBatchCompleted(batchId: number, failed: boolean = false): void {
  if (failed) {
    const stmt = db.prepare('UPDATE batches SET completed_items = completed_items + 1, failed_items = failed_items + 1 WHERE id = ?');
    stmt.run(batchId);
  } else {
    const stmt = db.prepare('UPDATE batches SET completed_items = completed_items + 1 WHERE id = ?');
    stmt.run(batchId);
  }
}

export function getBatches(limit = 20, offset = 0): Batch[] {
  const stmt = db.prepare('SELECT * FROM batches ORDER BY created_at DESC LIMIT ? OFFSET ?');
  return stmt.all(limit, offset) as Batch[];
}

export function resetBatchItem(id: number): void {
  const stmt = db.prepare(`
    UPDATE batch_items SET status = 'pending', generated_image = NULL, generated_mime_type = NULL, error = NULL, processing_time = NULL
    WHERE id = ?
  `);
  stmt.run(id);
}

export function decrementBatchFailed(batchId: number): void {
  const stmt = db.prepare('UPDATE batches SET completed_items = completed_items - 1, failed_items = failed_items - 1 WHERE id = ?');
  stmt.run(batchId);
}

// PPTX types
export type PptxJobStatus = 'pending' | 'extracting' | 'processing' | 'assembling' | 'completed' | 'failed';
export type PptxSlideStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PptxJob {
  id: number;
  status: PptxJobStatus;
  original_filename: string;
  total_slides: number;
  completed_slides: number;
  failed_slides: number;
  prompt: string;
  preset: string | null;
  aspect_ratio: string | null;
  slide_width: number | null;
  slide_height: number | null;
  estimated_cost: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface PptxSlide {
  id: number;
  job_id: number;
  slide_number: number;
  status: PptxSlideStatus;
  original_image: string;
  beautified_image: string | null;
  error: string | null;
  processing_time: number | null;
  created_at: string;
}

export interface CreatePptxJobInput {
  filename: string;
  prompt: string;
  preset?: string;
  aspectRatio?: string;
  slideWidth?: number;
  slideHeight?: number;
  slides: Array<{
    slideNumber: number;
    imageData: string;
  }>;
}

const PPTX_COST_PER_SLIDE = 0.24;

export function createPptxJob(input: CreatePptxJobInput): number {
  const estimatedCost = input.slides.length * PPTX_COST_PER_SLIDE;

  const jobStmt = db.prepare(`
    INSERT INTO pptx_jobs (
      status, original_filename, total_slides, prompt, preset, aspect_ratio,
      slide_width, slide_height, estimated_cost
    ) VALUES ('pending', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const jobResult = jobStmt.run(
    input.filename,
    input.slides.length,
    input.prompt,
    input.preset || null,
    input.aspectRatio || null,
    input.slideWidth || null,
    input.slideHeight || null,
    estimatedCost
  );

  const jobId = jobResult.lastInsertRowid as number;

  const slideStmt = db.prepare(`
    INSERT INTO pptx_slides (job_id, slide_number, status, original_image)
    VALUES (?, ?, 'pending', ?)
  `);

  for (const slide of input.slides) {
    slideStmt.run(jobId, slide.slideNumber, slide.imageData);
  }

  return jobId;
}

export function getPptxJob(id: number): PptxJob | undefined {
  const stmt = db.prepare('SELECT * FROM pptx_jobs WHERE id = ?');
  return stmt.get(id) as PptxJob | undefined;
}

export function getPptxSlides(jobId: number): PptxSlide[] {
  const stmt = db.prepare('SELECT * FROM pptx_slides WHERE job_id = ? ORDER BY slide_number');
  return stmt.all(jobId) as PptxSlide[];
}

export function getPptxSlide(id: number): PptxSlide | undefined {
  const stmt = db.prepare('SELECT * FROM pptx_slides WHERE id = ?');
  return stmt.get(id) as PptxSlide | undefined;
}

export function getNextPendingPptxSlide(jobId: number): PptxSlide | undefined {
  const stmt = db.prepare(`
    SELECT * FROM pptx_slides
    WHERE job_id = ? AND status = 'pending'
    ORDER BY slide_number LIMIT 1
  `);
  return stmt.get(jobId) as PptxSlide | undefined;
}

export function updatePptxJobStatus(id: number, status: PptxJobStatus): void {
  const stmt = db.prepare(`
    UPDATE pptx_jobs SET status = ?, completed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = ?
  `);
  stmt.run(status, status, id);
}

export function updatePptxSlideStatus(
  id: number,
  status: PptxSlideStatus,
  result?: { beautifiedImage?: string; error?: string; processingTime?: number }
): void {
  const stmt = db.prepare(`
    UPDATE pptx_slides
    SET status = ?, beautified_image = ?, error = ?, processing_time = ?
    WHERE id = ?
  `);
  stmt.run(
    status,
    result?.beautifiedImage || null,
    result?.error || null,
    result?.processingTime || null,
    id
  );
}

export function incrementPptxCompleted(jobId: number, failed: boolean = false): void {
  if (failed) {
    const stmt = db.prepare('UPDATE pptx_jobs SET completed_slides = completed_slides + 1, failed_slides = failed_slides + 1 WHERE id = ?');
    stmt.run(jobId);
  } else {
    const stmt = db.prepare('UPDATE pptx_jobs SET completed_slides = completed_slides + 1 WHERE id = ?');
    stmt.run(jobId);
  }
}

export function getPptxJobs(limit = 20, offset = 0): PptxJob[] {
  const stmt = db.prepare('SELECT * FROM pptx_jobs ORDER BY created_at DESC LIMIT ? OFFSET ?');
  return stmt.all(limit, offset) as PptxJob[];
}

export function resetPptxSlide(id: number): void {
  const stmt = db.prepare(`
    UPDATE pptx_slides SET status = 'pending', beautified_image = NULL, error = NULL, processing_time = NULL
    WHERE id = ?
  `);
  stmt.run(id);
}

export function decrementPptxFailed(jobId: number): void {
  const stmt = db.prepare('UPDATE pptx_jobs SET completed_slides = completed_slides - 1, failed_slides = failed_slides - 1 WHERE id = ?');
  stmt.run(jobId);
}

export default db;

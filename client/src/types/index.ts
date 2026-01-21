export type PresetId = 'professional' | 'modern' | 'minimalist' | 'vibrant' | 'corporate' | 'gomedicus';

export type AspectRatio = '16:9' | '4:3' | '1:1' | 'auto';

export type MimeType = 'image/png' | 'image/jpeg' | 'image/webp';

export interface Preset {
  id: PresetId;
  name: string;
  description: string;
  prompt: string;
}

export interface UploadedImage {
  file: File;
  base64: string;
  mimeType: MimeType;
  preview: string;
}

export interface BeautifyRequest {
  image: string;
  mimeType: MimeType;
  prompt: string;
  aspectRatio?: AspectRatio;
  preset?: PresetId;
}

export interface BeautifyResponse {
  success: boolean;
  image?: string;
  mimeType?: MimeType;
  error?: string;
  errorCode?: ErrorCode;
  processingTime?: number;
  historyId?: number;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  error?: string;
}

export interface HistorySummary {
  id: number;
  prompt: string;
  preset: string | null;
  aspectRatio: string | null;
  processingTime: number | null;
  createdAt: string;
  hasThumbnail: boolean;
}

export interface HistoryEntry {
  id: number;
  originalImage: string;
  originalMimeType: MimeType;
  generatedImage: string;
  generatedMimeType: MimeType;
  prompt: string;
  preset: string | null;
  aspectRatio: string | null;
  processingTime: number | null;
  createdAt: string;
}

export interface HistoryListResponse {
  entries: HistorySummary[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export type ErrorCode =
  | 'INVALID_IMAGE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'API_ERROR'
  | 'SAFETY_FILTER'
  | 'RATE_LIMIT'
  | 'UNKNOWN';

export interface AppState {
  uploadedImage: UploadedImage | null;
  selectedPreset: PresetId;
  customPrompt: string;
  aspectRatio: AspectRatio;
  generatedImage: string | null;
  isGenerating: boolean;
  error: string | null;
}

// Batch types
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type BatchItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BatchItemSummary {
  id: number;
  filename: string;
  status: BatchItemStatus;
  error: string | null;
  processingTime: number | null;
  hasResult: boolean;
}

export interface BatchResponse {
  id: number;
  status: BatchStatus;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  prompt: string;
  preset: string | null;
  aspectRatio: string | null;
  estimatedCost: number | null;
  createdAt: string;
  completedAt: string | null;
  items: BatchItemSummary[];
  isProcessing: boolean;
}

export interface BatchItemDetail {
  id: number;
  filename: string;
  status: BatchItemStatus;
  error: string | null;
  processingTime: number | null;
  originalImage: string;
  originalMimeType: string;
  generatedImage: string | null;
  generatedMimeType: string | null;
}

export interface CreateBatchResponse {
  id: number;
  estimatedCost: number;
  totalItems: number;
}

export interface BatchFile {
  file: File;
  base64: string;
  mimeType: MimeType;
  preview: string;
}

// PPTX types
export type PptxJobStatus = 'pending' | 'extracting' | 'processing' | 'assembling' | 'completed' | 'failed';
export type PptxSlideStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PptxSlideSummary {
  id: number;
  slideNumber: number;
  status: PptxSlideStatus;
  error: string | null;
  processingTime: number | null;
  hasResult: boolean;
}

export interface PptxJobResponse {
  jobId: number;
  status: PptxJobStatus;
  filename: string;
  totalSlides: number;
  completedSlides: number;
  failedSlides: number;
  prompt: string;
  preset: string | null;
  aspectRatio: string | null;
  estimatedCost: number | null;
  createdAt: string;
  completedAt: string | null;
  slides: PptxSlideSummary[];
  isProcessing: boolean;
}

export interface PptxSlideDetail {
  id: number;
  slideNumber: number;
  status: PptxSlideStatus;
  error: string | null;
  processingTime: number | null;
  originalImage: string;
  beautifiedImage: string | null;
}

export interface CreatePptxJobResponse {
  jobId: number;
  slideCount: number;
  estimatedCost: number;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface PptxDependencyCheck {
  ready: boolean;
  dependencies: {
    libreoffice: boolean;
    pdftoppm: boolean;
    pdfinfo: boolean;
  };
  errors: string[];
}

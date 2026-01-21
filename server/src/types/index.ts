export type MimeType = 'image/png' | 'image/jpeg' | 'image/webp';

export type AspectRatio = '16:9' | '4:3' | '1:1';

export interface BeautifyRequest {
  image: string;
  mimeType: MimeType;
  prompt: string;
  aspectRatio?: AspectRatio;
  preset?: string;
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

export type ErrorCode =
  | 'INVALID_IMAGE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'API_ERROR'
  | 'SAFETY_FILTER'
  | 'RATE_LIMIT'
  | 'UNKNOWN';

export interface AppError extends Error {
  statusCode?: number;
  errorCode?: ErrorCode;
}

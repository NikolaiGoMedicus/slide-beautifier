import type {
  BeautifyRequest,
  BeautifyResponse,
  AuthResponse,
  HistoryListResponse,
  HistoryEntry,
  BatchResponse,
  BatchItemDetail,
  CreateBatchResponse,
  MimeType,
  PptxJobResponse,
  PptxSlideDetail,
  CreatePptxJobResponse,
  PptxDependencyCheck,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TOKEN_KEY = 'slide-beautifier-token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function authenticate(password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  const data = await response.json();

  if (data.success && data.token) {
    setStoredToken(data.token);
  }

  return data;
}

export async function beautifyImage(request: BeautifyRequest): Promise<BeautifyResponse> {
  const response = await fetch(`${API_URL}/api/beautify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (response.status === 401) {
    clearStoredToken();
    return {
      success: false,
      error: 'Authentication required',
      errorCode: 'UNKNOWN',
    };
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.error || 'An unexpected error occurred',
      errorCode: errorData.errorCode || 'UNKNOWN',
    };
  }

  return response.json();
}

export async function getHistory(limit = 20, offset = 0): Promise<HistoryListResponse> {
  const response = await fetch(`${API_URL}/api/history?limit=${limit}&offset=${offset}`, {
    headers: getAuthHeaders(),
  });

  if (response.status === 401) {
    clearStoredToken();
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    throw new Error('Failed to fetch history');
  }

  return response.json();
}

export async function getHistoryEntry(id: number): Promise<HistoryEntry> {
  const response = await fetch(`${API_URL}/api/history/${id}`, {
    headers: getAuthHeaders(),
  });

  if (response.status === 401) {
    clearStoredToken();
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    throw new Error('Failed to fetch history entry');
  }

  return response.json();
}

export async function getHistoryThumbnail(id: number): Promise<{ generatedImage: string; generatedMimeType: string }> {
  const response = await fetch(`${API_URL}/api/history/${id}/thumbnail`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch thumbnail');
  }

  return response.json();
}

export async function deleteHistoryEntry(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/history/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete history entry');
  }
}

// Batch API functions

export interface CreateBatchInput {
  prompt: string;
  preset?: string;
  aspectRatio?: string;
  items: Array<{
    filename: string;
    image: string;
    mimeType: MimeType;
  }>;
}

export async function createBatch(input: CreateBatchInput): Promise<CreateBatchResponse> {
  const response = await fetch(`${API_URL}/api/batch`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });

  if (response.status === 401) {
    clearStoredToken();
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create batch');
  }

  return response.json();
}

export async function getBatchStatus(id: number): Promise<BatchResponse> {
  const response = await fetch(`${API_URL}/api/batch/${id}`, {
    headers: getAuthHeaders(),
  });

  if (response.status === 401) {
    clearStoredToken();
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    throw new Error('Failed to get batch status');
  }

  return response.json();
}

export async function getBatchItem(batchId: number, itemId: number): Promise<BatchItemDetail> {
  const response = await fetch(`${API_URL}/api/batch/${batchId}/items/${itemId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get batch item');
  }

  return response.json();
}

export async function retryBatchItem(batchId: number, itemId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/batch/${batchId}/items/${itemId}/retry`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to retry batch item');
  }
}

export async function cancelBatch(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/batch/${id}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to cancel batch');
  }
}

export function getBatchDownloadUrl(id: number): string {
  const token = getStoredToken();
  return `${API_URL}/api/batch/${id}/download?token=${token}`;
}

// PPTX API functions

export async function checkPptxDependencies(): Promise<PptxDependencyCheck> {
  const response = await fetch(`${API_URL}/api/pptx/check`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to check PPTX dependencies');
  }

  return response.json();
}

export interface CreatePptxJobInput {
  pptxData: string; // base64
  filename: string;
  prompt: string;
  preset?: string;
  aspectRatio?: string;
}

export async function createPptxJob(input: CreatePptxJobInput): Promise<CreatePptxJobResponse> {
  const response = await fetch(`${API_URL}/api/pptx/beautify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });

  if (response.status === 401) {
    clearStoredToken();
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create PPTX job');
  }

  return response.json();
}

export async function getPptxJobStatus(jobId: number): Promise<PptxJobResponse> {
  const response = await fetch(`${API_URL}/api/pptx/${jobId}/status`, {
    headers: getAuthHeaders(),
  });

  if (response.status === 401) {
    clearStoredToken();
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    throw new Error('Failed to get PPTX job status');
  }

  return response.json();
}

export async function getPptxSlide(jobId: number, slideId: number): Promise<PptxSlideDetail> {
  const response = await fetch(`${API_URL}/api/pptx/${jobId}/slides/${slideId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get PPTX slide');
  }

  return response.json();
}

export async function retryPptxSlide(jobId: number, slideId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/pptx/${jobId}/slides/${slideId}/retry`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to retry PPTX slide');
  }
}

export async function cancelPptxJob(jobId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/pptx/${jobId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to cancel PPTX job');
  }
}

export function getPptxDownloadUrl(jobId: number): string {
  const token = getStoredToken();
  return `${API_URL}/api/pptx/${jobId}/download?token=${token}`;
}

import { useState, useCallback } from 'react';
import type { BeautifyRequest, MimeType } from '@/types';
import { beautifyImage } from '@/lib/api';
import { base64ToDataUrl } from '@/lib/utils';

interface UseBeautifyResult {
  isGenerating: boolean;
  generatedImage: string | null;
  error: string | null;
  generate: (request: BeautifyRequest) => Promise<void>;
  reset: () => void;
  clearError: () => void;
  setGeneratedImage: (image: string | null) => void;
}

export function useBeautify(): UseBeautifyResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (request: BeautifyRequest) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await beautifyImage(request);

      if (response.success && response.image) {
        const mimeType = response.mimeType || 'image/png';
        const dataUrl = base64ToDataUrl(response.image, mimeType as MimeType);
        setGeneratedImage(dataUrl);
      } else {
        setError(response.error || 'Failed to generate image');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setGeneratedImage(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isGenerating,
    generatedImage,
    error,
    generate,
    reset,
    clearError,
    setGeneratedImage,
  };
}

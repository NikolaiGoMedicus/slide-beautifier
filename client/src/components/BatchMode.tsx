import { useState, useCallback, useEffect, useRef } from 'react';
import type { PresetId, AspectRatio, BatchFile, BatchResponse, BatchItemStatus } from '@/types';
import { getPresetPrompt } from '@/lib/presets';
import { fileToBase64, isValidMimeType, cn } from '@/lib/utils';
import { createBatch, getBatchStatus, retryBatchItem, cancelBatch, getBatchDownloadUrl } from '@/lib/api';

import { Card, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { PresetSelector } from './PresetSelector';
import { PromptEditor } from './PromptEditor';
import { AspectRatioSelector } from './AspectRatioSelector';
import { ErrorAlert } from './ErrorAlert';
import { Spinner } from './ui/Spinner';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const COST_PER_IMAGE = 0.24;

interface BatchModeProps {
  onBack: () => void;
}

type BatchStage = 'upload' | 'configure' | 'processing' | 'results';

export function BatchMode({ onBack }: BatchModeProps) {
  const [stage, setStage] = useState<BatchStage>('upload');
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<PresetId>('professional');
  const [customPrompt, setCustomPrompt] = useState(getPresetPrompt('professional'));
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Update prompt when preset changes
  useEffect(() => {
    setCustomPrompt(getPresetPrompt(selectedPreset));
  }, [selectedPreset]);

  // Poll for batch status
  useEffect(() => {
    if (batchId && stage === 'processing') {
      const poll = async () => {
        try {
          const status = await getBatchStatus(batchId);
          setBatchStatus(status);

          if (status.status === 'completed' || status.status === 'failed') {
            setStage('results');
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } catch (err) {
          console.error('Failed to poll batch status:', err);
        }
      };

      poll();
      pollIntervalRef.current = window.setInterval(poll, 2000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }
  }, [batchId, stage]);

  const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: BatchFile[] = [];
    const errors: string[] = [];

    for (const file of Array.from(selectedFiles)) {
      if (!isValidMimeType(file.type)) {
        errors.push(`${file.name}: Invalid format (must be PNG, JPG, or WEBP)`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const preview = URL.createObjectURL(file);
        newFiles.push({
          file,
          base64,
          mimeType: file.type as BatchFile['mimeType'],
          preview,
        });
      } catch {
        errors.push(`${file.name}: Failed to process`);
      }
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => {
      const file = prev[index];
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleStartBatch = useCallback(async () => {
    if (files.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await createBatch({
        prompt: customPrompt,
        preset: selectedPreset,
        aspectRatio: aspectRatio === 'auto' ? undefined : aspectRatio,
        items: files.map(f => ({
          filename: f.file.name,
          image: f.base64,
          mimeType: f.mimeType,
        })),
      });

      setBatchId(response.id);
      setStage('processing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start batch');
    } finally {
      setIsSubmitting(false);
    }
  }, [files, customPrompt, selectedPreset, aspectRatio]);

  const handleCancel = useCallback(async () => {
    if (batchId) {
      try {
        await cancelBatch(batchId);
      } catch (err) {
        console.error('Failed to cancel batch:', err);
      }
    }
  }, [batchId]);

  const handleRetry = useCallback(async (itemId: number) => {
    if (!batchId) return;

    try {
      await retryBatchItem(batchId, itemId);
      // Refresh status
      const status = await getBatchStatus(batchId);
      setBatchStatus(status);
      if (status.status === 'processing') {
        setStage('processing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry item');
    }
  }, [batchId]);

  const handleDownload = useCallback(() => {
    if (!batchId) return;
    window.open(getBatchDownloadUrl(batchId), '_blank');
  }, [batchId]);

  const handleReset = useCallback(() => {
    files.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
    setBatchId(null);
    setBatchStatus(null);
    setStage('upload');
    setError(null);
  }, [files]);

  const estimatedCost = files.length * COST_PER_IMAGE;

  const getStatusColor = (status: BatchItemStatus): string => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'processing': return 'bg-blue-500 animate-pulse';
      default: return 'bg-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Batch Processing</h2>
          <p className="text-sm text-gray-500">Process multiple slides at once</p>
        </div>
        <Button variant="secondary" onClick={onBack}>
          Back to Single Mode
        </Button>
      </div>

      {error && (
        <ErrorAlert message={error} onDismiss={() => setError(null)} />
      )}

      {/* Upload Stage */}
      {stage === 'upload' && (
        <Card>
          <CardTitle>Select Slides</CardTitle>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium text-blue-600">Click to select files</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">PNG, JPG, or WEBP (max 10MB each)</p>
          </div>

          {files.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{files.length} files selected</span>
                <button onClick={() => setFiles([])} className="text-sm text-red-600 hover:text-red-700">
                  Clear all
                </button>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700">Estimated cost:</span>
                  <span className="font-bold text-blue-900">${estimatedCost.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={() => setStage('configure')}>
                  Continue to Settings
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Configure Stage */}
      {stage === 'configure' && (
        <>
          <Card>
            <CardTitle>Style Preset</CardTitle>
            <PresetSelector selected={selectedPreset} onChange={setSelectedPreset} />
          </Card>

          <Card>
            <CardTitle>Prompt (applied to all slides)</CardTitle>
            <PromptEditor value={customPrompt} onChange={setCustomPrompt} />
          </Card>

          <Card>
            <CardTitle>Aspect Ratio</CardTitle>
            <AspectRatioSelector selected={aspectRatio} onChange={setAspectRatio} />
          </Card>

          <Card>
            <CardTitle>Summary</CardTitle>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Files:</span>
                <span className="font-medium">{files.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Preset:</span>
                <span className="font-medium capitalize">{selectedPreset}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estimated cost:</span>
                <span className="font-bold text-blue-600">${estimatedCost.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setStage('upload')}>
              Back
            </Button>
            <Button onClick={handleStartBatch} isLoading={isSubmitting}>
              Start Processing
            </Button>
          </div>
        </>
      )}

      {/* Processing Stage */}
      {stage === 'processing' && batchStatus && (
        <Card>
          <CardTitle>Processing...</CardTitle>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Spinner />
              <div>
                <p className="font-medium">
                  {batchStatus.completedItems} of {batchStatus.totalItems} completed
                </p>
                {batchStatus.failedItems > 0 && (
                  <p className="text-sm text-red-600">{batchStatus.failedItems} failed</p>
                )}
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(batchStatus.completedItems / batchStatus.totalItems) * 100}%` }}
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {batchStatus.items.map((item) => (
                <div
                  key={item.id}
                  className={cn('w-3 h-3 rounded-sm', getStatusColor(item.status))}
                  title={`${item.filename}: ${item.status}`}
                />
              ))}
            </div>

            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Results Stage */}
      {stage === 'results' && batchStatus && (
        <Card>
          <CardTitle>Results</CardTitle>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                batchStatus.failedItems === 0 ? 'bg-green-100' : 'bg-yellow-100'
              )}>
                {batchStatus.failedItems === 0 ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>
              <div>
                <p className="font-medium">
                  {batchStatus.completedItems - batchStatus.failedItems} of {batchStatus.totalItems} successful
                </p>
                {batchStatus.failedItems > 0 && (
                  <p className="text-sm text-yellow-600">{batchStatus.failedItems} failed (can retry)</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {batchStatus.items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'p-2 rounded-lg border',
                    item.status === 'completed' ? 'border-green-200 bg-green-50' :
                    item.status === 'failed' ? 'border-red-200 bg-red-50' :
                    'border-gray-200'
                  )}
                >
                  <p className="text-xs font-medium truncate mb-1">{item.filename}</p>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'text-xs',
                      item.status === 'completed' ? 'text-green-600' :
                      item.status === 'failed' ? 'text-red-600' : 'text-gray-500'
                    )}>
                      {item.status}
                    </span>
                    {item.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(item.id)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                  {item.error && (
                    <p className="text-xs text-red-500 mt-1 truncate" title={item.error}>
                      {item.error}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={handleReset}>
                Start New Batch
              </Button>
              {batchStatus.completedItems - batchStatus.failedItems > 0 && (
                <Button onClick={handleDownload}>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download ZIP
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

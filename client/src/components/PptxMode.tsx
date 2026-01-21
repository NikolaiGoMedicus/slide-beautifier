import { useState, useCallback, useEffect, useRef } from 'react';
import type { PresetId, AspectRatio, PptxJobResponse, PptxSlideStatus } from '@/types';
import { getPresetPrompt } from '@/lib/presets';
import { cn } from '@/lib/utils';
import {
  checkPptxDependencies,
  createPptxJob,
  getPptxJobStatus,
  retryPptxSlide,
  cancelPptxJob,
  getPptxDownloadUrl,
} from '@/lib/api';

import { Card, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { PresetSelector } from './PresetSelector';
import { PromptEditor } from './PromptEditor';
import { AspectRatioSelector } from './AspectRatioSelector';
import { ErrorAlert } from './ErrorAlert';
import { Spinner } from './ui/Spinner';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface PptxModeProps {
  onBack: () => void;
}

type PptxStage = 'upload' | 'configure' | 'processing' | 'results';

interface PptxFile {
  file: File;
  base64: string;
}

export function PptxMode({ onBack }: PptxModeProps) {
  const [stage, setStage] = useState<PptxStage>('upload');
  const [pptxFile, setPptxFile] = useState<PptxFile | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetId>('professional');
  const [customPrompt, setCustomPrompt] = useState(getPresetPrompt('professional'));
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<PptxJobResponse | null>(null);
    const [depsChecked, setDepsChecked] = useState(false);
  const [depsReady, setDepsReady] = useState(false);
  const [depsErrors, setDepsErrors] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Check dependencies on mount
  useEffect(() => {
    async function checkDeps() {
      try {
        const result = await checkPptxDependencies();
        setDepsReady(result.ready);
        setDepsErrors(result.errors);
      } catch (err) {
        setDepsErrors(['Failed to check system dependencies']);
      } finally {
        setDepsChecked(true);
      }
    }
    checkDeps();
  }, []);

  // Update prompt when preset changes
  useEffect(() => {
    setCustomPrompt(getPresetPrompt(selectedPreset));
  }, [selectedPreset]);

  // Poll for job status
  useEffect(() => {
    if (jobId && stage === 'processing') {
      const poll = async () => {
        try {
          const status = await getPptxJobStatus(jobId);
          setJobStatus(status);

          if (status.status === 'completed' || status.status === 'failed') {
            setStage('results');
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } catch (err) {
          console.error('Failed to poll job status:', err);
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
  }, [jobId, stage]);

  const handleFileSelect = useCallback(async (file: File | null) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pptx')) {
      setError('Please select a .pptx file');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File too large (max 100MB)');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      setPptxFile({ file, base64 });
      setError(null);
    } catch {
      setError('Failed to read file');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleStartJob = useCallback(async () => {
    if (!pptxFile) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await createPptxJob({
        pptxData: pptxFile.base64,
        filename: pptxFile.file.name,
        prompt: customPrompt,
        preset: selectedPreset,
        aspectRatio: aspectRatio === 'auto' ? undefined : aspectRatio,
      });

      setJobId(response.jobId);
      setStage('processing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start job');
    } finally {
      setIsSubmitting(false);
    }
  }, [pptxFile, customPrompt, selectedPreset, aspectRatio]);

  const handleCancel = useCallback(async () => {
    if (jobId) {
      try {
        await cancelPptxJob(jobId);
      } catch (err) {
        console.error('Failed to cancel job:', err);
      }
    }
  }, [jobId]);

  const handleRetry = useCallback(async (slideId: number) => {
    if (!jobId) return;

    try {
      await retryPptxSlide(jobId, slideId);
      const status = await getPptxJobStatus(jobId);
      setJobStatus(status);
      if (status.status === 'processing') {
        setStage('processing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry slide');
    }
  }, [jobId]);

  const handleDownload = useCallback(() => {
    if (!jobId) return;
    window.open(getPptxDownloadUrl(jobId), '_blank');
  }, [jobId]);

  const handleReset = useCallback(() => {
    setPptxFile(null);
    setJobId(null);
    setJobStatus(null);
    setStage('upload');
    setError(null);
  }, []);

  const getStatusColor = (status: PptxSlideStatus): string => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'processing': return 'bg-blue-500 animate-pulse';
      default: return 'bg-gray-300';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending': return 'Waiting...';
      case 'extracting': return 'Extracting slides...';
      case 'processing': return 'Beautifying slides...';
      case 'assembling': return 'Creating PPTX...';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  // Show loading while checking dependencies
  if (!depsChecked) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">PPTX Automation</h2>
            <p className="text-sm text-gray-500">Beautify entire PowerPoint presentations</p>
          </div>
          <Button variant="secondary" onClick={onBack}>
            Back to Single Mode
          </Button>
        </div>
        <Card>
          <div className="flex items-center justify-center py-8">
            <Spinner />
            <span className="ml-3 text-gray-600">Checking system dependencies...</span>
          </div>
        </Card>
      </div>
    );
  }

  // Show error if dependencies are not ready
  if (!depsReady) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">PPTX Automation</h2>
            <p className="text-sm text-gray-500">Beautify entire PowerPoint presentations</p>
          </div>
          <Button variant="secondary" onClick={onBack}>
            Back to Single Mode
          </Button>
        </div>
        <Card>
          <CardTitle>System Dependencies Required</CardTitle>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-red-700 font-medium mb-2">
              PPTX processing requires the following system dependencies:
            </p>
            <ul className="list-disc list-inside text-red-600 space-y-1">
              {depsErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">PPTX Automation</h2>
          <p className="text-sm text-gray-500">Beautify entire PowerPoint presentations</p>
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
          <CardTitle>Select PowerPoint File</CardTitle>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pptx"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium text-blue-600">Click to select</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">PowerPoint files only (.pptx, max 100MB)</p>
          </div>

          {pptxFile && (
            <div className="mt-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{pptxFile.file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(pptxFile.file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPptxFile(null);
                  }}
                  className="text-red-500 hover:text-red-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
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
      {stage === 'configure' && pptxFile && (
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
                <span className="text-gray-600">File:</span>
                <span className="font-medium">{pptxFile.file.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Preset:</span>
                <span className="font-medium capitalize">{selectedPreset}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Slides:</span>
                <span className="italic">Determined after extraction</span>
              </div>
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setStage('upload')}>
              Back
            </Button>
            <Button onClick={handleStartJob} isLoading={isSubmitting}>
              Start Processing
            </Button>
          </div>
        </>
      )}

      {/* Processing Stage */}
      {stage === 'processing' && jobStatus && (
        <Card>
          <CardTitle>Processing...</CardTitle>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Spinner />
              <div>
                <p className="font-medium">{getStatusText(jobStatus.status)}</p>
                <p className="text-sm text-gray-600">
                  {jobStatus.completedSlides} of {jobStatus.totalSlides} slides completed
                </p>
                {jobStatus.failedSlides > 0 && (
                  <p className="text-sm text-red-600">{jobStatus.failedSlides} failed</p>
                )}
              </div>
            </div>

            {jobStatus.estimatedCost && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700">Estimated cost:</span>
                  <span className="font-bold text-blue-900">${jobStatus.estimatedCost.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(jobStatus.completedSlides / jobStatus.totalSlides) * 100}%` }}
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {jobStatus.slides.map((slide) => (
                <div
                  key={slide.id}
                  className={cn('w-3 h-3 rounded-sm', getStatusColor(slide.status))}
                  title={`Slide ${slide.slideNumber}: ${slide.status}`}
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
      {stage === 'results' && jobStatus && (
        <Card>
          <CardTitle>Results</CardTitle>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                jobStatus.failedSlides === 0 ? 'bg-green-100' : 'bg-yellow-100'
              )}>
                {jobStatus.failedSlides === 0 ? (
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
                  {jobStatus.completedSlides - jobStatus.failedSlides} of {jobStatus.totalSlides} slides beautified
                </p>
                {jobStatus.failedSlides > 0 && (
                  <p className="text-sm text-yellow-600">
                    {jobStatus.failedSlides} failed (original slides used as fallback)
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {jobStatus.slides.map((slide) => (
                <div
                  key={slide.id}
                  className={cn(
                    'p-2 rounded-lg border text-center',
                    slide.status === 'completed' ? 'border-green-200 bg-green-50' :
                    slide.status === 'failed' ? 'border-red-200 bg-red-50' :
                    'border-gray-200'
                  )}
                >
                  <p className="text-xs font-medium">Slide {slide.slideNumber}</p>
                  <div className="flex items-center justify-center mt-1">
                    <span className={cn(
                      'text-xs',
                      slide.status === 'completed' ? 'text-green-600' :
                      slide.status === 'failed' ? 'text-red-600' : 'text-gray-500'
                    )}>
                      {slide.status === 'completed' ? '✓' : slide.status === 'failed' ? '✗' : '...'}
                    </span>
                  </div>
                  {slide.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(slide.id)}
                      className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={handleReset}>
                Start New
              </Button>
              {(jobStatus.status === 'completed' || jobStatus.completedSlides - jobStatus.failedSlides > 0) && (
                <Button onClick={handleDownload}>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PPTX
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

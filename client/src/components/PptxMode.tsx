import { useState, useCallback, useEffect, useRef } from 'react';
import type { PresetId, AspectRatio, PptxJobResponse, PptxSlideStatus } from '@/types';
import { getPresetPrompt } from '@/lib/presets';
import { cn } from '@/lib/utils';
import {
  checkPptxDependencies,
  createPptxJob,
  extractPptxSlides,
  getPptxJobStatus,
  getPptxJobs,
  retryPptxSlide,
  cancelPptxJob,
  getPptxDownloadUrl,
  getPptxSlideThumbnail,
  getPptxSlide,
  type PptxSlideThumbnail,
  type ExtractPptxResponse,
  type PptxJobSummary,
} from '@/lib/api';

import { Card, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { PresetSelector } from './PresetSelector';
import { PromptEditor } from './PromptEditor';
import { AspectRatioSelector } from './AspectRatioSelector';
import { ErrorAlert } from './ErrorAlert';
import { Spinner } from './ui/Spinner';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const COST_PER_SLIDE = 0.24;

interface PptxModeProps {
  onBack: () => void;
}

type PptxStage = 'upload' | 'select' | 'configure' | 'processing' | 'results';

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
  const [thumbnails, setThumbnails] = useState<Map<number, PptxSlideThumbnail>>(new Map());
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState<{ id: number; slideNumber: number } | null>(null);
  const [fullSlideImages, setFullSlideImages] = useState<{ original: string; beautified: string | null } | null>(null);
  const [loadingFullImages, setLoadingFullImages] = useState(false);

  // Extraction and slide selection state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ExtractPptxResponse | null>(null);
  const [selectedSlideNumbers, setSelectedSlideNumbers] = useState<Set<number>>(new Set());

  // History state
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [jobHistory, setJobHistory] = useState<PptxJobSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewingJobId, setViewingJobId] = useState<number | null>(null);
  const [viewingFromHistory, setViewingFromHistory] = useState(false);

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

  // Fetch job history when history tab is active
  useEffect(() => {
    if (activeTab === 'history') {
      setLoadingHistory(true);
      getPptxJobs(50, 0)
        .then((response) => {
          setJobHistory(response.jobs);
        })
        .catch((err) => {
          console.error('Failed to fetch job history:', err);
        })
        .finally(() => {
          setLoadingHistory(false);
        });
    }
  }, [activeTab]);

  // Fetch thumbnails when entering results stage
  useEffect(() => {
    if (stage === 'results' && jobId && jobStatus && thumbnails.size === 0) {
      setLoadingThumbnails(true);
      const fetchThumbnails = async () => {
        const newThumbnails = new Map<number, PptxSlideThumbnail>();
        for (const slide of jobStatus.slides) {
          try {
            const thumbnail = await getPptxSlideThumbnail(jobId, slide.id);
            newThumbnails.set(slide.id, thumbnail);
          } catch (err) {
            console.error(`Failed to fetch thumbnail for slide ${slide.id}:`, err);
          }
        }
        setThumbnails(newThumbnails);
        setLoadingThumbnails(false);
      };
      fetchThumbnails();
    }
  }, [stage, jobId, jobStatus, thumbnails.size]);

  // Fetch full images when a slide is selected for comparison
  useEffect(() => {
    if (selectedSlide && jobId) {
      setLoadingFullImages(true);
      setFullSlideImages(null);
      getPptxSlide(jobId, selectedSlide.id)
        .then((slide) => {
          setFullSlideImages({
            original: slide.originalImage,
            beautified: slide.beautifiedImage,
          });
        })
        .catch((err) => {
          console.error('Failed to fetch full slide images:', err);
        })
        .finally(() => {
          setLoadingFullImages(false);
        });
    }
  }, [selectedSlide, jobId]);

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

  // Extract slides from PPTX for selection
  const handleExtractSlides = useCallback(async () => {
    if (!pptxFile) return;

    setIsExtracting(true);
    setError(null);

    try {
      const result = await extractPptxSlides({
        pptxData: pptxFile.base64,
        filename: pptxFile.file.name,
      });

      setExtraction(result);
      // Select all slides by default
      setSelectedSlideNumbers(new Set(result.slides.map(s => s.slideNumber)));
      setStage('select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract slides');
    } finally {
      setIsExtracting(false);
    }
  }, [pptxFile]);

  // Toggle slide selection
  const toggleSlideSelection = useCallback((slideNumber: number) => {
    setSelectedSlideNumbers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slideNumber)) {
        newSet.delete(slideNumber);
      } else {
        newSet.add(slideNumber);
      }
      return newSet;
    });
  }, []);

  // Select/deselect all slides
  const toggleAllSlides = useCallback((selectAll: boolean) => {
    if (!extraction) return;
    if (selectAll) {
      setSelectedSlideNumbers(new Set(extraction.slides.map(s => s.slideNumber)));
    } else {
      setSelectedSlideNumbers(new Set());
    }
  }, [extraction]);

  // View a job from history
  const handleViewJob = useCallback(async (jobIdToView: number) => {
    setViewingJobId(jobIdToView);
    setError(null);

    try {
      const status = await getPptxJobStatus(jobIdToView);
      setJobId(jobIdToView);
      setJobStatus(status);
      setThumbnails(new Map());
      setViewingFromHistory(true);

      if (status.status === 'completed' || status.status === 'failed') {
        setStage('results');
      } else {
        setStage('processing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setViewingJobId(null);
    }
  }, []);

  // Go back to history view
  const handleBackToHistory = useCallback(() => {
    setJobId(null);
    setJobStatus(null);
    setStage('upload');
    setThumbnails(new Map());
    setSelectedSlide(null);
    setFullSlideImages(null);
    setViewingFromHistory(false);
    setActiveTab('history');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleStartJob = useCallback(async () => {
    if (!extraction) return;

    if (selectedSlideNumbers.size === 0) {
      setError('Please select at least one slide to beautify');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await createPptxJob({
        extractionId: extraction.extractionId,
        selectedSlides: Array.from(selectedSlideNumbers).sort((a, b) => a - b),
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
  }, [extraction, selectedSlideNumbers, customPrompt, selectedPreset, aspectRatio]);

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
    setThumbnails(new Map());
    setSelectedSlide(null);
    setFullSlideImages(null);
    setExtraction(null);
    setSelectedSlideNumbers(new Set());
    setViewingFromHistory(false);
    setActiveTab('new');
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

      {/* Tabs */}
      {stage === 'upload' && (
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('new')}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'new'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            New Job
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            History
          </button>
        </div>
      )}

      {error && (
        <ErrorAlert message={error} onDismiss={() => setError(null)} />
      )}

      {/* History View */}
      {stage === 'upload' && activeTab === 'history' && (
        <Card>
          <CardTitle>Past Jobs</CardTitle>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
              <span className="ml-3 text-gray-600">Loading job history...</span>
            </div>
          ) : jobHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No jobs yet. Start by creating a new job.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {jobHistory.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-4 px-4 cursor-pointer transition-colors"
                  onClick={() => handleViewJob(job.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      job.status === 'completed' ? 'bg-green-100' :
                      job.status === 'failed' ? 'bg-red-100' :
                      job.status === 'processing' ? 'bg-blue-100' :
                      'bg-gray-100'
                    )}>
                      {job.status === 'completed' ? (
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : job.status === 'failed' ? (
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : job.status === 'processing' ? (
                        <Spinner className="w-5 h-5" />
                      ) : (
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{job.filename}</p>
                      <p className="text-xs text-gray-500">
                        {job.completedSlides}/{job.totalSlides} slides
                        {job.failedSlides > 0 && ` (${job.failedSlides} failed)`}
                        {' · '}
                        {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn(
                      'text-xs px-2 py-1 rounded-full',
                      job.status === 'completed' ? 'bg-green-100 text-green-700' :
                      job.status === 'failed' ? 'bg-red-100 text-red-700' :
                      job.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {job.status === 'completed' ? 'Completed' :
                       job.status === 'failed' ? 'Failed' :
                       job.status === 'processing' ? 'Processing' :
                       job.status}
                    </span>
                    {viewingJobId === job.id ? (
                      <Spinner className="w-4 h-4" />
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Upload Stage */}
      {stage === 'upload' && activeTab === 'new' && (
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
                <Button onClick={handleExtractSlides} isLoading={isExtracting}>
                  Extract Slides
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Select Slides Stage */}
      {stage === 'select' && extraction && (
        <Card>
          <CardTitle>Select Slides to Beautify</CardTitle>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{pptxFile?.file.name}</p>
                <p className="text-sm text-gray-600">
                  {extraction.slideCount} slides extracted
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAllSlides(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => toggleAllSlides(false)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {extraction.slides.map((slide) => {
                const isSelected = selectedSlideNumbers.has(slide.slideNumber);
                return (
                  <div
                    key={slide.slideNumber}
                    onClick={() => toggleSlideSelection(slide.slideNumber)}
                    className={cn(
                      'relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all',
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="relative aspect-video bg-gray-100">
                      <img
                        src={`data:image/png;base64,${slide.thumbnail}`}
                        alt={`Slide ${slide.slideNumber}`}
                        className={cn(
                          'w-full h-full object-contain transition-opacity',
                          !isSelected && 'opacity-50'
                        )}
                      />
                      <div className={cn(
                        'absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-white border-gray-300'
                      )}>
                        {isSelected && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                        {slide.slideNumber}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-700">
                  {selectedSlideNumbers.size} of {extraction.slideCount} slides selected
                </span>
                <span className="font-bold text-blue-900">
                  Est. ${(selectedSlideNumbers.size * COST_PER_SLIDE).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setStage('upload')}>
                Back
              </Button>
              <Button
                onClick={() => setStage('configure')}
                disabled={selectedSlideNumbers.size === 0}
              >
                Continue to Settings ({selectedSlideNumbers.size} slides)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Configure Stage */}
      {stage === 'configure' && extraction && (
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
                <span className="font-medium">{pptxFile?.file.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Preset:</span>
                <span className="font-medium capitalize">{selectedPreset}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Slides to beautify:</span>
                <span className="font-medium">{selectedSlideNumbers.size} of {extraction.slideCount}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-600">Estimated cost:</span>
                <span className="font-bold text-blue-600">${(selectedSlideNumbers.size * COST_PER_SLIDE).toFixed(2)}</span>
              </div>
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setStage('select')}>
              Back
            </Button>
            <Button onClick={handleStartJob} isLoading={isSubmitting}>
              Start Processing ({selectedSlideNumbers.size} slides)
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

            <div className="flex gap-3">
              {viewingFromHistory && (
                <Button variant="secondary" onClick={handleBackToHistory}>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to History
                </Button>
              )}
              <Button variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Results Stage */}
      {stage === 'results' && jobStatus && (
        <>
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

              {/* Thumbnail Grid */}
              {loadingThumbnails ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                  <span className="ml-3 text-gray-600">Loading slide previews...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {jobStatus.slides.map((slide) => {
                    const thumbnail = thumbnails.get(slide.id);
                    return (
                      <div
                        key={slide.id}
                        onClick={() => setSelectedSlide({ id: slide.id, slideNumber: slide.slideNumber })}
                        className={cn(
                          'rounded-lg border overflow-hidden cursor-pointer transition-all hover:shadow-lg',
                          slide.status === 'completed' ? 'border-green-200' :
                          slide.status === 'failed' ? 'border-red-200' :
                          'border-gray-200'
                        )}
                      >
                        <div className="relative aspect-video bg-gray-100">
                          {thumbnail?.beautifiedThumbnail ? (
                            <img
                              src={`data:image/png;base64,${thumbnail.beautifiedThumbnail}`}
                              alt={`Slide ${slide.slideNumber} beautified`}
                              className="w-full h-full object-contain"
                            />
                          ) : thumbnail?.originalThumbnail ? (
                            <img
                              src={`data:image/png;base64,${thumbnail.originalThumbnail}`}
                              alt={`Slide ${slide.slideNumber} original`}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div className={cn(
                            'absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                            slide.status === 'completed' ? 'bg-green-500 text-white' :
                            slide.status === 'failed' ? 'bg-red-500 text-white' :
                            'bg-gray-300 text-gray-700'
                          )}>
                            {slide.slideNumber}
                          </div>
                        </div>
                        <div className="p-2 bg-white">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Slide {slide.slideNumber}</span>
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              slide.status === 'completed' ? 'bg-green-100 text-green-700' :
                              slide.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            )}>
                              {slide.status === 'completed' ? 'Done' : slide.status === 'failed' ? 'Failed' : 'Pending'}
                            </span>
                          </div>
                          {slide.status === 'failed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetry(slide.id);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                {viewingFromHistory && (
                  <Button variant="secondary" onClick={handleBackToHistory}>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to History
                  </Button>
                )}
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

          {/* Comparison Modal */}
          {selectedSlide && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
              onClick={() => setSelectedSlide(null)}
            >
              <div
                className="bg-white rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-semibold">Slide {selectedSlide.slideNumber} Comparison</h3>
                  <button
                    onClick={() => setSelectedSlide(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-4">
                  {loadingFullImages ? (
                    <div className="flex items-center justify-center py-16">
                      <Spinner />
                      <span className="ml-3 text-gray-600">Loading full images...</span>
                    </div>
                  ) : fullSlideImages ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Original</h4>
                        <div className="border rounded-lg overflow-hidden bg-gray-50">
                          <img
                            src={`data:image/png;base64,${fullSlideImages.original}`}
                            alt="Original slide"
                            className="w-full h-auto"
                          />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Beautified</h4>
                        <div className="border rounded-lg overflow-hidden bg-gray-50">
                          {fullSlideImages.beautified ? (
                            <img
                              src={`data:image/png;base64,${fullSlideImages.beautified}`}
                              alt="Beautified slide"
                              className="w-full h-auto"
                            />
                          ) : (
                            <div className="flex items-center justify-center py-16 text-gray-400">
                              <span>No beautified image available</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-16 text-gray-400">
                      <span>Failed to load images</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

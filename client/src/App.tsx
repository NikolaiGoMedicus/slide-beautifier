import { useState, useCallback, useEffect } from 'react';
import type { UploadedImage, PresetId, AspectRatio, HistoryEntry } from '@/types';
import { getPresetPrompt } from '@/lib/presets';
import { useBeautify } from '@/hooks/useBeautify';
import { useAuth } from '@/hooks/useAuth';
import { base64ToDataUrl } from '@/lib/utils';

import { Header } from '@/components/Header';
import { Card, CardTitle } from '@/components/ui/Card';
import { DropZone } from '@/components/DropZone';
import { ImagePreview } from '@/components/ImagePreview';
import { PresetSelector } from '@/components/PresetSelector';
import { PromptEditor } from '@/components/PromptEditor';
import { AspectRatioSelector } from '@/components/AspectRatioSelector';
import { GenerateButton } from '@/components/GenerateButton';
import { ComparisonView } from '@/components/ComparisonView';
import { DownloadButton } from '@/components/DownloadButton';
import { RegenerateButton } from '@/components/RegenerateButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PasswordModal } from '@/components/PasswordModal';
import { HistoryPanel } from '@/components/HistoryPanel';
import { Spinner } from '@/components/ui/Spinner';
import { BatchMode } from '@/components/BatchMode';
import { PptxMode } from '@/components/PptxMode';

type AppMode = 'single' | 'batch' | 'pptx';

export default function App() {
  const { isAuthenticated, isLoading: authLoading, error: authError, login, logout } = useAuth();

  const [mode, setMode] = useState<AppMode>('single');
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetId>('professional');
  const [customPrompt, setCustomPrompt] = useState(getPresetPrompt('professional'));
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { isGenerating, generatedImage, error, generate, reset, clearError, setGeneratedImage } = useBeautify();

  // Update prompt when preset changes
  useEffect(() => {
    setCustomPrompt(getPresetPrompt(selectedPreset));
  }, [selectedPreset]);

  const handleUpload = useCallback((image: UploadedImage) => {
    setUploadedImage(image);
    setUploadError(null);
    reset();
  }, [reset]);

  const handleRemoveImage = useCallback(() => {
    if (uploadedImage?.preview) {
      URL.revokeObjectURL(uploadedImage.preview);
    }
    setUploadedImage(null);
    reset();
  }, [uploadedImage, reset]);

  const handleGenerate = useCallback(async () => {
    if (!uploadedImage) return;

    await generate({
      image: uploadedImage.base64,
      mimeType: uploadedImage.mimeType,
      prompt: customPrompt,
      aspectRatio: aspectRatio === 'auto' ? undefined : aspectRatio,
      preset: selectedPreset,
    });
  }, [uploadedImage, customPrompt, aspectRatio, selectedPreset, generate]);

  const handleSelectHistoryEntry = useCallback((entry: HistoryEntry) => {
    // Create a fake UploadedImage from the history entry
    const originalDataUrl = base64ToDataUrl(entry.originalImage, entry.originalMimeType);
    const generatedDataUrl = base64ToDataUrl(entry.generatedImage, entry.generatedMimeType);

    setUploadedImage({
      file: new File([], 'from-history'),
      base64: entry.originalImage,
      mimeType: entry.originalMimeType,
      preview: originalDataUrl,
    });

    setCustomPrompt(entry.prompt);
    if (entry.preset) {
      setSelectedPreset(entry.preset as PresetId);
    }
    if (entry.aspectRatio) {
      setAspectRatio(entry.aspectRatio as AspectRatio);
    }

    setGeneratedImage(generatedDataUrl);
  }, [setGeneratedImage]);

  const canGenerate = uploadedImage && customPrompt.length > 0 && customPrompt.length <= 2000;

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Show password modal if not authenticated
  if (!isAuthenticated) {
    return <PasswordModal onSubmit={login} error={authError} isLoading={authLoading} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onOpenHistory={() => setHistoryOpen(true)} onLogout={logout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mode Toggle */}
        {mode === 'single' && (
          <div className="mb-6 flex justify-end gap-2">
            <button
              onClick={() => setMode('batch')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Batch Mode
            </button>
            <button
              onClick={() => setMode('pptx')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PPTX Mode
            </button>
          </div>
        )}

        {mode === 'batch' ? (
          <BatchMode onBack={() => setMode('single')} />
        ) : mode === 'pptx' ? (
          <PptxMode onBack={() => setMode('single')} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Upload & Controls */}
            <div className="space-y-6">
              {/* Upload Section */}
              <Card>
                <CardTitle>Upload Slide</CardTitle>
                {uploadError && (
                  <div className="mb-4">
                    <ErrorAlert message={uploadError} onDismiss={() => setUploadError(null)} />
                  </div>
                )}
                {uploadedImage ? (
                  <ImagePreview
                    image={uploadedImage}
                    onRemove={handleRemoveImage}
                    disabled={isGenerating}
                  />
                ) : (
                  <DropZone
                    onUpload={handleUpload}
                    onError={setUploadError}
                    disabled={isGenerating}
                  />
                )}
              </Card>

              {/* Style Presets */}
              <Card>
                <CardTitle>Style Preset</CardTitle>
                <PresetSelector
                  selected={selectedPreset}
                  onChange={setSelectedPreset}
                  disabled={isGenerating}
                />
              </Card>

              {/* Prompt Editor */}
              <Card>
                <CardTitle>Prompt</CardTitle>
                <PromptEditor
                  value={customPrompt}
                  onChange={setCustomPrompt}
                  disabled={isGenerating}
                />
              </Card>

              {/* Aspect Ratio */}
              <Card>
                <CardTitle>Aspect Ratio</CardTitle>
                <AspectRatioSelector
                  selected={aspectRatio}
                  onChange={setAspectRatio}
                  disabled={isGenerating}
                />
              </Card>

              {/* Generate Button */}
              <div className="flex justify-center">
                <GenerateButton
                  onClick={handleGenerate}
                  isLoading={isGenerating}
                  disabled={!canGenerate}
                />
              </div>
            </div>

            {/* Right Column - Results */}
            <div className="space-y-6">
              <Card className="min-h-[400px]">
                <CardTitle>Result</CardTitle>

                {error && (
                  <div className="mb-4">
                    <ErrorAlert message={error} onDismiss={clearError} />
                  </div>
                )}

                {isGenerating && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                    <p className="text-sm">Generating your enhanced slide...</p>
                    <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
                  </div>
                )}

                {!isGenerating && !generatedImage && !error && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <svg
                      className="w-16 h-16 mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-sm">Your enhanced slide will appear here</p>
                  </div>
                )}

                {!isGenerating && generatedImage && uploadedImage && (
                  <>
                    <ComparisonView
                      originalSrc={uploadedImage.preview}
                      generatedSrc={generatedImage}
                    />

                    <div className="flex gap-3 mt-6 justify-center">
                      <DownloadButton imageDataUrl={generatedImage} />
                      <RegenerateButton onClick={handleGenerate} isLoading={isGenerating} />
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* History Panel */}
      <HistoryPanel
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelectEntry={handleSelectHistoryEntry}
      />
    </div>
  );
}

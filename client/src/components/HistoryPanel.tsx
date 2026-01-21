import { useState, useEffect, useCallback } from 'react';
import type { HistorySummary, HistoryEntry } from '@/types';
import { getHistory, getHistoryEntry, deleteHistoryEntry } from '@/lib/api';
import { base64ToDataUrl } from '@/lib/utils';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEntry: (entry: HistoryEntry) => void;
}

export function HistoryPanel({ isOpen, onClose, onSelectEntry }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getHistory(50, 0);
      setEntries(response.entries);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  const handleSelectEntry = useCallback(async (id: number) => {
    setSelectedId(id);
    setLoadingEntry(true);
    try {
      const entry = await getHistoryEntry(id);
      setSelectedEntry(entry);
    } catch (error) {
      console.error('Failed to load entry:', error);
    } finally {
      setLoadingEntry(false);
    }
  }, []);

  const handleUseEntry = useCallback(() => {
    if (selectedEntry) {
      onSelectEntry(selectedEntry);
      onClose();
    }
  }, [selectedEntry, onSelectEntry, onClose]);

  const handleDeleteEntry = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this entry?')) return;

    try {
      await deleteHistoryEntry(id);
      setEntries(prev => prev.filter(entry => entry.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedEntry(null);
      }
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  }, [selectedId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Generation History</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Entry List */}
          <div className="w-1/3 border-r overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No history yet
              </div>
            ) : (
              <div className="divide-y">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => handleSelectEntry(entry.id)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedId === entry.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900 truncate">
                          {entry.preset || 'Custom'}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {entry.prompt}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteEntry(entry.id, e)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 p-4 overflow-y-auto">
            {loadingEntry ? (
              <div className="flex items-center justify-center h-full">
                <Spinner />
              </div>
            ) : selectedEntry ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Original</p>
                    <img
                      src={base64ToDataUrl(selectedEntry.originalImage, selectedEntry.originalMimeType)}
                      alt="Original"
                      className="w-full rounded-lg border"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Generated</p>
                    <img
                      src={base64ToDataUrl(selectedEntry.generatedImage, selectedEntry.generatedMimeType)}
                      alt="Generated"
                      className="w-full rounded-lg border"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Prompt</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    {selectedEntry.prompt}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleUseEntry} className="flex-1">
                    Use This Result
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Select an entry to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

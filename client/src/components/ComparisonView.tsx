interface ComparisonViewProps {
  originalSrc: string;
  generatedSrc: string;
}

export function ComparisonView({ originalSrc, generatedSrc }: ComparisonViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">Original</h3>
        <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
          <img
            src={originalSrc}
            alt="Original slide"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">Generated</h3>
        <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
          <img
            src={generatedSrc}
            alt="Generated slide"
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

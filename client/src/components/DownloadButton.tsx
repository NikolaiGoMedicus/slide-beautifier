import { Button } from './ui/Button';
import { downloadImage } from '@/lib/utils';

interface DownloadButtonProps {
  imageDataUrl: string;
  filename?: string;
}

export function DownloadButton({ imageDataUrl, filename = 'beautified-slide.png' }: DownloadButtonProps) {
  const handleDownload = () => {
    downloadImage(imageDataUrl, filename);
  };

  return (
    <Button onClick={handleDownload} variant="primary">
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Download
    </Button>
  );
}

import type { UploadedImage } from '@/types';
import { formatFileSize } from '@/lib/utils';
import { Button } from './ui/Button';

interface ImagePreviewProps {
  image: UploadedImage;
  onRemove: () => void;
  disabled?: boolean;
}

export function ImagePreview({ image, onRemove, disabled }: ImagePreviewProps) {
  return (
    <div className="relative">
      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
        <img
          src={image.preview}
          alt="Uploaded slide"
          className="w-full h-full object-contain"
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{image.file.name}</p>
          <p className="text-xs text-gray-500">{formatFileSize(image.file.size)}</p>
        </div>

        <Button
          variant="secondary"
          onClick={onRemove}
          disabled={disabled}
          className="ml-3 text-sm"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

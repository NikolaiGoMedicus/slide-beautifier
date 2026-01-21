import type { AspectRatio } from '@/types';
import { cn } from '@/lib/utils';

interface AspectRatioSelectorProps {
  selected: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
  disabled?: boolean;
}

const RATIOS: { value: AspectRatio; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
];

export function AspectRatioSelector({ selected, onChange, disabled }: AspectRatioSelectorProps) {
  return (
    <div className="flex gap-2">
      {RATIOS.map((ratio) => (
        <button
          key={ratio.value}
          onClick={() => onChange(ratio.value)}
          disabled={disabled}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            selected === ratio.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {ratio.label}
        </button>
      ))}
    </div>
  );
}

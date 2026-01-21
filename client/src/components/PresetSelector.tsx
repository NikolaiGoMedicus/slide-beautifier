import type { PresetId } from '@/types';
import { PRESET_LIST } from '@/lib/presets';
import { cn } from '@/lib/utils';

interface PresetSelectorProps {
  selected: PresetId;
  onChange: (preset: PresetId) => void;
  disabled?: boolean;
}

export function PresetSelector({ selected, onChange, disabled }: PresetSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {PRESET_LIST.map((preset) => (
        <button
          key={preset.id}
          onClick={() => onChange(preset.id)}
          disabled={disabled}
          className={cn(
            'text-left p-4 rounded-lg border-2 transition-all',
            selected === preset.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              className={cn(
                'w-3 h-3 rounded-full',
                selected === preset.id ? 'bg-blue-500' : 'bg-gray-300'
              )}
            />
            <span className="font-medium text-gray-900">{preset.name}</span>
          </div>
          <p className="text-sm text-gray-500">{preset.description}</p>
        </button>
      ))}
    </div>
  );
}

import { cn } from '@/lib/utils';

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const MAX_LENGTH = 2000;

export function PromptEditor({ value, onChange, disabled }: PromptEditorProps) {
  const charCount = value.length;
  const isOverLimit = charCount > MAX_LENGTH;

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        placeholder="Describe how you want the slide to be transformed..."
        className={cn(
          'w-full px-4 py-3 rounded-lg border bg-white text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500',
          isOverLimit ? 'border-red-500' : 'border-gray-300',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
      <div className="mt-2 flex justify-end">
        <span
          className={cn(
            'text-sm',
            isOverLimit ? 'text-red-500' : 'text-gray-500'
          )}
        >
          {charCount} / {MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}

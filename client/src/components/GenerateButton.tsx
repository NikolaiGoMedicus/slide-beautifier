import { Button } from './ui/Button';

interface GenerateButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export function GenerateButton({ onClick, isLoading, disabled }: GenerateButtonProps) {
  return (
    <Button
      onClick={onClick}
      isLoading={isLoading}
      disabled={disabled}
      className="w-full sm:w-auto px-8 py-3 text-lg"
    >
      {isLoading ? 'Generating...' : 'Generate'}
    </Button>
  );
}

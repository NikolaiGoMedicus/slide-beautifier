import { Button } from './ui/Button';

interface RegenerateButtonProps {
  onClick: () => void;
  isLoading: boolean;
}

export function RegenerateButton({ onClick, isLoading }: RegenerateButtonProps) {
  return (
    <Button onClick={onClick} variant="secondary" isLoading={isLoading} disabled={isLoading}>
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
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      Try Again
    </Button>
  );
}

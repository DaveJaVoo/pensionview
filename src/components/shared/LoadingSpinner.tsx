
import type { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

const LoadingSpinner: FC<LoadingSpinnerProps> = ({ size = 24, className }) => {
  return (
    <Loader2
      style={{ width: size, height: size }}
      className={cn("animate-spin text-primary", className)}
    />
  );
};

export default LoadingSpinner;

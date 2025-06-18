
import type { FC } from 'react';

interface AppHeaderProps {
  title: string; 
}

const AppHeader: FC<AppHeaderProps> = ({ title }) => {
  return (
    <header className="py-4 px-4 md:px-6 bg-primary shadow-md flex flex-col items-center justify-center relative">
      <h1 className="text-3xl md:text-4xl font-headline font-bold text-primary-foreground text-center">
        PensionView+
      </h1>
      <p className="text-xs text-primary-foreground/80 mt-1">
        © Le Money Marchand Inc.
      </p>
    </header>
  );
};

export default AppHeader;

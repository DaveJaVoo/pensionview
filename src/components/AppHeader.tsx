
import type { FC } from 'react';

interface AppHeaderProps {
  title: string; // This prop will no longer be used for the main title text
}

const AppHeader: FC<AppHeaderProps> = ({ title }) => {
  return (
    <header className="py-4 px-4 md:px-6 bg-primary shadow-md flex items-center justify-center relative">
      <h1 className="text-3xl md:text-4xl font-headline font-bold text-primary-foreground text-center">
        PensionView+
      </h1>
    </header>
  );
};

export default AppHeader;

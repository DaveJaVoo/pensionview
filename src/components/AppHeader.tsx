
import type { FC } from 'react';

interface AppHeaderProps {
  title: string;
}

const AppHeader: FC<AppHeaderProps> = ({ title }) => {
  return (
    <header className="py-6 px-4 md:px-6 bg-primary shadow-md">
      <h1 className="text-3xl md:text-4xl font-headline font-bold text-primary-foreground text-center">
        {title}
      </h1>
    </header>
  );
};

export default AppHeader;

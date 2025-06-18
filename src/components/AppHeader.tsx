
import type { FC } from 'react';
import Image from 'next/image';

interface AppHeaderProps {
  title: string;
}

const AppHeader: FC<AppHeaderProps> = ({ title }) => {
  return (
    <header className="py-4 px-4 md:px-6 bg-primary shadow-md flex items-center justify-center relative">
      <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2">
        <Image
          key="logo-v3-refresh-attempt" // Changed key to a new static value
          src="/logo.png" 
          alt="My Pension Pilot Logo" 
          width={150} // Adjust width as needed for your logo
          height={40} // Adjust height as needed for your logo
          priority // Ensures the logo loads quickly
          className="h-auto" // Added to maintain aspect ratio if width/height are for max values
        />
      </div>
      <h1 className="text-3xl md:text-4xl font-headline font-bold text-primary-foreground text-center">
        {title}
      </h1>
    </header>
  );
};

export default AppHeader;

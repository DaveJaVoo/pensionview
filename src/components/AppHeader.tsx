
import type { FC } from 'react';
import Image from 'next/image';

interface AppHeaderProps {
  title: string;
}

const AppHeader: FC<AppHeaderProps> = ({ title }) => {
  return (
    <header className="py-4 px-4 md:px-6 bg-primary shadow-md flex items-center justify-center relative">
      {/* 
        TODO: Add your logo to the `public` folder.
        1. Create a `public` folder at the root of your project if it doesn't exist.
        2. Place your logo file (e.g., `logo.png`) inside the `public` folder.
        3. Adjust the `src`, `width`, `height`, and `alt` props below to match your logo.
        If your logo is named `my-logo.svg`, the src would be `/my-logo.svg`.
      */}
      <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2">
        <Image
          src="/logo.png" // Assumes your logo is named logo.png and is in the public folder
          alt="My Pension Pilot Logo" // Replace with your actual logo alt text
          width={150} // Adjust to your logo's width
          height={40} // Adjust to your logo's height
          priority // Add priority if the logo is LCP (Largest Contentful Paint)
          className="h-auto" // Added to maintain aspect ratio based on width/height
        />
      </div>
      <h1 className="text-3xl md:text-4xl font-headline font-bold text-primary-foreground text-center">
        {title}
      </h1>
    </header>
  );
};

export default AppHeader;

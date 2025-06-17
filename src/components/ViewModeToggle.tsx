
"use client";
import type { FC } from 'react';
import { Button } from "@/components/ui/button";
import { TableIcon, BarChart2Icon } from "lucide-react";

type ViewMode = 'table' | 'charts';

interface ViewModeToggleProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

const ViewModeToggle: FC<ViewModeToggleProps> = ({ currentMode, onModeChange }) => {
  return (
    <div className="flex gap-2 justify-center my-4">
      <Button
        variant={currentMode === 'table' ? 'default' : 'outline'}
        onClick={() => onModeChange('table')}
        aria-pressed={currentMode === 'table'}
        className="rounded-md shadow-sm hover:shadow-md transition-shadow"
      >
        <TableIcon className="mr-2 h-5 w-5" />
        Data Table
      </Button>
      <Button
        variant={currentMode === 'charts' ? 'default' : 'outline'}
        onClick={() => onModeChange('charts')}
        aria-pressed={currentMode === 'charts'}
        className="rounded-md shadow-sm hover:shadow-md transition-shadow"
      >
        <BarChart2Icon className="mr-2 h-5 w-5" />
        Charts
      </Button>
    </div>
  );
};

export default ViewModeToggle;

export type { ViewMode };

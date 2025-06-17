
"use client";
import { useState, useEffect } from 'react';
import AppHeader from '@/components/AppHeader';
import PensionDataTable from '@/components/PensionDataTable';
import PensionCharts from '@/components/PensionCharts';
import ViewModeToggle, { type ViewMode } from '@/components/ViewModeToggle';
import PensionInsightsCard from '@/components/PensionInsightsCard';
import DrawdownOptimizationCard from '@/components/DrawdownOptimizationCard';
import { getPensionData } from '@/lib/pensionData';
import type { ParsedPensionData } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

export default function PensionPilotPage() {
  const [pensionInfo, setPensionInfo] = useState<ParsedPensionData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const data = getPensionData();
      setPensionInfo(data);
    } catch (error) {
      console.error("Failed to load pension data:", error);
      // Handle error state if necessary, e.g., show an error message
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <LoadingSpinner size={64} />
        <p className="mt-4 text-xl text-foreground font-semibold">Loading Pension Data...</p>
      </div>
    );
  }

  if (!pensionInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <p className="text-xl text-destructive">Failed to load pension data. Please try again later.</p>
      </div>
    );
  }

  const { rows, headers, parameters, csvString } = pensionInfo;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <AppHeader title="MY PENSION PILOT" />
      
      <main className="flex-grow container mx-auto px-4 py-8 space-y-12">
        <section aria-labelledby="data-visualization-heading">
          <h2 id="data-visualization-heading" className="text-2xl font-headline font-semibold mb-6 text-center text-primary">
            Pension Data Visualization
          </h2>
          <ViewModeToggle currentMode={viewMode} onModeChange={setViewMode} />
          {viewMode === 'table' ? (
            <PensionDataTable data={rows} headers={headers} />
          ) : (
            <PensionCharts data={rows} />
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <section aria-labelledby="pension-insights-heading">
             <h2 id="pension-insights-heading" className="sr-only">Pension Insights</h2>
            <PensionInsightsCard csvDataString={csvString} />
          </section>

          <section aria-labelledby="drawdown-optimization-heading">
            <h2 id="drawdown-optimization-heading" className="sr-only">Drawdown Optimization</h2>
            <DrawdownOptimizationCard csvDataString={csvString} financialParams={parameters} />
          </section>
        </div>
      </main>

      <footer className="py-6 text-center text-muted-foreground text-sm border-t border-border mt-auto">
        <p>&copy; {new Date().getFullYear()} MY PENSION PILOT. All rights reserved.</p>
        <p>Pension planning, simplified.</p>
      </footer>
    </div>
  );
}

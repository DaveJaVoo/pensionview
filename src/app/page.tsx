
"use client";
import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import PensionDataTable from '@/components/PensionDataTable';
import PensionCharts from '@/components/PensionCharts';
import ViewModeToggle, { type ViewMode } from '@/components/ViewModeToggle';
import PensionInsightsCard from '@/components/PensionInsightsCard';
import DrawdownOptimizationCard from '@/components/DrawdownOptimizationCard';
import { getPensionData } from '@/lib/pensionData'; // Will now be async and take a File
import type { ParsedPensionData } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Input as FileInput } from "@/components/ui/input"; // Renamed to avoid conflicts
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { AlertTriangleIcon, UploadCloudIcon } from 'lucide-react';

export default function PensionPilotPage() {
  const [pensionInfo, setPensionInfo] = useState<ParsedPensionData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isLoading, setIsLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPensionInfo(null);
      setFileError(null);
      setFileName(null);
      return;
    }

    if (!file.name.endsWith('.xlsx')) {
        setPensionInfo(null);
        setFileError("Please upload a valid .xlsx file.");
        setFileName(null);
        // Clear the file input
        event.target.value = ''; 
        return;
    }

    setIsLoading(true);
    setFileError(null);
    setPensionInfo(null);
    setFileName(file.name);

    try {
      const data = await getPensionData(file); 
      setPensionInfo(data);
    } catch (error) {
      console.error("Failed to load or parse pension data from XLSX:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while processing the file.";
      setFileError(errorMessage);
      setFileName(null); // Clear filename on error
       // Clear the file input if there was an error
      event.target.value = '';
    } finally {
      setIsLoading(false);
    }
  };

  const resetStateAndClearInput = () => {
    setPensionInfo(null);
    setFileError(null);
    setIsLoading(false);
    setFileName(null);
    // This is tricky for file inputs; usually done by resetting the form or keying the input
    // For simplicity, we'll rely on the user re-selecting if they click "Try Again" on error page
    // Or, we can clear the fileName and let the onChange handler on a new selection clear the error.
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <LoadingSpinner size={64} />
        <p className="mt-4 text-xl text-foreground font-semibold font-headline">
          Loading Pension Data from {fileName || 'your file'}...
        </p>
      </div>
    );
  }

  if (fileError) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <AppHeader title="MY PENSION PILOT" />
        <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center justify-center">
          <Card className="w-full max-w-lg p-6 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-headline text-center text-destructive">Error Loading Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangleIcon className="h-5 w-5" />
                <AlertTitle>File Processing Error</AlertTitle>
                <AlertDescription>{fileError}</AlertDescription>
              </Alert>
              <label htmlFor="file-upload-error" className="block text-sm font-medium text-foreground mb-1">
                Select a different .xlsx file:
              </label>
              <FileInput id="file-upload-error" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} className="w-full" />
            </CardContent>
            <CardFooter>
                <Button onClick={resetStateAndClearInput} className="w-full" variant="outline">
                  Upload Different File
                </Button>
            </CardFooter>
          </Card>
        </main>
         <footer className="py-6 text-center text-muted-foreground text-sm border-t border-border mt-auto">
          <p>&copy; {new Date().getFullYear()} MY PENSION PILOT. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  if (!pensionInfo) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <AppHeader title="MY PENSION PILOT" />
        <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center justify-center">
          <Card className="w-full max-w-md p-8 shadow-xl rounded-xl">
            <CardHeader className="text-center">
              <UploadCloudIcon className="mx-auto h-16 w-16 text-primary mb-4" />
              <CardTitle className="text-3xl font-headline">Upload Pension Data</CardTitle>
              <CardDescription className="mt-2 text-muted-foreground text-base">
                Please upload your pension data as an .xlsx file to begin.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-6">
              <label htmlFor="file-upload-initial" className="sr-only">Upload XLSX file</label>
              <FileInput id="file-upload-initial" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} className="w-full text-base p-3 border-dashed border-2 border-input hover:border-primary focus:border-primary cursor-pointer" />
            </CardContent>
          </Card>
        </main>
        <footer className="py-6 text-center text-muted-foreground text-sm border-t border-border mt-auto">
          <p>&copy; {new Date().getFullYear()} MY PENSION PILOT. All rights reserved.</p>
          <p>Pension planning, simplified.</p>
        </footer>
      </div>
    );
  }

  // If we have pensionInfo, render the main content
  const { rows, headers, parameters, csvString } = pensionInfo;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <AppHeader title="MY PENSION PILOT" />
      
      <main className="flex-grow container mx-auto px-4 py-8 space-y-12">
        <section aria-labelledby="data-source-heading" className="text-center">
            <h2 id="data-source-heading" className="text-lg font-medium text-muted-foreground">
                Data loaded from: <span className="font-semibold text-primary">{fileName}</span>
            </h2>
             <Button variant="outline" size="sm" onClick={resetStateAndClearInput} className="mt-2">
                Upload Different File
            </Button>
        </section>

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

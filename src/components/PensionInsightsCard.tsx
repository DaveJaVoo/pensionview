
"use client";
import type { FC } from 'react';
import { useState, useTransition } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { generatePensionInsights, type PensionInsightsOutput } from '@/ai/flows/pension-insights';
import LoadingSpinner from './shared/LoadingSpinner';
import { SparklesIcon, AlertTriangleIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";


interface PensionInsightsCardProps {
  csvDataString: string;
}

const PensionInsightsCard: FC<PensionInsightsCardProps> = ({ csvDataString }) => {
  const [insights, setInsights] = useState<PensionInsightsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleGenerateInsights = () => {
    setError(null);
    setInsights(null);
    startTransition(async () => {
      try {
        const result = await generatePensionInsights(csvDataString);
        setInsights(result);
      } catch (e) {
        console.error("Error generating pension insights:", e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Error Generating Insights",
          description: errorMessage,
        });
      }
    });
  };
  
  if (!csvDataString) { // Don't render if no data to process
    return (
        <Card className="shadow-xl rounded-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary to-accent text-primary-foreground p-6">
                <div className="flex items-center gap-3">
                    <SparklesIcon className="w-8 h-8" />
                    <CardTitle className="font-headline text-2xl">AI Pension Insights</CardTitle>
                </div>
                <CardDescription className="text-primary-foreground/80 pt-1">
                    Calculate a pension projection first to enable AI-powered insights.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <p className="text-muted-foreground text-center">Please fill out the form and click "Calculate Projection" to unlock insights.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="shadow-xl rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary to-accent text-primary-foreground p-6">
        <div className="flex items-center gap-3">
          <SparklesIcon className="w-8 h-8" />
          <CardTitle className="font-headline text-2xl">AI Pension Insights</CardTitle>
        </div>
        <CardDescription className="text-primary-foreground/80 pt-1">
          Unlock AI-powered insights from your pension data to help with your planning.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {isPending && (
          <div className="flex flex-col items-center justify-center h-40 bg-muted/50 rounded-md p-4">
            <LoadingSpinner size={48} />
            <p className="mt-3 text-muted-foreground animate-pulse">Generating insights, please wait...</p>
          </div>
        )}
        {error && (
           <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangleIcon className="h-5 w-5 text-destructive" />
            <AlertTitle className="font-semibold text-destructive">Insight Generation Failed</AlertTitle>
            <AlertDescription className="text-destructive/80">
              {error}
            </AlertDescription>
          </Alert>
        )}
        {insights && !isPending && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg text-foreground">Generated Insights:</h3>
            <Textarea
              readOnly
              value={insights.insights}
              className="min-h-[150px] text-sm bg-muted/30 border-border rounded-md focus:ring-primary focus:border-primary"
              aria-label="Generated pension insights"
            />
          </div>
        )}
        {!insights && !isPending && !error && (
           <p className="text-muted-foreground text-center py-4">Click the button below to generate AI-powered insights based on your projection.</p>
        )}
      </CardContent>
      <CardFooter className="p-6 border-t border-border bg-background/50">
        <Button
          onClick={handleGenerateInsights}
          disabled={isPending || !csvDataString}
          className="w-full text-base py-3 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-2"
          aria-label="Generate pension insights"
        >
          {isPending ? (
            <>
              <LoadingSpinner size={20} className="mr-2 text-primary-foreground" />
              Generating...
            </>
          ) : (
            <>
             <SparklesIcon className="mr-2 h-5 w-5" />
              Generate Insights
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PensionInsightsCard;


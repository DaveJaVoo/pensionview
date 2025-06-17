
"use client";
import type { FC } from 'react';
import { useState, useTransition } from 'react';
// Use PensionCalculationParameters for strong typing if it represents the expected AI input structure
// For now, let's define a specific type for what this card expects for financialParams
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { drawdownOptimization, type DrawdownOptimizationOutput, type DrawdownOptimizationInput } from '@/ai/flows/drawdown-optimization';
import LoadingSpinner from './shared/LoadingSpinner';
import { Settings2Icon, AlertTriangleIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface DrawdownOptimizationCardProps {
  csvDataString: string;
  financialParams: { // This should ideally match the structure expected by drawdownOptimization flow's input minus csvDataString
    initialDcPensionValue: number;
    investmentPercentageGrowth: number;
    inflationRate: number;
    withdrawalRate: number; // This might be withdrawalRatePost66 from main form
    annualChargeAMC: number;
  };
}

const DrawdownOptimizationCard: FC<DrawdownOptimizationCardProps> = ({ csvDataString, financialParams }) => {
  const [suggestion, setSuggestion] = useState<DrawdownOptimizationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleOptimizeDrawdown = () => {
    setError(null);
    setSuggestion(null);
    startTransition(async () => {
      try {
        const input: DrawdownOptimizationInput = {
          pensionDataCsv: csvDataString,
          initialDcPensionValue: financialParams.initialDcPensionValue,
          investmentPercentageGrowth: financialParams.investmentPercentageGrowth,
          inflationRate: financialParams.inflationRate,
          withdrawalRate: financialParams.withdrawalRate,
          annualChargeAMC: financialParams.annualChargeAMC,
        };
        const result = await drawdownOptimization(input);
        setSuggestion(result);
      } catch (e) {
        console.error("Error optimizing drawdown:", e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Error Optimizing Drawdown",
          description: errorMessage,
        });
      }
    });
  };

  if (!csvDataString) { // Don't render if no data to process
    return (
        <Card className="shadow-xl rounded-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-accent to-primary text-primary-foreground p-6">
                <div className="flex items-center gap-3">
                    <Settings2Icon className="w-8 h-8" />
                    <CardTitle className="font-headline text-2xl">AI Drawdown Optimization</CardTitle>
                </div>
                 <CardDescription className="text-primary-foreground/80 pt-1">
                    Calculate a pension projection first to enable AI drawdown optimization.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <p className="text-muted-foreground text-center">Please fill out the form and click "Calculate Projection" to see optimization suggestions.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="shadow-xl rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-accent to-primary text-primary-foreground p-6">
         <div className="flex items-center gap-3">
          <Settings2Icon className="w-8 h-8" />
          <CardTitle className="font-headline text-2xl">AI Drawdown Optimization</CardTitle>
        </div>
        <CardDescription className="text-primary-foreground/80 pt-1">
          Receive AI-driven suggestions to adjust UFPLS drawdown for a zero balance at plan end.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {isPending && (
          <div className="flex flex-col items-center justify-center h-40 bg-muted/50 rounded-md p-4">
            <LoadingSpinner size={48} />
            <p className="mt-3 text-muted-foreground animate-pulse">Optimizing drawdown, please wait...</p>
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangleIcon className="h-5 w-5 text-destructive" />
            <AlertTitle className="font-semibold text-destructive">Optimization Failed</AlertTitle>
            <AlertDescription className="text-destructive/80">
              {error}
            </AlertDescription>
          </Alert>
        )}
        {suggestion && !isPending && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg text-foreground">Suggested Adjustments:</h3>
            <Textarea
              readOnly
              value={suggestion.suggestedDrawdownAdjustments}
              className="min-h-[150px] text-sm bg-muted/30 border-border rounded-md focus:ring-primary focus:border-primary"
              aria-label="Suggested drawdown adjustments"
            />
          </div>
        )}
         {!suggestion && !isPending && !error && (
           <p className="text-muted-foreground text-center py-4">Click the button below to get AI-powered drawdown optimization suggestions based on your projection.</p>
        )}
      </CardContent>
      <CardFooter className="p-6 border-t border-border bg-background/50">
        <Button
          onClick={handleOptimizeDrawdown}
          disabled={isPending || !csvDataString}
          className="w-full text-base py-3 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-2"
          aria-label="Optimize drawdown strategy"
        >
          {isPending ? (
            <>
              <LoadingSpinner size={20} className="mr-2 text-primary-foreground" />
              Optimizing...
            </>
          ) : (
            <>
              <Settings2Icon className="mr-2 h-5 w-5" />
              Optimize Drawdown
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DrawdownOptimizationCard;


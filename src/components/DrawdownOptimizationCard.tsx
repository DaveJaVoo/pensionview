
"use client";
import type { FC } from 'react';
import { useState, useTransition } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { drawdownOptimization, type DrawdownOptimizationOutput, type DrawdownOptimizationInput } from '@/ai/flows/drawdown-optimization';
import LoadingSpinner from './shared/LoadingSpinner';
import { Settings2Icon, AlertTriangleIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import type { PensionCalculationParameters } from '@/lib/types';

interface DrawdownOptimizationCardProps {
  csvDataString: string;
  financialParams: PensionCalculationParameters & { 
    taxFreeLumpSumTaken?: number;
    sippTaxFreeLumpSumTaken?: number;
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
          annualDcPensionContribution: financialParams.annualDcPensionContribution,
          dcContributionStartAge: financialParams.dcContributionStartAge,
          dcContributionEndAge: financialParams.dcContributionEndAge,
          takeTaxFreeLumpSum: financialParams.takeTaxFreeLumpSum,
          taxFreeLumpSumTaken: financialParams.taxFreeLumpSumTaken,
          investmentPercentageGrowth: financialParams.investmentPercentageGrowth,
          dcWithdrawalRate: financialParams.dcWithdrawalRate,
          annualChargeAMC: financialParams.annualChargeAMC,

          initialSippValue: financialParams.initialSippValue,
          annualSippContribution: financialParams.annualSippContribution,
          sippContributionStartAge: financialParams.sippContributionStartAge,
          sippContributionEndAge: financialParams.sippContributionEndAge,
          takeSippTaxFreeLumpSum: financialParams.takeSippTaxFreeLumpSum,
          sippTaxFreeLumpSumTaken: financialParams.sippTaxFreeLumpSumTaken,
          sippInvestmentPercentageGrowth: financialParams.sippInvestmentPercentageGrowth,
          sippAnnualChargeAMC: financialParams.sippAnnualChargeAMC,
          sippWithdrawalRate: financialParams.sippWithdrawalRate,
          
          isaGrowthRate: financialParams.isaGrowthRate,
          giaGrowthRate: financialParams.giaGrowthRate,
          inflationRate: financialParams.inflationRate,
          statePensionAge: financialParams.statePensionAge,
          currentAge: financialParams.currentAge,
          projectionEndAge: financialParams.projectionEndAge, 
          targetAnnualNetIncome: financialParams.targetAnnualNetIncome,
          initialOtherIncome: financialParams.initialOtherIncome,
        };
        const result = await drawdownOptimization(input);
        setSuggestion(result);
      } catch (e) {
        console.error("Error optimising drawdown:", e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Error Optimising Drawdown",
          description: errorMessage,
        });
      }
    });
  };

  if (!csvDataString) {
    return (
        <Card className="shadow-xl rounded-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-accent to-primary text-primary-foreground p-6">
                <div className="flex items-center gap-3">
                    <Settings2Icon className="w-8 h-8" />
                    <CardTitle className="font-headline text-2xl">AI Drawdown Optimisation</CardTitle>
                </div>
                 <CardDescription className="text-primary-foreground/80 pt-1">
                    Calculate a pension projection first to enable AI drawdown optimisation for DC and SIPP pots.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <p className="text-muted-foreground text-center">Please fill out the form and click "Calculate Projection" to see optimisation suggestions.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="shadow-xl rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-accent to-primary text-primary-foreground p-6">
         <div className="flex items-center gap-3">
          <Settings2Icon className="w-8 h-8" />
          <CardTitle className="font-headline text-2xl">AI Drawdown Optimisation (DC & SIPP)</CardTitle>
        </div>
        <CardDescription className="text-primary-foreground/80 pt-1">
          Receive AI-driven suggestions to adjust UFPLS drawdown from both your DC Pension and SIPP to aim for a zero balance in each pot at plan end (age {financialParams.projectionEndAge}). Considers your target net income, savings (Cash, ISA, GIA), contributions, and tax-free lump sum choices for both pension types.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {isPending && (
          <div className="flex flex-col items-center justify-center h-40 bg-muted/50 rounded-md p-4">
            <LoadingSpinner size={48} />
            <p className="mt-3 text-muted-foreground animate-pulse">Optimising drawdown, please wait...</p>
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangleIcon className="h-5 w-5 text-destructive" />
            <AlertTitle className="font-semibold text-destructive">Optimisation Failed</AlertTitle>
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
              aria-label="Suggested drawdown adjustments for DC Pension and SIPP"
            />
          </div>
        )}
         {!suggestion && !isPending && !error && (
           <p className="text-muted-foreground text-center py-4">Click the button below to get AI-powered drawdown optimisation suggestions for your DC and SIPP pensions based on your projection.</p>
        )}
      </CardContent>
      <CardFooter className="p-6 border-t border-border bg-background/50">
        <Button
          onClick={handleOptimizeDrawdown}
          disabled={isPending || !csvDataString}
          className="w-full text-base py-3 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-2"
          aria-label="Optimise drawdown strategy for DC and SIPP pensions"
        >
          {isPending ? (
            <>
              <LoadingSpinner size={20} className="mr-2 text-primary-foreground" />
              Optimising...
            </>
          ) : (
            <>
              <Settings2Icon className="mr-2 h-5 w-5" />
              Optimise Drawdown (DC & SIPP)
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DrawdownOptimizationCard;

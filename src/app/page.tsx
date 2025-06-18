
"use client";
import { useState, useMemo } from 'react';
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from '@/lib/utils';

import AppHeader from '@/components/AppHeader';
import PensionDataTable from '@/components/PensionDataTable';
import PensionCharts from '@/components/PensionCharts';
import ViewModeToggle, { type ViewMode } from '@/components/ViewModeToggle';
import PensionInsightsCard from '@/components/PensionInsightsCard';
import DrawdownOptimizationCard from '@/components/DrawdownOptimizationCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalculatorIcon, AlertTriangleIcon, TrendingUpIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InfoIcon } from 'lucide-react';

import { calculatePensionProjection, DEFAULT_HEADERS } from '@/lib/pensionData';
import type { PensionCalculationParameters, CalculatedPensionData } from '@/lib/types';

const formSchema = z.object({
  currentAge: z.coerce.number().min(18).max(89), // Max 89 to allow at least 1 year projection to 90
  projectionStartYear: z.coerce.number().min(new Date().getFullYear() - 10).max(new Date().getFullYear() + 10),
  initialSavingsAmount: z.coerce.number().min(0),
  initialDbPensionAmount: z.coerce.number().min(0),
  dbPensionStartAge: z.coerce.number().min(50).max(80),
  statePensionAge: z.coerce.number().min(60).max(80),
  initialStatePensionAmount: z.coerce.number().min(0),
  initialDcPensionValue: z.coerce.number().min(0),
  investmentPercentageGrowth: z.coerce.number().min(-20).max(50),
  inflationRate: z.coerce.number().min(-10).max(20),
  dcWithdrawalRate: z.coerce.number().min(0).max(100),
  annualChargeAMC: z.coerce.number().min(0).max(10),
});

type FormValues = z.infer<typeof formSchema>;

const defaultFormValues: FormValues = {
  currentAge: 55,
  projectionStartYear: new Date().getFullYear(),
  initialSavingsAmount: 50000,
  initialDbPensionAmount: 9000,
  dbPensionStartAge: 65,
  statePensionAge: 67,
  initialStatePensionAmount: 11500, // Approx full new state pension 2023/24
  initialDcPensionValue: 188000,
  investmentPercentageGrowth: 4,
  inflationRate: 2.5,
  dcWithdrawalRate: 4,
  annualChargeAMC: 0.5,
};

interface FormFieldProps {
  name: keyof FormValues;
  label: string;
  control: any;
  type?: string;
  placeholder?: string;
  description?: string;
  unit?: string;
}

const FormInput: React.FC<FormFieldProps> = ({ name, label, control, type = "number", placeholder, description, unit }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <Label htmlFor={name} className="text-sm font-medium">
        {label} {unit && <span className="text-xs text-muted-foreground">({unit})</span>}
      </Label>
      {description && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
              <InfoIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 text-sm" side="top" align="end">
            {description}
          </PopoverContent>
        </Popover>
      )}
    </div>
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <>
          <Input
            id={name}
            type={type}
            step={type === "number" ? (name.includes("Rate") || name.includes("Charge") ? "0.1" : "1") : undefined}
            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
            {...field}
            onChange={e => field.onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
            className={cn("w-full", error ? "border-destructive" : "")}
          />
          {error && <p className="text-xs text-destructive mt-1">{error.message}</p>}
        </>
      )}
    />
  </div>
);

export default function PensionPilotPage() {
  const [calculatedData, setCalculatedData] = useState<CalculatedPensionData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isLoading, setIsLoading] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultFormValues,
  });

  const investmentGrowth = watch("investmentPercentageGrowth");
  const inflation = watch("inflationRate");
  const realGrowth = useMemo(() => {
    const growth = typeof investmentGrowth === 'number' ? investmentGrowth : 0;
    const infl = typeof inflation === 'number' ? inflation : 0;
    return (growth - infl).toFixed(2);
  }, [investmentGrowth, inflation]);

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    setIsLoading(true);
    setCalculationError(null);
    setCalculatedData(null);
    try {
      const parameters: PensionCalculationParameters = { ...data };
      const result = calculatePensionProjection(parameters);
      setCalculatedData(result);
    } catch (error) {
      console.error("Failed to calculate pension data:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during calculation.";
      setCalculationError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  const coreParamsFields: FormFieldProps[] = [
    { name: "currentAge", label: "Current Age", control: control, unit: "Years", description: "Your current age." },
    { name: "projectionStartYear", label: "Projection Start Year", control: control, unit: "Year", description: "The year the projection should begin from." },
    { name: "initialSavingsAmount", label: "Initial Savings Amount", control: control, unit: "£", description: "Total current value of your liquid savings (e.g., ISAs, cash)."},
  ];

  const dcPensionFields: FormFieldProps[] = [
    { name: "initialDcPensionValue", label: "Initial DC Pension Value", control: control, unit: "£", description: "Your current total Defined Contribution pension pot value." },
    { name: "investmentPercentageGrowth", label: "Investment Growth Rate", control: control, unit: "% pa", description: "Expected annual growth rate of your DC pension investments." },
    { name: "annualChargeAMC", label: "Annual Mgmt. Charge (AMC)", control: control, unit: "% pa", description: "Annual Management Charge on your DC pension pot." },
    { name: "dcWithdrawalRate", label: "DC UFPLS Withdrawal Rate", control: control, unit: "% pa", description: "Annual % to withdraw from DC pot via UFPLS after State Pension Age." },
  ];
  
  const dbStatePensionFields: FormFieldProps[] = [
    { name: "initialDbPensionAmount", label: "Initial DB Pension Amount", control: control, unit: "£ pa", description: "Initial annual amount of Defined Benefit pension if applicable." },
    { name: "dbPensionStartAge", label: "DB Pension Start Age", control: control, unit: "Years", description: "Age at which DB Pension payments begin." },
    { name: "initialStatePensionAmount", label: "Initial State Pension", control: control, unit: "£ pa", description: "Expected initial annual amount of State Pension." },
    { name: "statePensionAge", label: "State Pension Age", control: control, unit: "Years", description: "Age at which State Pension payments begin." },
  ];

  const economicAssumptionsFields: FormFieldProps[] = [
     { name: "inflationRate", label: "Inflation Rate", control: control, unit: "% pa", description: "Expected average annual inflation rate." },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <AppHeader title="MY PENSION PILOT" />
      
      <main className="flex-grow container mx-auto px-4 py-8 space-y-8">
        <Card className="shadow-xl rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CalculatorIcon className="w-8 h-8 text-primary" />
              <CardTitle className="text-3xl font-headline">Pension Projection Calculator</CardTitle>
            </div>
            <CardDescription>
              Enter your financial details to project your retirement income up to age 90. 
              All percentage inputs should be entered as numbers (e.g., 5 for 5%).
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <h3 className="text-xl font-headline font-semibold text-primary border-b pb-2">Core Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coreParamsFields.map(field => <FormInput key={field.name} {...field} />)}
              </div>
              
              <Separator />
              <h3 className="text-xl font-headline font-semibold text-primary border-b pb-2">Defined Contribution (DC) Pension</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {dcPensionFields.map(field => <FormInput key={field.name} {...field} />)}
              </div>

              <Separator />
              <h3 className="text-xl font-headline font-semibold text-primary border-b pb-2">Defined Benefit (DB) & State Pension</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {dbStatePensionFields.map(field => <FormInput key={field.name} {...field} />)}
              </div>
              
              <Separator />
              <h3 className="text-xl font-headline font-semibold text-primary border-b pb-2">Economic Assumptions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                {economicAssumptionsFields.map(field => <FormInput key={field.name} {...field} />)}
                 <div>
                    <Label className="text-sm font-medium">Real Growth Rate</Label>
                    <div className="flex items-center gap-2 mt-2 p-2 h-10 border border-input rounded-md bg-muted">
                        <TrendingUpIcon className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm font-semibold">{realGrowth}% pa</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Investment Growth Rate minus Inflation Rate.</p>
                 </div>
              </div>
              
              {calculationError && (
                <Alert variant="destructive">
                  <AlertTriangleIcon className="h-5 w-5" />
                  <AlertTitle>Calculation Error</AlertTitle>
                  <AlertDescription>{calculationError}</AlertDescription>
                </Alert>
              )}
               {Object.keys(errors).length > 0 && !calculationError && (
                <Alert variant="destructive">
                  <AlertTriangleIcon className="h-5 w-5" />
                  <AlertTitle>Input Validation Error</AlertTitle>
                  <AlertDescription>Please check the highlighted fields for errors and ensure all required inputs are validly entered.</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={isLoading} className="w-full md:w-auto text-lg py-3 px-6">
                {isLoading ? (
                  <>
                    <LoadingSpinner size={20} className="mr-2" /> Calculating...
                  </>
                ) : (
                  <>
                    <CalculatorIcon className="mr-2 h-5 w-5" /> Calculate Projection
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {isLoading && !calculatedData && (
          <div className="flex flex-col items-center justify-center min-h-[300px] bg-muted/30 rounded-lg p-8">
            <LoadingSpinner size={64} />
            <p className="mt-4 text-xl text-foreground font-semibold font-headline">
              Calculating Your Pension Projection...
            </p>
          </div>
        )}

        {calculatedData && !isLoading && (
          <>
            <section aria-labelledby="data-visualization-heading" className="mt-12">
              <h2 id="data-visualization-heading" className="text-2xl font-headline font-semibold mb-6 text-center text-primary">
                Your Pension Projection Results (up to Age 90)
              </h2>
              <ViewModeToggle currentMode={viewMode} onModeChange={setViewMode} />
              {viewMode === 'table' ? (
                <PensionDataTable data={calculatedData.rows} headers={calculatedData.headers} />
              ) : (
                <PensionCharts data={calculatedData.rows} />
              )}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mt-12">
              <section aria-labelledby="pension-insights-heading">
                <h2 id="pension-insights-heading" className="sr-only">Pension Insights</h2>
                <PensionInsightsCard csvDataString={calculatedData.csvString} />
              </section>

              <section aria-labelledby="drawdown-optimization-heading">
                <h2 id="drawdown-optimization-heading" className="sr-only">Drawdown Optimization</h2>
                <DrawdownOptimizationCard 
                  csvDataString={calculatedData.csvString} 
                  financialParams={{
                    initialDcPensionValue: calculatedData.parameters.initialDcPensionValue,
                    investmentPercentageGrowth: calculatedData.parameters.investmentPercentageGrowth,
                    inflationRate: calculatedData.parameters.inflationRate,
                    withdrawalRate: calculatedData.parameters.dcWithdrawalRate, 
                    annualChargeAMC: calculatedData.parameters.annualChargeAMC,
                  }} 
                />
              </section>
            </div>
          </>
        )}
      </main>

      <footer className="py-6 text-center text-muted-foreground text-sm border-t border-border mt-auto">
        <p>&copy; {new Date().getFullYear()} MY PENSION PILOT. All rights reserved.</p>
        <p>Pension planning, simplified.</p>
      </footer>
    </div>
  );
}

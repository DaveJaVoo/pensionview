
"use client";
import { useState } from 'react';
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from '@/lib/utils'; // Added missing import

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalculatorIcon, AlertTriangleIcon, BarChartIcon, TableIcon } from 'lucide-react';

import { calculatePensionProjection, DEFAULT_HEADERS } from '@/lib/pensionData';
import type { PensionCalculationParameters, CalculatedPensionData, PensionDataRow } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InfoIcon } from 'lucide-react';


const formSchema = z.object({
  currentAge: z.coerce.number().min(18).max(90),
  projectionEndAge: z.coerce.number().min(50).max(120),
  initialDcPensionValue: z.coerce.number().min(0),
  investmentPercentageGrowth: z.coerce.number().min(-10).max(50),
  annualChargeAMC: z.coerce.number().min(0).max(10),
  withdrawalRatePost66: z.coerce.number().min(0).max(100),
  inflationRate: z.coerce.number().min(-5).max(20),
  ufplsAge63: z.coerce.number().optional(),
  ufplsAge64: z.coerce.number().optional(),
  ufplsAge65: z.coerce.number().optional(),
  ufplsAge66: z.coerce.number().optional(),
  initialDbPensionAmount: z.coerce.number().optional(),
  dbPensionStartAge: z.coerce.number().optional(),
  initialStatePensionAmount: z.coerce.number().optional(),
  statePensionStartAge: z.coerce.number().optional(),
  myInitialAnnualIncome: z.coerce.number().min(0),
  katesInitialAnnualIncome: z.coerce.number().min(0),
  averageTaxRate: z.coerce.number().min(0).max(100),
}).refine(data => data.projectionEndAge > data.currentAge, {
  message: "Projection End Age must be greater than Current Age.",
  path: ["projectionEndAge"],
});

type FormValues = z.infer<typeof formSchema>;

const defaultFormValues: FormValues = {
  currentAge: 55,
  projectionEndAge: 100,
  initialDcPensionValue: 188000,
  investmentPercentageGrowth: 2,
  annualChargeAMC: 0.5,
  withdrawalRatePost66: 4,
  inflationRate: 2.5,
  ufplsAge63: 0,
  ufplsAge64: 0,
  ufplsAge65: 0,
  ufplsAge66: 0,
  initialDbPensionAmount: 9000,
  dbPensionStartAge: 65,
  initialStatePensionAmount: 10000,
  statePensionStartAge: 67,
  myInitialAnnualIncome: 30000,
  katesInitialAnnualIncome: 30000,
  averageTaxRate: 20,
};

interface FormFieldProps {
  name: keyof FormValues;
  label: string;
  control: any; // Control type from react-hook-form
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
            step={type === "number" ? "any" : undefined}
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

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultFormValues,
  });

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    setIsLoading(true);
    setCalculationError(null);
    setCalculatedData(null);
    try {
      // Ensure optional fields that are empty strings become undefined for the calculator
      const parameters: PensionCalculationParameters = {
        ...data,
        ufplsAge63: data.ufplsAge63 === undefined || isNaN(data.ufplsAge63) ? undefined : data.ufplsAge63,
        ufplsAge64: data.ufplsAge64 === undefined || isNaN(data.ufplsAge64) ? undefined : data.ufplsAge64,
        ufplsAge65: data.ufplsAge65 === undefined || isNaN(data.ufplsAge65) ? undefined : data.ufplsAge65,
        ufplsAge66: data.ufplsAge66 === undefined || isNaN(data.ufplsAge66) ? undefined : data.ufplsAge66,
        initialDbPensionAmount: data.initialDbPensionAmount === undefined || isNaN(data.initialDbPensionAmount) ? undefined : data.initialDbPensionAmount,
        dbPensionStartAge: data.dbPensionStartAge === undefined || isNaN(data.dbPensionStartAge) ? undefined : data.dbPensionStartAge,
        initialStatePensionAmount: data.initialStatePensionAmount === undefined || isNaN(data.initialStatePensionAmount) ? undefined : data.initialStatePensionAmount,
        statePensionStartAge: data.statePensionStartAge === undefined || isNaN(data.statePensionStartAge) ? undefined : data.statePensionStartAge,
      };
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
  
  const formFieldsRow1: FormFieldProps[] = [
    { name: "currentAge", label: "Current Age", control: control, unit: "Years" },
    { name: "projectionEndAge", label: "Projection End Age", control: control, unit: "Years" },
    { name: "initialDcPensionValue", label: "Initial DC Pension", control: control, unit: "£", description: "Your current total Defined Contribution pension pot value." },
  ];
  const formFieldsRow2: FormFieldProps[] = [
    { name: "investmentPercentageGrowth", label: "Investment Growth", control: control, unit: "% pa", description: "Expected annual growth rate of your pension investments." },
    { name: "annualChargeAMC", label: "Annual Charge (AMC)", control: control, unit: "% pa", description: "Annual Management Charge on your pension pot." },
    { name: "inflationRate", label: "Inflation Rate", control: control, unit: "% pa", description: "Expected average annual inflation rate." },
  ];
    const formFieldsRow3: FormFieldProps[] = [
    { name: "myInitialAnnualIncome", label: "My Initial Annual Income", control: control, unit: "£", description: "Your current gross annual income. This will be inflated annually." },
    { name: "katesInitialAnnualIncome", label: "Kate's Initial Annual Income", control: control, unit: "£", description: "Kate's current gross annual income. This will be inflated annually." },
    { name: "averageTaxRate", label: "Avg. Tax Rate on Income", control: control, unit: "%", description: "A simplified average tax rate applied to total taxable income (pension + earnings)." },
  ];

  const ufplsFields: FormFieldProps[] = [
    { name: "ufplsAge63", label: "UFPLS Drawdown at Age 63", control: control, unit: "£", description: "Specific UFPLS amount for age 63. Leave blank if not applicable or to use standard withdrawal rules if over 66." },
    { name: "ufplsAge64", label: "UFPLS Drawdown at Age 64", control: control, unit: "£", description: "Specific UFPLS amount for age 64." },
    { name: "ufplsAge65", label: "UFPLS Drawdown at Age 65", control: control, unit: "£", description: "Specific UFPLS amount for age 65." },
    { name: "ufplsAge66", label: "UFPLS Drawdown at Age 66", control: control, unit: "£", description: "Specific UFPLS amount for age 66. After this, the 'Post-66 Withdrawal Rate' applies if no specific amount is set for a year." },
    { name: "withdrawalRatePost66", label: "Post-66 Withdrawal Rate", control: control, unit: "%", description: "Annual withdrawal rate from DC pension from age 67 onwards, if no specific UFPLS amount is set for those years." },
  ];
  const dbPensionFields: FormFieldProps[] = [
    { name: "initialDbPensionAmount", label: "Initial DB Pension (FAS)", control: control, unit: "£ pa", description: "Initial annual amount of Defined Benefit / Final Salary pension." },
    { name: "dbPensionStartAge", label: "DB Pension Start Age", control: control, unit: "Years", description: "Age at which DB Pension payments begin." },
  ];
  const statePensionFields: FormFieldProps[] = [
    { name: "initialStatePensionAmount", label: "Initial State Pension", control: control, unit: "£ pa", description: "Initial annual amount of State Pension." },
    { name: "statePensionStartAge", label: "State Pension Start Age", control: control, unit: "Years", description: "Age at which State Pension payments begin." },
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
              Enter your pension and financial details below to project your retirement income. 
              All percentage inputs should be entered as numbers (e.g., 5 for 5%).
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {formFieldsRow1.map(field => <FormInput key={field.name} {...field} />)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {formFieldsRow2.map(field => <FormInput key={field.name} {...field} />)}
              </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {formFieldsRow3.map(field => <FormInput key={field.name} {...field} />)}
              </div>

              <Separator />
              <h3 className="text-xl font-headline font-semibold text-primary">UFPLS Drawdown Inputs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ufplsFields.map(field => <FormInput key={field.name} {...field} />)}
              </div>
              
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xl font-headline font-semibold text-primary mb-2">DB Pension (FAS)</h3>
                    <div className="space-y-4">
                      {dbPensionFields.map(field => <FormInput key={field.name} {...field} />)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-headline font-semibold text-primary mb-2">State Pension</h3>
                     <div className="space-y-4">
                      {statePensionFields.map(field => <FormInput key={field.name} {...field} />)}
                    </div>
                  </div>
              </div>
              
              {calculationError && (
                <Alert variant="destructive">
                  <AlertTriangleIcon className="h-5 w-5" />
                  <AlertTitle>Calculation Error</AlertTitle>
                  <AlertDescription>{calculationError}</AlertDescription>
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
                Your Pension Projection Results
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
                    withdrawalRate: calculatedData.parameters.withdrawalRatePost66, // Assuming this maps to withdrawalRate for the AI
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


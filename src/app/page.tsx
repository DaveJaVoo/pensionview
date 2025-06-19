
"use client";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn, formatCurrency } from '@/lib/utils';

import AppHeader from '@/components/AppHeader';
import PensionDataTable from '@/components/PensionDataTable';
import PensionCharts from '@/components/PensionCharts';
import ViewModeToggle, { type ViewMode } from '@/components/ViewModeToggle';
import DrawdownOptimizationCard from '@/components/DrawdownOptimizationCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalculatorIcon, AlertTriangleIcon, TrendingUpIcon, InfoIcon, HelpCircleIcon, RotateCcwIcon, PiggyBank, Briefcase, TrendingDown, Landmark, Banknote } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from "@/components/ui/switch";

import { calculatePensionProjection } from '@/lib/pensionData';
import type { PensionCalculationParameters, CalculatedPensionData } from '@/lib/types';

const SCHEMA_FALLBACK_YEAR = 2024; 

const formSchema = z.object({
  currentAge: z.coerce.number().min(18).max(89).default(55),
  projectionStartYear: z.coerce.number().min(SCHEMA_FALLBACK_YEAR - 20).max(SCHEMA_FALLBACK_YEAR + 20).default(SCHEMA_FALLBACK_YEAR),
  
  initialCashSavings: z.coerce.number().min(0).default(10000),
  initialIsaAmount: z.coerce.number().min(0).default(20000),
  isaGrowthRate: z.coerce.number().min(-20).max(50).default(3),
  initialGiaAmount: z.coerce.number().min(0).default(20000),
  giaGrowthRate: z.coerce.number().min(-20).max(50).default(3),
  
  targetAnnualNetIncome: z.coerce.number().min(0).default(20000),
  initialDbPensionAmount: z.coerce.number().min(0).default(0),
  dbPensionStartAge: z.coerce.number().min(50).max(80).default(65),
  statePensionAge: z.coerce.number().min(60).max(80).default(67),
  initialStatePensionAmount: z.coerce.number().min(0).default(11973),
  
  initialDcPensionValue: z.coerce.number().min(0).default(188000),
  annualDcPensionContribution: z.coerce.number().min(0).default(0),
  dcContributionStartAge: z.coerce.number().min(18).max(89).default(55),
  dcContributionEndAge: z.coerce.number().min(19).max(90).default(67),
  takeTaxFreeLumpSum: z.boolean().default(false),
  investmentPercentageGrowth: z.coerce.number().min(-20).max(50).default(4),
  inflationRate: z.coerce.number().min(-10).max(20).default(4),
  dcWithdrawalRate: z.coerce.number().min(0).max(100).default(4),
  annualChargeAMC: z.coerce.number().min(0).max(10).default(0.5),

  initialSippValue: z.coerce.number().min(0).default(0),
  annualSippContribution: z.coerce.number().min(0).default(0),
  sippContributionStartAge: z.coerce.number().min(18).max(89).default(55),
  sippContributionEndAge: z.coerce.number().min(19).max(90).default(67),
  takeSippTaxFreeLumpSum: z.boolean().default(false),
  sippInvestmentPercentageGrowth: z.coerce.number().min(-20).max(50).default(4),
  sippAnnualChargeAMC: z.coerce.number().min(0).max(10).default(0.5),
  sippWithdrawalRate: z.coerce.number().min(0).max(100).default(4),

}).refine(data => data.dcContributionEndAge > data.dcContributionStartAge, {
  message: "DC Contribution End Age must be after Start Age.",
  path: ["dcContributionEndAge"],
}).refine(data => data.sippContributionEndAge > data.sippContributionStartAge, {
  message: "SIPP Contribution End Age must be after Start Age.",
  path: ["sippContributionEndAge"],
});

type FormValues = z.infer<typeof formSchema>;

interface FormFieldProps {
  name: keyof FormValues;
  label: React.ReactNode;
  control: any;
  type?: string;
  placeholder?: string;
  description?: string;
  suffix?: string;
  infoLink?: string;
  infoLinkText?: string;
  icon?: React.ElementType;
}

const FormInput: React.FC<FormFieldProps> = ({ name, label, control, type = "number", placeholder, description, suffix, infoLink, infoLinkText, icon: Icon }) => {
  const defaultPlaceholder = typeof label === 'string' && !React.isValidElement(label)
    ? `Enter ${label.toLowerCase()}`
    : 'Enter value';
  
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1">
        {Icon && <Icon className="w-4 h-4 mr-1 mt-1 text-primary/80 shrink-0" />}
        <Label htmlFor={name} className="text-sm font-medium">
          {label}
        </Label>
        {description && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0" tabIndex={-1}>
                <InfoIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 text-sm" side="top" align="start">
              {description}
              {infoLink && infoLinkText && (
                <p className="mt-2">
                  <a href={infoLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {infoLinkText}
                  </a>
                </p>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => (
          <>
            <div className="w-full max-w-[160px]">
              <div className="relative">
                <Input
                  id={name}
                  type={type}
                  step={type === "number" ? (name.includes("Rate") || name.includes("Charge") || name.includes("Growth") || name.includes("Inflation") || name.includes("AMC") ? "0.1" : "1") : undefined}
                  placeholder={placeholder || defaultPlaceholder}
                  {...field}
                  onChange={e => {
                     field.onChange(e.target.value === '' && type === 'number' ? undefined : e.target.value);
                  }}
                  value={field.value === undefined && type === "number" ? "" : field.value}
                  className={cn(error ? "border-destructive" : "", suffix ? "pr-6" : "")}
                />
                {suffix && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <span className="text-muted-foreground sm:text-sm">{suffix}</span>
                  </div>
                )}
              </div>
            </div>
            {error && <p className="text-xs text-destructive mt-1">{error.message}</p>}
          </>
        )}
      />
    </div>
  );
};


export default function PensionPilotPage() {
  const [calculatedData, setCalculatedData] = useState<CalculatedPensionData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isLoading, setIsLoading] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [calculatedLumpSumDisplay, setCalculatedLumpSumDisplay] = useState<number>(0);
  const [calculatedSippLumpSumDisplay, setCalculatedSippLumpSumDisplay] = useState<number>(0);
  const [footerYear, setFooterYear] = useState<number | null>(null);

  useEffect(() => {
    setFooterYear(new Date().getFullYear());
  }, []);

  const { control, handleSubmit, watch, formState: { errors }, reset, getValues, setValue } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: formSchema.parse({
       currentAge: 55, 
       dcContributionStartAge: 55, 
       statePensionAge: 67, 
       dcContributionEndAge: 67,
       sippContributionStartAge: 55,
       sippContributionEndAge: 67,
    }), 
  });
  
  useEffect(() => {
    if (!isFormInitialized) {
      const clientCurrentYear = new Date().getFullYear();
      const initialFormValues = formSchema.parse({
        currentAge: 55,
        dcContributionStartAge: 55, 
        statePensionAge: 67,
        dcContributionEndAge: 67, 
        sippContributionStartAge: 55,
        sippContributionEndAge: 67,
      });
      reset({
        ...initialFormValues,
        projectionStartYear: clientCurrentYear,
      });
      setIsFormInitialized(true);
    }
  }, [reset, isFormInitialized]);


  const currentAgeWatched = watch("currentAge");

  useEffect(() => {
    if (!isFormInitialized) return;

    const currentAgeVal = getValues("currentAge");
    const currentStatePensionAgeVal = getValues("statePensionAge");
    
    const currentDcContributionStartAge = getValues("dcContributionStartAge");
    const currentDcContributionEndAge = getValues("dcContributionEndAge");
    const currentSippContributionStartAge = getValues("sippContributionStartAge");
    const currentSippContributionEndAge = getValues("sippContributionEndAge");


    if (currentAgeVal !== currentDcContributionStartAge) {
      setValue("dcContributionStartAge", currentAgeVal, { shouldValidate: true });
    }
    if (currentAgeVal !== currentSippContributionStartAge) {
      setValue("sippContributionStartAge", currentAgeVal, { shouldValidate: true });
    }
    if (currentStatePensionAgeVal !== currentDcContributionEndAge) {
        setValue("dcContributionEndAge", currentStatePensionAgeVal, { shouldValidate: true });
    }
    if (currentStatePensionAgeVal !== currentSippContributionEndAge) {
        setValue("sippContributionEndAge", currentStatePensionAgeVal, { shouldValidate: true });
    }

    if (currentAgeVal > 67 && currentAgeVal > currentStatePensionAgeVal) {
      const newSpa = Math.min(currentAgeVal, 80); 
      if (newSpa !== currentStatePensionAgeVal) {
        setValue("statePensionAge", newSpa, { shouldValidate: true });
        setValue("dcContributionEndAge", newSpa, {shouldValidate: true});
        setValue("sippContributionEndAge", newSpa, {shouldValidate: true});
      }
    }
  }, [currentAgeWatched, isFormInitialized, setValue, getValues]);

  const statePensionAgeWatched = watch("statePensionAge");
  useEffect(() => {
    if (!isFormInitialized) return;
    const spaVal = getValues("statePensionAge");
    const currentDcEndAge = getValues("dcContributionEndAge");
    const currentSippEndAge = getValues("sippContributionEndAge");
    if (spaVal !== currentDcEndAge) {
        setValue("dcContributionEndAge", spaVal, {shouldValidate: true});
    }
    if (spaVal !== currentSippEndAge) {
        setValue("sippContributionEndAge", spaVal, {shouldValidate: true});
    }
  }, [statePensionAgeWatched, isFormInitialized, setValue, getValues]);


  const initialDcPensionValueWatched = watch("initialDcPensionValue");
  const takeTaxFreeLumpSumWatched = watch("takeTaxFreeLumpSum");

  useEffect(() => {
    if (!isFormInitialized && !getValues("initialDcPensionValue")) return; 
    
    const pclsValue = getValues("initialDcPensionValue");
    const takePcls = getValues("takeTaxFreeLumpSum");

    if (takePcls) {
      const pcls = (pclsValue || 0) * 0.25;
      setCalculatedLumpSumDisplay(pcls);
    } else {
      setCalculatedLumpSumDisplay(0);
    }
  }, [isFormInitialized, initialDcPensionValueWatched, takeTaxFreeLumpSumWatched, getValues]);

  const initialSippValueWatched = watch("initialSippValue");
  const takeSippTaxFreeLumpSumWatched = watch("takeSippTaxFreeLumpSum");

  useEffect(() => {
    if (!isFormInitialized && !getValues("initialSippValue")) return; 
    
    const pclsValue = getValues("initialSippValue");
    const takePcls = getValues("takeSippTaxFreeLumpSum");

    if (takePcls) {
      const pcls = (pclsValue || 0) * 0.25;
      setCalculatedSippLumpSumDisplay(pcls);
    } else {
      setCalculatedSippLumpSumDisplay(0);
    }
  }, [isFormInitialized, initialSippValueWatched, takeSippTaxFreeLumpSumWatched, getValues]);


  const investmentGrowth = watch("investmentPercentageGrowth");
  const sippInvestmentGrowth = watch("sippInvestmentPercentageGrowth");
  const inflation = watch("inflationRate");

  const realGrowthDC = useMemo(() => {
    if (!isFormInitialized) return '...'; 
    const growthVal = getValues("investmentPercentageGrowth");
    const inflationVal = getValues("inflationRate");
    const growth = typeof growthVal === 'number' ? growthVal : 0;
    const infl = typeof inflationVal === 'number' ? inflationVal : 0;
    return (growth - infl).toFixed(2);
  }, [isFormInitialized, investmentGrowth, inflation, getValues]);

  const realGrowthSIPP = useMemo(() => {
    if (!isFormInitialized) return '...';
    const growthVal = getValues("sippInvestmentPercentageGrowth");
    const inflationVal = getValues("inflationRate");
    const growth = typeof growthVal === 'number' ? growthVal : 0;
    const infl = typeof inflationVal === 'number' ? inflationVal : 0;
    return (growth - infl).toFixed(2);
  }, [isFormInitialized, sippInvestmentGrowth, inflation, getValues]);


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

  const handleResetForm = () => {
    const clientCurrentYear = new Date().getFullYear();
    const defaultValues = formSchema.parse({
        currentAge: 55,
        dcContributionStartAge: 55,
        statePensionAge: 67,
        dcContributionEndAge: 67,
        sippContributionStartAge: 55,
        sippContributionEndAge: 67,
    });
    reset({
      ...defaultValues,
      projectionStartYear: clientCurrentYear,
    });
    setCalculatedData(null);
    setCalculationError(null);
    
    const newInitialDcPensionValue = getValues("initialDcPensionValue");
    const newTakeTaxFreeLumpSum = getValues("takeTaxFreeLumpSum");
    if (newTakeTaxFreeLumpSum) {
      setCalculatedLumpSumDisplay((newInitialDcPensionValue || 0) * 0.25);
    } else {
      setCalculatedLumpSumDisplay(0);
    }

    const newInitialSippValue = getValues("initialSippValue");
    const newTakeSippTaxFreeLumpSum = getValues("takeSippTaxFreeLumpSum");
    if (newTakeSippTaxFreeLumpSum) {
      setCalculatedSippLumpSumDisplay((newInitialSippValue || 0) * 0.25);
    } else {
      setCalculatedSippLumpSumDisplay(0);
    }
  };

  const coreParamsFields: FormFieldProps[] = [
    { name: "currentAge", label: "Current Age", control: control, description: "Your current age. DC & SIPP Pension Contributions will default to start from this age." },
    { name: "projectionStartYear", label: "Projection Start Year", control: control, description: "The year the projection should begin from." },
    { name: "targetAnnualNetIncome", label: <>Required Income <span className="text-xs text-muted-foreground font-normal">(After Tax)</span></>, control: control, placeholder: "Enter amount in £ pa", description: "Your desired total income per year AFTER tax. The system attempts to meet this using simplified UK basic rate income tax calculations (20% on income above Personal Allowance). It does not account for National Insurance, different UK tax bands (e.g., higher/additional rates, Scottish rates), dividend tax, or capital gains tax." },
  ];

  const savingsFields: FormFieldProps[] = [
    { name: "initialCashSavings", label: "Cash Savings", control: control, placeholder: "Enter amount in £", description: "Current value of your cash savings (e.g., bank accounts). Assumed to have no growth.", icon: PiggyBank},
    { name: "initialIsaAmount", label: "ISA Value", control: control, placeholder: "Enter amount in £", description: "Current total value of your ISAs.", icon: Briefcase },
    { name: "isaGrowthRate", label: "ISA Growth Rate", control: control, suffix: "%", description: "Expected annual growth rate for your ISAs. Growth is tax-free.", icon: TrendingUpIcon },
    { name: "initialGiaAmount", label: "GIA Value", control: control, placeholder: "Enter amount in £", description: "Current total value of your General Investment Accounts (GIAs). Tax on GIA growth/withdrawals is NOT modeled in this projection.", icon: Briefcase },
    { name: "giaGrowthRate", label: "GIA Growth Rate", control: control, suffix: "%", description: "Expected annual growth rate for your GIAs.", icon: TrendingUpIcon },
  ];

  const dcPensionFields: FormFieldProps[] = [
    { name: "initialDcPensionValue", label: "Current DC Pension Value", control: control, placeholder: "Enter amount in £", description: "Your current total Defined Contribution pension pot value." },
    { name: "annualDcPensionContribution", label: "Annual Gross Contribution", control: control, placeholder: "Enter amount in £ pa", description: "Gross annual amount you plan to contribute to your DC pension. Enter the amount including assumed basic rate tax relief (e.g., if you pay in £80, enter £100). Tax relief beyond basic rate is not modeled." , icon: Landmark},
    { name: "dcContributionStartAge", label: "Contribution Start Age", control: control, description: "Age when your annual DC contributions begin. Defaults to your Current Age." },
    { name: "dcContributionEndAge", label: "Contribution End Age", control: control, description: "Age when your annual DC contributions stop (contributions are made up to, but not including, this age). Defaults to your State Pension Age." },
    { name: "investmentPercentageGrowth", label: "DC Inv. Growth Rate", control: control, suffix: "%", description: "Expected annual growth rate of your DC pension investments." },
    { name: "annualChargeAMC", label: "Annual Management Charge", control: control, suffix: "%", description: "Annual Management Charge on your DC pension pot. Please refer to your Fund Fact Sheet supplied by your Pension Provider" },
    { name: "dcWithdrawalRate", label: "DC Withdrawal Rate", control: control, suffix: "%", description: "Annual % to withdraw from DC pot via UFPLS after State Pension Age if no specific income shortfall needs covering, or if this withdrawal is higher than what's needed for the target net income." },
  ];

  const sippFields: FormFieldProps[] = [
    { name: "initialSippValue", label: "Current SIPP Value", control: control, placeholder: "Enter amount in £", description: "Your current total SIPP value. Leave at 0 if none." , icon: Banknote},
    { name: "annualSippContribution", label: "Annual Gross Contribution", control: control, placeholder: "Enter amount in £ pa", description: "Gross annual amount you plan to contribute to your SIPP. Tax relief rules similar to DC pension apply." , icon: Landmark},
    { name: "sippContributionStartAge", label: "Contribution Start Age", control: control, description: "Age when your annual SIPP contributions begin. Defaults to Current Age." },
    { name: "sippContributionEndAge", label: "Contribution End Age", control: control, description: "Age when your annual SIPP contributions stop. Defaults to State Pension Age." },
    { name: "sippInvestmentPercentageGrowth", label: "SIPP Inv. Growth Rate", control: control, suffix: "%", description: "Expected annual growth rate of your SIPP investments." },
    { name: "sippAnnualChargeAMC", label: "SIPP Annual Mgt. Charge", control: control, suffix: "%", description: "Annual Management Charge (AMC) on your SIPP pot." },
    { name: "sippWithdrawalRate", label: "SIPP Withdrawal Rate", control: control, suffix: "%", description: "Annual % to withdraw from SIPP pot post-SPA if no shortfall or if higher than target income need from SIPP." },
  ];

  const dbStatePensionFields: FormFieldProps[] = [
    { name: "initialDbPensionAmount", label: "DB Pension Amount", control: control, placeholder: "Enter amount in £ pa", description: "Initial annual amount of Defined Benefit pension if applicable. Leave at 0 if none." },
    { name: "dbPensionStartAge", label: "DB Pension Start Age", control: control, description: "Age at which DB Pension payments begin." },
    { name: "initialStatePensionAmount", label: "Initial State Pension", control: control, placeholder: "Enter amount in £ pa", description: "Expected initial annual amount of State Pension. Current full new State Pension is approx. £11,973 for 2024/25." },
    { name: "statePensionAge", label: "State Pension Age", control: control, description: "Age at which State Pension payments begin. DC & SIPP Pension Contributions will default to end at this age." },
  ];

  const economicAssumptionsFields: FormFieldProps[] = [
     {
       name: "inflationRate",
       label: "Inflation Rate",
       control: control,
       suffix: "%",
       description: "Expected average annual inflation rate. For current UK rates, refer to the ONS.",
       infoLink: "https://www.ons.gov.uk/economy/inflationandpriceindices",
       infoLinkText: "Check ONS for latest rates (opens new tab). If unsure, use a long-term average like 2-3%.",
       icon: TrendingDown,
     },
  ];

  if (!isFormInitialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <LoadingSpinner size={64} />
        <p className="mt-4 text-xl text-foreground font-semibold font-headline">
          Initializing Pension Pilot...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <AppHeader title="PensionView+" />

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
              No data is stored. All information is for your eyes only.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <h3 className="text-xl font-headline font-semibold text-primary border-b pb-2">Core Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6">
                {coreParamsFields.map(field => <FormInput key={field.name} {...field} />)}
              </div>
              
              <Separator />
              <h3 className="text-xl font-headline font-semibold text-primary border-b pb-2">Savings & Investments</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6">
                {savingsFields.map(field => <FormInput key={field.name} {...field} />)}
              </div>

              <Separator />
              <h3 className="text-xl font-headline font-semibold text-primary border-b pb-2">Defined Contribution (DC) Pension</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6 items-start">
                {dcPensionFields.map(field => <FormInput key={field.name} {...field} />)}
                 <div className="space-y-1"> 
                    <div className="flex items-center gap-1">
                         <Label htmlFor="takeTaxFreeLumpSum" className="text-sm font-medium">
                            Take 25% Tax-Free Lump Sum?
                         </Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0" tabIndex={-1}>
                                    <HelpCircleIcon className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-60 text-sm" side="top" align="start">
                                If enabled, 25% of your 'Current DC Pension Value' is taken tax-free at the start of the projection.
                                The remaining 75% forms your DC pot for drawdown. All subsequent UFPLS withdrawals from this pot will be fully taxable.
                                If disabled, each UFPLS withdrawal will have a 25% tax-free element.
                            </PopoverContent>
                         </Popover>
                    </div>
                    <Controller
                        name="takeTaxFreeLumpSum"
                        control={control}
                        render={({ field }) => (
                            <div className="flex items-center space-x-2 pt-2">
                                <Switch
                                    id="takeTaxFreeLumpSum"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    aria-labelledby="takeTaxFreeLumpSumLabel"
                                />
                                <span id="takeTaxFreeLumpSumLabel" className="text-sm text-muted-foreground">
                                    {field.value ? "Yes, take upfront lump sum" : "No, tax-free with each withdrawal"}
                                </span>
                            </div>
                        )}
                    />
                    {takeTaxFreeLumpSumWatched && isFormInitialized && (
                        <p className="text-xs text-muted-foreground pt-1">
                            Calculated Tax-Free Lump Sum: <span className="font-semibold">{formatCurrency(calculatedLumpSumDisplay)}</span>
                        </p>
                    )}
                </div>
              </div>

              <Separator />
              <h3 className="text-xl font-headline font-semibold text-primary border-b pb-2">Self-Invested Personal Pension (SIPP)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6 items-start">
                {sippFields.map(field => <FormInput key={field.name} {...field} />)}
                <div className="space-y-1"> 
                    <div className="flex items-center gap-1">
                         <Label htmlFor="takeSippTaxFreeLumpSum" className="text-sm font-medium">
                            Take 25% SIPP Tax-Free Lump Sum?
                         </Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0" tabIndex={-1}>
                                    <HelpCircleIcon className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-60 text-sm" side="top" align="start">
                                If enabled, 25% of your 'Current SIPP Value' is taken tax-free at the start of the projection.
                                The remaining 75% forms your SIPP pot for drawdown. All subsequent UFPLS withdrawals from this pot will be fully taxable.
                                If disabled, each UFPLS withdrawal from SIPP will have a 25% tax-free element.
                            </PopoverContent>
                         </Popover>
                    </div>
                    <Controller
                        name="takeSippTaxFreeLumpSum"
                        control={control}
                        render={({ field }) => (
                            <div className="flex items-center space-x-2 pt-2">
                                <Switch
                                    id="takeSippTaxFreeLumpSum"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    aria-labelledby="takeSippTaxFreeLumpSumLabel"
                                />
                                <span id="takeSippTaxFreeLumpSumLabel" className="text-sm text-muted-foreground">
                                    {field.value ? "Yes, take upfront lump sum" : "No, tax-free with each withdrawal"}
                                </span>
                            </div>
                        )}
                    />
                    {takeSippTaxFreeLumpSumWatched && isFormInitialized && (
                        <p className="text-xs text-muted-foreground pt-1">
                            Calculated SIPP Tax-Free Lump Sum: <span className="font-semibold">{formatCurrency(calculatedSippLumpSumDisplay)}</span>
                        </p>
                    )}
                </div>
              </div>


              <Separator />
              <div className="flex items-center gap-2 border-b pb-2">
                <h3 className="text-xl font-headline font-semibold text-primary">Defined Benefit (DB) &amp; State Pension</h3>
                <span className="text-sm text-muted-foreground">(Leave values at 0 if not applicable)</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0" tabIndex={-1}>
                      <InfoIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 text-sm" side="top" align="start">
                    A Defined Benefit (DB) pension, often referred to as a final salary pension, is a type of workplace pension where the employer guarantees a specific income for the employee during retirement.
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6">
                {dbStatePensionFields.map(field => <FormInput key={field.name} {...field} />)}
              </div>

              <Separator />
              <h3 className="text-xl font-headline font-semibold text-primary border-b pb-2">Economic Assumptions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6 items-end">
                {economicAssumptionsFields.map(field => <FormInput key={field.name} {...field} />)}
                 <div className="w-full max-w-[160px]">
                    <Label className="text-sm font-medium">
                      DC Real Growth <span className="text-xs text-muted-foreground font-normal">(DC Growth - Infl.)</span>
                    </Label>
                    <div className="flex items-center gap-2 mt-2 p-2 h-10 border border-input rounded-md bg-muted">
                        <TrendingUpIcon className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm font-semibold">{realGrowthDC}% pa</span>
                    </div>
                 </div>
                 <div className="w-full max-w-[160px]">
                    <Label className="text-sm font-medium">
                      SIPP Real Growth <span className="text-xs text-muted-foreground font-normal">(SIPP Growth - Infl.)</span>
                    </Label>
                    <div className="flex items-center gap-2 mt-2 p-2 h-10 border border-input rounded-md bg-muted">
                        <TrendingUpIcon className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm font-semibold">{realGrowthSIPP}% pa</span>
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
               {Object.keys(errors).length > 0 && !calculationError && (
                <Alert variant="destructive">
                  <AlertTriangleIcon className="h-5 w-5" />
                  <AlertTitle>Input Validation Error</AlertTitle>
                  <AlertDescription>
                    Please check the highlighted fields for errors and ensure all required inputs are validly entered.
                    Common issues: {Object.values(errors).map(err => err.message).join("; ")}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="border-t pt-6 flex flex-col md:flex-row gap-4 md:gap-2 justify-start">
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
              <Button type="button" variant="outline" onClick={handleResetForm} className="w-full md:w-auto text-lg py-3 px-6">
                <RotateCcwIcon className="mr-2 h-5 w-5" /> Reset Form
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
               {calculatedData.parameters.takeTaxFreeLumpSum && calculatedData.parameters.taxFreeLumpSumTaken !== undefined && (
                <Alert variant="default" className="mb-4 bg-primary/10 border-primary/30">
                  <InfoIcon className="h-5 w-5 text-primary" />
                  <AlertTitle className="font-semibold text-primary">DC Pension Tax-Free Lump Sum Taken</AlertTitle>
                  <AlertDescription className="text-primary/80">
                    An initial tax-free lump sum of <span className="font-bold">{formatCurrency(calculatedData.parameters.taxFreeLumpSumTaken)}</span> was taken from the DC pension.
                    The DC pension projection starts with the remaining balance. Subsequent UFPLS withdrawals are fully taxable.
                  </AlertDescription>
                </Alert>
              )}
              {calculatedData.parameters.takeSippTaxFreeLumpSum && calculatedData.parameters.sippTaxFreeLumpSumTaken !== undefined && (
                <Alert variant="default" className="mb-4 bg-primary/10 border-primary/30">
                  <InfoIcon className="h-5 w-5 text-primary" />
                  <AlertTitle className="font-semibold text-primary">SIPP Tax-Free Lump Sum Taken</AlertTitle>
                  <AlertDescription className="text-primary/80">
                    An initial tax-free lump sum of <span className="font-bold">{formatCurrency(calculatedData.parameters.sippTaxFreeLumpSumTaken)}</span> was taken from the SIPP.
                    The SIPP projection starts with the remaining balance. Subsequent UFPLS withdrawals from SIPP are fully taxable.
                  </AlertDescription>
                </Alert>
              )}
              <ViewModeToggle currentMode={viewMode} onModeChange={setViewMode} />
              {viewMode === 'table' ? (
                <PensionDataTable data={calculatedData.rows} headers={calculatedData.headers} />
              ) : (
                <PensionCharts data={calculatedData.rows} />
              )}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 items-start mt-12">
              <section aria-labelledby="drawdown-optimization-heading" className="lg:col-span-1">
                <h2 id="drawdown-optimization-heading" className="sr-only">Drawdown Optimization</h2>
                <DrawdownOptimizationCard
                  csvDataString={calculatedData.csvString}
                  financialParams={calculatedData.parameters}
                />
              </section>
            </div>
          </>
        )}
      </main>

      <footer className="py-6 text-center text-muted-foreground text-sm border-t border-border mt-auto">
        {footerYear !== null ? <p>&copy; {footerYear} PensionView+. All rights reserved.</p> : <p>&copy; PensionView+. All rights reserved.</p>}
        <p>Pension planning, simplified.</p>
      </footer>
    </div>
  );
}

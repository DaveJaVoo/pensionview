
"use client";
import type { FC } from 'react';
import React from 'react';
import type { PensionDataRow } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { formatCurrency, parseCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PensionDataTableProps {
  data: PensionDataRow[];
  headers: string[];
  retirementAge: number;
  statePensionAge: number;
}

const PensionDataTable: FC<PensionDataTableProps> = ({ data, headers, retirementAge, statePensionAge }) => {
  const isMonetaryHeader = (header: string): boolean => {
    const lowerHeader = header.toLowerCase();
    return lowerHeader.includes('pension') ||
           lowerHeader.includes('sipp') ||
           lowerHeader.includes('income') ||
           lowerHeader.includes('savings') || 
           lowerHeader.includes('cash') ||
           lowerHeader.includes('isa') ||
           lowerHeader.includes('gia') ||
           lowerHeader.includes('charge') || 
           lowerHeader.includes('growth') || 
           lowerHeader.includes('balance') || 
           lowerHeader.includes('drawdown') || 
           lowerHeader.includes('tax paid') || 
           lowerHeader.includes('value') ||
           lowerHeader.includes('initial') ||
           lowerHeader.includes('withdrawn') ||
           lowerHeader.includes('contribution') ||
           lowerHeader.includes('minus amc') ||
           lowerHeader.includes('after deductions');
  };
  
  const formatHeaderForDisplay = (header: string): React.ReactNode => {
    const specificHeaders: Record<string, string[]> = {
      'Initial DC Pension': ['Initial DC', 'Pension'],
      'DC Pension Contribution': ['DC Pension', 'Contrib.'],
      'DC Pension Drawdown': ['DC Pension', 'Drawdown'],
      'DC AMC Charge': ['DC AMC', 'Charge'],
      'DC Pension After Deductions': ['DC Pension', 'After Deductions'],
      'DC Pension Growth': ['DC Pension', 'Growth'],
      'DC Pension Balance': ['DC Pension', 'Balance'],

      'Initial SIPP': ['Initial SIPP'],
      'SIPP Contribution': ['SIPP', 'Contrib.'],
      'SIPP Drawdown': ['SIPP', 'Drawdown'],
      'SIPP AMC Charge': ['SIPP AMC', 'Charge'],
      'SIPP After Deductions': ['SIPP', 'After Deductions'],
      'SIPP Growth': ['SIPP', 'Growth'],
      'SIPP Balance': ['SIPP', 'Balance'],

      'DB Pension': ['DB Pension'],
      'FAS Pension': ['FAS Pension'],
      'State Pension': ['State Pension'],
      'Other Income': ['Other Income'],
      'Cash Savings Initial': ['Cash Sav.', 'Initial'],
      'Cash Savings Contribution': ['Cash Sav.', 'Contrib.'],
      'Withdraw from Cash': ['Withdraw', 'Cash'],
      'Cash Savings Balance': ['Cash Sav.', 'Balance'],
      'ISA Initial': ['ISA Initial'],
      'ISA Contribution': ['ISA', 'Contrib.'],
      'ISA Growth': ['ISA Growth'],
      'ISA Value Before Withdrawal': ['ISA Value', 'Pre-Withdraw'],
      'Withdraw from ISA': ['Withdraw', 'ISA'],
      'ISA Balance': ['ISA Balance'],
      'GIA Initial': ['GIA Initial'],
      'GIA Contribution': ['GIA', 'Contrib.'],
      'GIA Growth': ['GIA Growth'],
      'GIA Value Before Withdrawal': ['GIA Value', 'Pre-Withdraw'],
      'Withdraw from GIA': ['Withdraw', 'GIA'],
      'GIA Balance': ['GIA Balance'],
      'Total Savings Withdrawn': ['Total Sav.', 'Withdrawn'],
      'Total Savings Balance': ['Total Sav.', 'Balance'],
      'TOTAL INCOME': ['TOTAL', 'INCOME'],
      'Income Subject to Tax': ['Income Subject', 'to Tax'],
      'Income Tax Paid': ['Income Tax', 'Paid'],
      'Net Income Per Year': ['Net Income', 'Per Year'],
      'Net Income Per Month': ['Net Income', 'Per Month'],
    };

    const upperHeader = header.toUpperCase();
    const foundHeaderKey = Object.keys(specificHeaders).find(key => key.toUpperCase() === upperHeader);

    if (foundHeaderKey && specificHeaders[foundHeaderKey]) {
      const lines = specificHeaders[foundHeaderKey];
      return lines.map((line, index) => (
        <React.Fragment key={index}>
          {line}
          {index < lines.length - 1 && <br />}
        </React.Fragment>
      ));
    }
    return header;
  };

  const isGreenStyledHeader = (header: string): boolean => {
    const lowerHeader = header.toLowerCase();
    return lowerHeader.includes('state pension') || 
           lowerHeader.includes('db pension') ||
           lowerHeader.includes('fas pension') ||
           lowerHeader.includes('other income') ||
           lowerHeader.includes('dc pension contribution') || 
           lowerHeader.includes('sipp contribution') ||
           lowerHeader.includes('cash savings contribution') ||
           lowerHeader.includes('gia contribution') ||
           lowerHeader.includes('isa contribution');
  };

  const isPinkStyledHeader = (header: string): boolean => {
    const lowerHeader = header.toLowerCase();
    return lowerHeader.includes('dc pension drawdown') || 
           lowerHeader.includes('sipp drawdown') ||
           lowerHeader.includes('withdraw from cash') ||
           lowerHeader.includes('withdraw from isa') ||
           lowerHeader.includes('withdraw from gia') ||
           lowerHeader.includes('total savings withdrawn') ||
           lowerHeader.includes('dc amc charge') ||
           lowerHeader.includes('sipp amc charge') ||
           lowerHeader.includes('income tax paid');
  };

  const isBlueStyledHeader = (header: string): boolean => {
    const lowerHeader = header.toLowerCase();
    return lowerHeader.includes('net income per year') || lowerHeader.includes('net income per month');
  };

  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-md border shadow-lg bg-card">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead 
                key={header} 
                className="px-3 py-3 text-left text-xs font-medium text-card-foreground uppercase tracking-wider font-headline align-top border-l-2 border-border first:border-l-0"
                style={{ whiteSpace: 'normal' }}
              >
                {formatHeaderForDisplay(header)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => {
            const isPreRetirementRow = row.Age === retirementAge - 1;
            const isPreStatePensionRow = row.Age === statePensionAge - 1;

            return (
            <TableRow 
              key={rowIndex} 
              className={cn(
                "hover:bg-muted/50 transition-colors duration-150 even:bg-card odd:bg-background",
                isPreRetirementRow && "border-b-2 border-destructive",
                isPreStatePensionRow && "border-b-2 border-emerald-500"
              )}
            >
              {headers.map((header) => {
                const cellValue = row[header];
                let displayValue: string | number | undefined = cellValue;
                let cellClasses = "px-3 py-3 text-sm text-card-foreground text-left align-top border-l-2 border-border first:border-l-0";

                if (isMonetaryHeader(header)) {
                  const parsedNum = parseCurrency(String(cellValue));
                  if (header.toLowerCase() === 'income tax paid' && (parsedNum === 0 || parsedNum === undefined)) {
                     displayValue = "£0";
                  } else {
                     displayValue = formatCurrency(cellValue);
                  }
                }

                const numericValueForStyling = typeof cellValue === 'number' ? cellValue : parseCurrency(String(cellValue));

                if (header.toLowerCase() === 'income tax paid' && numericValueForStyling !== undefined && numericValueForStyling > 0) {
                  cellClasses = cn(cellClasses, "font-semibold");
                } else if (header.toLowerCase() !== 'income tax paid') {
                  // Normal styling for non-tax columns
                } else {
                  // This is for tax paid being zero, it won't be bold.
                }

                if (isBlueStyledHeader(header)) {
                    cellClasses = cn(cellClasses, "font-semibold");
                }
                
                if (isGreenStyledHeader(header)) {
                  if (numericValueForStyling !== undefined && numericValueForStyling > 0) {
                    cellClasses = cn(cellClasses, "bg-emerald-50 dark:bg-emerald-900/40");
                  }
                } else if (isPinkStyledHeader(header)) {
                  if (numericValueForStyling !== undefined && numericValueForStyling > 0) {
                    cellClasses = cn(cellClasses, "bg-pink-50 dark:bg-pink-900/40");
                  }
                } else if (isBlueStyledHeader(header)) {
                  if (numericValueForStyling !== undefined && numericValueForStyling > 0) {
                    cellClasses = cn(cellClasses, "bg-sky-100 dark:bg-sky-900/40");
                  }
                }
                
                return (
                  <TableCell key={header} className={cellClasses}>
                    {displayValue === undefined || displayValue === null || (typeof displayValue === 'string' && displayValue.trim() === '') ? '-' : String(displayValue)}
                  </TableCell>
                );
              })}
            </TableRow>
          );
          })}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export default PensionDataTable;

    
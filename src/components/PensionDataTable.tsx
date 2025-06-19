
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
}

const PensionDataTable: FC<PensionDataTableProps> = ({ data, headers }) => {
  const isMonetaryHeader = (header: string): boolean => {
    const lowerHeader = header.toLowerCase();
    return lowerHeader.includes('pension') ||
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
           lowerHeader.includes('contribution') || // Added for DC Pension Contribution
           lowerHeader.includes('dc minus amc');
  };
  
  const isNumericHeader = (header: string): boolean => {
    return header === "Age";
  }

  const formatHeaderForDisplay = (header: string): React.ReactNode => {
    const specificHeaders: Record<string, string[]> = {
      'Initial DC Pension': ['Initial DC', 'Pension'],
      'DC Pension Contribution': ['DC Pension', 'Contrib.'], // New
      'DC Pension Growth': ['DC Pension', 'Growth'],
      'DC Pension + Growth': ['DC Pension', '+ Growth'],
      'DC AMC Charge': ['DC AMC', 'Charge'],
      'DC Minus AMC': ['DC Minus', 'AMC'],
      'DC Pension Drawdown': ['DC Pension', 'Drawdown'],
      'DC Pension Balance': ['DC Pension', 'Balance'],
      'DB Pension': ['DB Pension'],
      'State Pension': ['State Pension'],
      'Cash Savings Initial': ['Cash Sav.', 'Initial'],
      'Withdraw from Cash': ['Withdraw', 'Cash'],
      'Cash Savings Balance': ['Cash Sav.', 'Balance'],
      'ISA Initial': ['ISA Initial'],
      'ISA Growth': ['ISA Growth'],
      'ISA Value Before Withdrawal': ['ISA Value', 'Pre-Withdraw'],
      'Withdraw from ISA': ['Withdraw', 'ISA'],
      'ISA Balance': ['ISA Balance'],
      'GIA Initial': ['GIA Initial'],
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
    return lowerHeader.includes('dc pension drawdown') || 
           lowerHeader.includes('state pension') || 
           lowerHeader.includes('db pension') ||
           lowerHeader.includes('dc pension contribution') || // New
           lowerHeader.includes('withdraw from cash') ||
           lowerHeader.includes('withdraw from isa') ||
           lowerHeader.includes('withdraw from gia') ||
           lowerHeader.includes('total savings withdrawn');
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
                className="px-3 py-3 text-left text-xs font-medium text-card-foreground uppercase tracking-wider font-headline align-top"
                style={{ whiteSpace: 'normal' }}
              >
                {formatHeaderForDisplay(header)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow key={rowIndex} className="hover:bg-muted/50 transition-colors duration-150 even:bg-card odd:bg-background">
              {headers.map((header) => {
                const cellValue = row[header];
                let displayValue: string | number | undefined = cellValue;
                let cellClasses = "px-3 py-3 text-sm text-card-foreground text-left align-top";

                if (isMonetaryHeader(header) || (typeof cellValue === 'string' && cellValue.includes('£'))) {
                  displayValue = formatCurrency(cellValue);
                }

                const numericValueForStyling = typeof cellValue === 'number' ? cellValue : parseCurrency(String(cellValue));

                if (header === 'Income Tax Paid') {
                  if (numericValueForStyling !== undefined && numericValueForStyling > 0) {
                    cellClasses = cn(cellClasses, "bg-destructive/20 text-gray-900 dark:text-destructive-foreground font-semibold");
                  } else if (numericValueForStyling === 0) {
                     cellClasses = cn(cellClasses, "text-green-700 dark:text-green-400"); 
                     displayValue = "£0"; 
                  }
                } else if (isGreenStyledHeader(header)) {
                  if (numericValueForStyling !== undefined && numericValueForStyling > 0) {
                    cellClasses = cn(cellClasses, "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium");
                  }
                } else if (isBlueStyledHeader(header)) {
                  if (numericValueForStyling !== undefined && numericValueForStyling > 0) {
                    cellClasses = cn(cellClasses, "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-medium");
                  }
                }
                
                return (
                  <TableCell key={header} className={cellClasses}>
                    {displayValue === undefined || displayValue === null || (typeof displayValue === 'string' && displayValue.trim() === '') ? '-' : String(displayValue)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export default PensionDataTable;

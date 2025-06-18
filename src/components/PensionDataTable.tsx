
"use client";
import type { FC } from 'react';
import React from 'react';
import type { PensionDataRow } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { formatCurrency, parseCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { DEFAULT_HEADERS } from '@/lib/pensionData'; // Import the new headers

interface PensionDataTableProps {
  data: PensionDataRow[];
  headers: string[]; // This will now be DEFAULT_HEADERS from pensionData
}

const PensionDataTable: FC<PensionDataTableProps> = ({ data, headers }) => {
  const isMonetaryHeader = (header: string): boolean => {
    const lowerHeader = header.toLowerCase();
    // Adjusted to match new headers
    return lowerHeader.includes('pension') ||
           lowerHeader.includes('income') ||
           lowerHeader.includes('savings') || // 'Withdraw from Savings'
           lowerHeader.includes('charge') || // 'DC AMC Charge'
           lowerHeader.includes('growth') || // 'DC Pension Growth'
           lowerHeader.includes('balance') || // 'DC Pension Balance'
           lowerHeader.includes('drawdown') || // 'DC UFPLS Drawdown'
           lowerHeader.includes('tax paid') || // 'Income Tax Paid'
           lowerHeader.includes('value') || // 'Initial DC Pension Value'
           lowerHeader.includes('dc minus amc'); // Added this check
  };
  
  const isNumericHeader = (header: string): boolean => {
    return header === "Age";
  }

  const formatHeaderForDisplay = (header: string): React.ReactNode => {
    // Define multi-line formatting for new headers
    const specificHeaders: Record<string, string[]> = {
      'Initial DC Pension': ['Initial DC', 'Pension'],
      'DC Pension Growth': ['DC Pension', 'Growth'],
      'DC Pension + Growth': ['DC Pension', '+ Growth'],
      'DC AMC Charge': ['DC AMC', 'Charge'],
      'DC Minus AMC': ['DC Minus', 'AMC'],
      'DC UFPLS Drawdown': ['DC UFPLS', 'Drawdown'],
      'DC Pension Balance': ['DC Pension', 'Balance'],
      'DB Pension': ['DB Pension'],
      'State Pension': ['State Pension'],
      'Withdraw from Savings': ['Withdraw', 'from Savings'],
      'TOTAL INCOME': ['TOTAL', 'INCOME'],
      'Income Subject to Tax': ['Income Subject', 'to Tax'],
      'Income Tax Paid': ['Income Tax', 'Paid'],
      'Net Income Per Year': ['Net Income', 'Per Year'],
      'Net Income Per Month': ['Net Income', 'Per Month'],
    };

    const upperHeader = header.toUpperCase(); // Normalize for matching
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
                  cellClasses = cn(cellClasses, "font-mono");
                } else if (isNumericHeader(header)) {
                   cellClasses = cn(cellClasses, "font-mono");
                } else if (header === 'Year') {
                   cellClasses = cn(cellClasses, "font-mono");
                }


                if (header === 'Income Tax Paid') {
                  const taxPaidNum = typeof cellValue === 'number' ? cellValue : parseCurrency(String(cellValue));
                  if (taxPaidNum !== undefined && taxPaidNum > 0) {
                    cellClasses = cn(cellClasses, "bg-destructive/20 text-destructive-foreground font-semibold");
                  } else if (taxPaidNum === 0) {
                     cellClasses = cn(cellClasses, "text-green-700 dark:text-green-400");
                     displayValue = "£0"; // Show £0 instead of "No Tax" or "-" if tax is actually zero
                  }
                }
                
                // Display '-' for zero values in monetary columns, except for tax paid if it's explicitly "£0"
                if (isMonetaryHeader(header) && (displayValue === "£0" || displayValue === 0) && header !== 'Income Tax Paid') {
                    // displayValue = "-"; // Re-evaluate if needed, £0 is fine.
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


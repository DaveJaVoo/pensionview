
"use client";
import type { FC } from 'react';
import React from 'react'; // Import React for React.Fragment
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
           lowerHeader.includes('charge') ||
           lowerHeader.includes('growth') ||
           lowerHeader.includes('balance') ||
           lowerHeader.includes('drawdown') ||
           lowerHeader.includes('tax paid');
  };
  
  const isNumericHeader = (header: string): boolean => {
    return header === "AGE";
  }

  const formatHeaderForDisplay = (header: string): React.ReactNode => {
    const specificHeaders: Record<string, string[]> = {
      'DC PENSION GROWTH @ % SHOWN BELOW': [
        'DC PENSION',
        'GROWTH',
        '@ %',
        'SHOWN BELOW',
      ],
      'DC PENSION AMC CHARGE @ % SHOWN BELOW': [
        'DC PENSION',
        'AMC CHARGE',
        '@ %',
        'SHOWN BELOW',
      ],
      'TAXABLE INCOME = DRAWDOWN + FAS + STATE': [
        'TAXABLE INCOME',
        '= DRAWDOWN',
        '+ FAS + STATE',
      ],
      'MY INCOME PER YEAR': ['MY INCOME', 'PER YEAR'],
      'MY INCOME PER MONTH': ['MY INCOME', 'PER MONTH'],
      "KATE'S INCOME PER YEAR": ["KATE'S INCOME", 'PER YEAR'],
      "KATE'S INCOME PER MONTH": ["KATE'S INCOME", 'PER MONTH'],
      'JOINT INCOME PER YEAR': ['JOINT INCOME', 'PER YEAR'],
      'JOINT INCOME PER MONTH': ['JOINT INCOME', 'PER MONTH'],
      'INITIAL DC PENSION': ['INITIAL DC', 'PENSION'],
      'DC PENSION PLUS GROWTH': ['DC PENSION', 'PLUS GROWTH'],
      'DC PENSION MINUS CHARGES': ['DC PENSION', 'MINUS CHARGES'],
      'DC PENSION UFPLS DRAWDOWN': ['DC PENSION', 'UFPLS DRAWDOWN'],
      'DC PENSION BALANCE': ['DC PENSION', 'BALANCE'],
      'DB PENSION (FAS)': ['DB PENSION', '(FAS)'],
      'STATE PENSION': ['STATE', 'PENSION'],
      'WITHDRAW FROM SAVINGS': ['WITHDRAW FROM', 'SAVINGS'],
      'TOTAL INCOME': ['TOTAL', 'INCOME'],
      'INCOME TAX PAID': ['INCOME TAX', 'PAID'],
    };

    if (specificHeaders[header.toUpperCase()]) { // Match case-insensitively, but use original header for key
      const lines = specificHeaders[header.toUpperCase()];
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
                style={{ whiteSpace: 'normal' }} // Allow text to wrap
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
                }


                if (header === 'INCOME TAX PAID') {
                  const taxPaid = parseCurrency(row['INCOME TAX PAID']);
                  if (taxPaid !== undefined && taxPaid > 0) {
                    cellClasses = cn(cellClasses, "bg-destructive/20 text-destructive-foreground font-semibold");
                  } else if (String(row['INCOME TAX PAID']).toLowerCase() === 'no tax') {
                     cellClasses = cn(cellClasses, "text-green-700 dark:text-green-400");
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


"use client";
import type { FC } from 'react';
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

  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-md border shadow-lg bg-card">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header} className="px-3 py-3 text-left text-xs font-medium text-card-foreground uppercase tracking-wider font-headline">
                {header}
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
                let cellClasses = "px-3 py-3 text-sm text-card-foreground text-left";

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

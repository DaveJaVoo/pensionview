
import type { PensionDataRow, FinancialParameters, ParsedPensionData } from './types';
import { parseCurrency, parsePercentage } from './utils';
import * as XLSX from 'xlsx';

const cleanHeader = (header: string): string => {
  return String(header).trim();
};

const isMonetaryHeader = (header: string): boolean => {
  const lowerHeader = cleanHeader(header).toLowerCase();
  return lowerHeader.includes('pension') ||
         lowerHeader.includes('income') ||
         lowerHeader.includes('savings') ||
         lowerHeader.includes('charge') ||
         lowerHeader.includes('balance') ||
         lowerHeader.includes('drawdown') ||
         lowerHeader.includes('taxable income') || // Added taxable income
         lowerHeader.includes('tax paid');
  // Note: 'growth' might be ambiguous (percentage or value), handled by specific parsing logic later
};


export async function getPensionData(file: File): Promise<ParsedPensionData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result;
        if (!arrayBuffer) {
          reject(new Error("Failed to read file."));
          return;
        }
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            reject(new Error("No sheets found in the Excel file."));
            return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: "" });

        if (jsonData.length === 0 || jsonData[0].length === 0) {
          reject(new Error("Spreadsheet is empty or has an unexpected format. Ensure headers are in the first row."));
          return;
        }

        const rawHeaders: string[] = jsonData[0].map(String);
        const displayHeaders = rawHeaders.map(cleanHeader).filter(h => h !== "");

        const dataRows: PensionDataRow[] = [];
        const parameterLinesValues: any[][] = [];
        let dataSectionEnded = false;

        const csvForAI: string[] = [rawHeaders.join(',')];

        for (let i = 1; i < jsonData.length; i++) {
          const lineValues: any[] = jsonData[i];
          
          // Reconstruct a CSV-like line for AI, handling potential commas in string values
          const csvLineParts = lineValues.map(v => {
            const valStr = String(v);
            return (valStr.includes(',')) ? `"${valStr.replace(/"/g, '""')}"` : valStr;
          });
          const csvLine = csvLineParts.join(',');

          if (lineValues.some(cell => String(cell).includes("THE GOAL IS TO END WITH ZERO"))) {
            dataSectionEnded = true;
            continue;
          }

          const firstCellAsString = String(lineValues[0]).trim();

          if (firstCellAsString === "INITIAL DC PENSION VALUE" ||
              firstCellAsString === "INVESTMENT PERCENTAGE GROWTH" ||
              firstCellAsString === "INFLATION" ||
              firstCellAsString === "REAL GROWTH" ||
              firstCellAsString === "WITHDRAWAL RATE" ||
              firstCellAsString === "(ANNUAL CHARGE) AMC" ||
              (lineValues.length > 4 && String(lineValues[4]).trim() === "TOTAL AMC CHARGES")) {
            dataSectionEnded = true; 
            parameterLinesValues.push(lineValues);
            continue;
          }

          if (!dataSectionEnded && firstCellAsString !== "" && lineValues.length > 0) {
            csvForAI.push(csvLine);
            const row: any = {};
            rawHeaders.forEach((rawHeader, index) => {
              const headerKey = cleanHeader(rawHeader);
              if (!headerKey) return; // Skip empty headers

              const rawValue = lineValues[index];
              const stringValue = String(rawValue).trim();
              
              if (headerKey === 'AGE') {
                row[headerKey] = parseInt(stringValue || "0", 10);
              } else if (headerKey === 'INCOME TAX PAID') {
                row[headerKey] = stringValue.toLowerCase() === 'no tax' ? 'NO TAX' : parseCurrency(stringValue);
              } else if (isMonetaryHeader(headerKey)) {
                 row[headerKey] = parseCurrency(stringValue);
              } else if (headerKey.includes('%') || 
                         headerKey.toLowerCase().includes('percentage growth') || 
                         headerKey.toLowerCase().includes('inflation') ||
                         headerKey.toLowerCase().includes('withdrawal rate') ||
                         headerKey.toLowerCase().includes('amc')) {
                 // Try to parse as percentage if header suggests it
                 row[headerKey] = parsePercentage(stringValue);
                 // If parsing as percentage fails but it's a monetary header (e.g. DC PENSION GROWTH @ % SHOWN BELOW which is a value)
                 // then parse as currency. This handles cases where '%' is in the header but value is monetary.
                 if (row[headerKey] === undefined && isMonetaryHeader(headerKey)){
                    row[headerKey] = parseCurrency(stringValue);
                 }
              }
              else {
                row[headerKey] = rawValue; // Keep as is if not specifically handled
              }
            });
            dataRows.push(row as PensionDataRow);
          }
        }
        
        const parameters: FinancialParameters = {
          initialDcPensionValue: 0,
          investmentPercentageGrowth: 0,
          inflationRate: 0,
          withdrawalRate: 0,
          annualChargeAMC: 0,
        };

        parameterLinesValues.forEach(parts => {
          if (parts.length > 0) {
            const key = String(parts[0]).trim();
            if (key === "INITIAL DC PENSION VALUE" && parts.length > 1) parameters.initialDcPensionValue = parseCurrency(String(parts[1])) || 0;
            if (key === "INVESTMENT PERCENTAGE GROWTH" && parts.length > 2) parameters.investmentPercentageGrowth = parsePercentage(String(parts[2])) || 0;
            if (key === "INFLATION" && parts.length > 2) parameters.inflationRate = parsePercentage(String(parts[2])) || 0;
            if (key === "WITHDRAWAL RATE" && parts.length > 2) parameters.withdrawalRate = parsePercentage(String(parts[2])) || 0;
            if (key === "(ANNUAL CHARGE) AMC" && parts.length > 2) parameters.annualChargeAMC = parsePercentage(String(parts[2])) || 0;
          }
        });
        
        resolve({ rows: dataRows, headers: displayHeaders, parameters, csvString: csvForAI.join('\n') });

      } catch (e) {
        console.error("Error parsing XLSX file:", e);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

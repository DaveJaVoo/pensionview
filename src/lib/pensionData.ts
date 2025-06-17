
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
         lowerHeader.includes('taxable income') || 
         lowerHeader.includes('tax paid');
};


export async function getPensionData(file: File): Promise<ParsedPensionData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result;
        if (!arrayBuffer) {
          reject(new Error("Failed to read file buffer."));
          return;
        }
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellNF: false, cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            reject(new Error("No sheets found in the Excel file. Please ensure the file contains at least one sheet."));
            return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
            reject(new Error(`Sheet named "${firstSheetName}" could not be found or is empty.`));
            return;
        }
        
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }); // Use null for empty cells

        if (jsonData.length === 0) {
          reject(new Error("Spreadsheet is empty. Ensure data and headers are present."));
          return;
        }
        if (jsonData[0].every(cell => cell === null || String(cell).trim() === "")) {
             reject(new Error("Spreadsheet headers are missing or empty. Ensure headers are in the first row."));
            return;
        }


        const rawHeaders: string[] = jsonData[0].map(h => String(h === null ? "" : h)); // Handle null headers
        const displayHeaders = rawHeaders.map(cleanHeader).filter(h => h !== "");

        if (displayHeaders.length === 0) {
            reject(new Error("No valid headers found in the first row of the spreadsheet."));
            return;
        }

        const dataRows: PensionDataRow[] = [];
        const parameterLinesValues: any[][] = [];
        let dataSectionEnded = false;

        const csvForAI: string[] = [rawHeaders.map(h => `"${cleanHeader(h).replace(/"/g, '""')}"`).join(',')];


        for (let i = 1; i < jsonData.length; i++) {
          const lineValues: any[] = jsonData[i];
          
          if (lineValues === null || lineValues.every(cell => cell === null || String(cell).trim() === "")) { // Skip entirely empty rows
            continue;
          }

          const csvLineParts = rawHeaders.map((_, index) => { // Iterate based on headers length
            const val = lineValues[index] === null ? "" : String(lineValues[index]);
            return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val;
          });
          const csvLine = csvLineParts.join(',');

          // Check for parameter section markers
          const firstCellContent = lineValues[0] === null ? "" : String(lineValues[0]).trim();
          if (firstCellContent.includes("THE GOAL IS TO END WITH ZERO") ||
              firstCellContent === "INITIAL DC PENSION VALUE" ||
              firstCellContent === "INVESTMENT PERCENTAGE GROWTH" ||
              firstCellContent === "INFLATION" ||
              firstCellContent === "REAL GROWTH" || // Assuming this is also a parameter marker
              firstCellContent === "WITHDRAWAL RATE" ||
              firstCellContent === "(ANNUAL CHARGE) AMC" ||
              (lineValues.length > 4 && String(lineValues[4]).trim() === "TOTAL AMC CHARGES")) {
            dataSectionEnded = true;
            if (firstCellContent !== "" && !firstCellContent.includes("THE GOAL IS TO END WITH ZERO")) { // Don't add the goal line to params
                 parameterLinesValues.push(lineValues.map(v => v === null ? "" : v));
            }
            continue; 
          }


          if (!dataSectionEnded && firstCellContent !== "") {
            csvForAI.push(csvLine);
            const row: any = {};
            displayHeaders.forEach((headerKey) => { // Iterate over cleaned displayHeaders
              const originalHeaderIndex = rawHeaders.findIndex(rh => cleanHeader(rh) === headerKey);
              if (originalHeaderIndex === -1) return;

              const rawValue = lineValues[originalHeaderIndex];
              const stringValue = rawValue === null ? "" : String(rawValue).trim();
              
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
                 row[headerKey] = parsePercentage(stringValue);
                 if (row[headerKey] === undefined && isMonetaryHeader(headerKey)){
                    row[headerKey] = parseCurrency(stringValue);
                 }
              }
              else {
                row[headerKey] = rawValue === null ? "" : rawValue; 
              }
            });
            if (Object.keys(row).length > 0) { // Ensure row is not empty
                 dataRows.push(row as PensionDataRow);
            }
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
            const val1 = parts.length > 1 ? String(parts[1]) : undefined;
            const val2 = parts.length > 2 ? String(parts[2]) : undefined;

            if (key === "INITIAL DC PENSION VALUE") parameters.initialDcPensionValue = parseCurrency(val1) || 0;
            if (key === "INVESTMENT PERCENTAGE GROWTH") parameters.investmentPercentageGrowth = parsePercentage(val2) || 0;
            if (key === "INFLATION") parameters.inflationRate = parsePercentage(val2) || 0;
            if (key === "WITHDRAWAL RATE") parameters.withdrawalRate = parsePercentage(val2) || 0;
            if (key === "(ANNUAL CHARGE) AMC") parameters.annualChargeAMC = parsePercentage(val2) || 0;
          }
        });
        
        if (dataRows.length === 0 && displayHeaders.length > 0 && !parameterLinesValues.some(p => String(p[0]).trim() === "INITIAL DC PENSION VALUE") ) {
             // If we have headers but no data rows and didn't find clear parameter markers, it might be a format issue.
             // However, an empty table is also possible. For now, resolve, but this could be a point for more specific errors.
        }

        resolve({ rows: dataRows, headers: displayHeaders, parameters, csvString: csvForAI.join('\n') });

      } catch (e) {
        console.error("Error processing XLSX file:", e);
        reject(e instanceof Error ? e : new Error("An unexpected error occurred during Excel file processing: " + String(e)));
      }
    };
    reader.onerror = (error) => {
        console.error("FileReader error:", error);
        reject(new Error("Failed to read the file with FileReader."));
    };
    reader.readAsArrayBuffer(file);
  });
}

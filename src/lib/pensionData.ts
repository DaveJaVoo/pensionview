
import type { PensionDataRow, FinancialParameters, ParsedPensionData } from './types';
import { parseCurrency, parsePercentage, formatCurrency } from './utils';
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
        
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null });

        if (jsonData.length === 0) {
          reject(new Error("Spreadsheet is empty. Ensure data and headers are present."));
          return;
        }
        if (!jsonData[0] || jsonData[0].every(cell => cell === null || String(cell).trim() === "")) {
             reject(new Error("Spreadsheet headers are missing or empty. Ensure headers are in the first row."));
            return;
        }

        const rawHeaders: string[] = jsonData[0].map(h => String(h === null ? "" : h)); 
        const displayHeaders = rawHeaders.map(cleanHeader).filter(h => h !== "");

        if (displayHeaders.length === 0) {
            reject(new Error("No valid headers found in the first row of the spreadsheet."));
            return;
        }

        const initiallyParsedRows: PensionDataRow[] = [];
        const parameterLinesValues: any[][] = [];
        let dataSectionEnded = false;

        for (let i = 1; i < jsonData.length; i++) {
          const lineValues: any[] = jsonData[i];
          
          if (lineValues === null || lineValues.every(cell => cell === null || String(cell).trim() === "")) {
            continue;
          }

          const firstCellContent = lineValues[0] === null ? "" : String(lineValues[0]).trim();
          if (firstCellContent.includes("THE GOAL IS TO END WITH ZERO") ||
              firstCellContent === "INITIAL DC PENSION VALUE" ||
              firstCellContent === "INVESTMENT PERCENTAGE GROWTH" ||
              firstCellContent === "INFLATION" ||
              firstCellContent === "REAL GROWTH" ||
              firstCellContent === "WITHDRAWAL RATE" ||
              firstCellContent === "(ANNUAL CHARGE) AMC" ||
              (lineValues.length > 4 && String(lineValues[4]).trim() === "TOTAL AMC CHARGES")) {
            dataSectionEnded = true;
            if (firstCellContent !== "" && !firstCellContent.includes("THE GOAL IS TO END WITH ZERO")) {
                 parameterLinesValues.push(lineValues.map(v => v === null ? "" : v));
            }
            continue; 
          }

          if (!dataSectionEnded && firstCellContent !== "") {
            const row: any = {};
            displayHeaders.forEach((headerKey) => {
              const originalHeaderIndex = rawHeaders.findIndex(rh => cleanHeader(rh) === headerKey);
              if (originalHeaderIndex === -1) return;

              const rawValue = lineValues[originalHeaderIndex];
              const stringValue = rawValue === null ? "" : String(rawValue).trim();
              
              if (headerKey === 'AGE') {
                row[headerKey] = parseInt(stringValue || "0", 10);
              } else if (headerKey === 'YEAR') {
                row[headerKey] = String(rawValue === null ? "" : rawValue); // Keep YEAR as string
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
                 if (row[headerKey] === undefined && isMonetaryHeader(headerKey)){ // Fallback for cells like "5%" that are monetary
                    row[headerKey] = parseCurrency(stringValue);
                 }
              }
              else {
                row[headerKey] = rawValue === null ? "" : rawValue; 
              }
            });
            if (Object.keys(row).length > 0 && row['AGE'] !== 0) { 
                 initiallyParsedRows.push(row as PensionDataRow);
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

        // Perform calculations
        const calculatedDataRows: PensionDataRow[] = [];
        let previousRowData: PensionDataRow | null = null;

        const investmentGrowthDecimal = (typeof parameters.investmentPercentageGrowth === 'number' ? parameters.investmentPercentageGrowth : 0) / 100;
        const amcDecimal = (typeof parameters.annualChargeAMC === 'number' ? parameters.annualChargeAMC : 0) / 100;
        const withdrawalRateDecimal = (typeof parameters.withdrawalRate === 'number' ? parameters.withdrawalRate : 0) / 100;
        const inflationRateDecimal = (typeof parameters.inflationRate === 'number' ? parameters.inflationRate : 0) / 100;

        for (let index = 0; index < initiallyParsedRows.length; index++) {
            const sourceRow = initiallyParsedRows[index];
            const newRow = { ...sourceRow } as PensionDataRow; // Start with a copy

            // 1. INITIAL DC PENSION
            if (previousRowData) {
                newRow['INITIAL DC PENSION'] = previousRowData['DC PENSION BALANCE'];
            } else {
                newRow['INITIAL DC PENSION'] = parameters.initialDcPensionValue;
            }

            // 2. DC PENSION GROWTH @ % SHOWN BELOW
            newRow['DC PENSION GROWTH @ % SHOWN BELOW'] = (newRow['INITIAL DC PENSION'] || 0) * investmentGrowthDecimal;

            // 3. DC PENSION PLUS GROWTH
            newRow['DC PENSION PLUS GROWTH'] = (newRow['INITIAL DC PENSION'] || 0) + (newRow['DC PENSION GROWTH @ % SHOWN BELOW'] || 0);

            // 4. DC PENSION AMC CHARGE @ % SHOWN BELOW
            newRow['DC PENSION AMC CHARGE @ % SHOWN BELOW'] = (newRow['DC PENSION PLUS GROWTH'] || 0) * amcDecimal;

            // 5. DC PENSION MINUS CHARGES
            newRow['DC PENSION MINUS CHARGES'] = (newRow['DC PENSION PLUS GROWTH'] || 0) - (newRow['DC PENSION AMC CHARGE @ % SHOWN BELOW'] || 0);
            
            // 6. DC PENSION UFPLS DRAWDOWN
            const age = newRow['AGE'];
            const drawdownFromXLSX = sourceRow['DC PENSION UFPLS DRAWDOWN']; // This is already a number or undefined from initial parse

            if (age >= 63 && age <= 66) {
                newRow['DC PENSION UFPLS DRAWDOWN'] = typeof drawdownFromXLSX === 'number' ? drawdownFromXLSX : 0; // Must come from XLSX or be 0
            } else if (age > 66) {
                if (typeof drawdownFromXLSX === 'number') { // If XLSX provides a value for >66, use it
                    newRow['DC PENSION UFPLS DRAWDOWN'] = drawdownFromXLSX;
                } else { // Otherwise, calculate
                    newRow['DC PENSION UFPLS DRAWDOWN'] = (newRow['DC PENSION MINUS CHARGES'] || 0) * withdrawalRateDecimal;
                }
            } else { // Age < 63
                newRow['DC PENSION UFPLS DRAWDOWN'] = typeof drawdownFromXLSX === 'number' ? drawdownFromXLSX : 0; // Use XLSX if present, else 0
            }

            // 7. DC PENSION BALANCE
            newRow['DC PENSION BALANCE'] = (newRow['DC PENSION MINUS CHARGES'] || 0) - (newRow['DC PENSION UFPLS DRAWDOWN'] || 0);

            // 8. DB PENSION (FAS)
            const dbPensionFromXLSX = sourceRow['DB PENSION (FAS)'];
            if (age === 65 && typeof dbPensionFromXLSX === 'number') {
                newRow['DB PENSION (FAS)'] = dbPensionFromXLSX;
            } else if (age > 65) {
                if (typeof dbPensionFromXLSX === 'number') { // XLSX override for this year
                    newRow['DB PENSION (FAS)'] = dbPensionFromXLSX;
                } else if (previousRowData && typeof previousRowData['DB PENSION (FAS)'] === 'number') {
                    newRow['DB PENSION (FAS)'] = (previousRowData['DB PENSION (FAS)'] || 0) * (1 + inflationRateDecimal);
                } else {
                    newRow['DB PENSION (FAS)'] = undefined;
                }
            } else { // Age < 65
                 newRow['DB PENSION (FAS)'] = typeof dbPensionFromXLSX === 'number' ? dbPensionFromXLSX : undefined;
            }
            
            // 9. STATE PENSION
            const statePensionFromXLSX = sourceRow['STATE PENSION'];
            // Check if this is the first year State Pension appears, based on XLSX data
            const isFirstYearOfStatePensionInXLSX = typeof statePensionFromXLSX === 'number' && 
                                                 (!previousRowData || typeof previousRowData['STATE PENSION'] !== 'number');

            if (typeof statePensionFromXLSX === 'number') { // If XLSX specifies a value, always use it
                newRow['STATE PENSION'] = statePensionFromXLSX;
            } else if (previousRowData && typeof previousRowData['STATE PENSION'] === 'number') { // If no XLSX value, but there was one last year
                newRow['STATE PENSION'] = (previousRowData['STATE PENSION'] || 0) * (1 + inflationRateDecimal);
            } else { // No XLSX value and no previous year value
                newRow['STATE PENSION'] = undefined;
            }

            // Ensure other non-calculated monetary fields are numbers or undefined
            const fieldsToEnsureNumeric = [
                'MY INCOME PER YEAR', 'MY INCOME PER MONTH', 
                "KATE'S INCOME PER YEAR", "KATE'S INCOME PER MONTH",
                'JOINT INCOME PER YEAR', 'JOINT INCOME PER MONTH',
                'WITHDRAW FROM SAVINGS', 'TOTAL INCOME', 
                'TAXABLE INCOME = DRAWDOWN + FAS + STATE'
            ];
            fieldsToEnsureNumeric.forEach(field => {
                if (newRow.hasOwnProperty(field) && typeof newRow[field] !== 'number' && newRow[field] !== undefined) {
                     const parsedVal = parseCurrency(String(newRow[field]));
                     newRow[field] = parsedVal !== undefined ? parsedVal : 0; // Default to 0 if unparseable, or undefined based on need
                } else if (!newRow.hasOwnProperty(field) || newRow[field] === undefined) {
                    // if it's monetary and missing, set to 0. This depends on whether these fields are always expected.
                    if (isMonetaryHeader(field)) newRow[field] = 0; 
                }
            });
            if (newRow['INCOME TAX PAID'] !== 'NO TAX' && typeof newRow['INCOME TAX PAID'] !== 'number') {
                const parsedTax = parseCurrency(String(newRow['INCOME TAX PAID']));
                newRow['INCOME TAX PAID'] = parsedTax !== undefined ? parsedTax : 0;
            }


            calculatedDataRows.push(newRow);
            previousRowData = newRow;
        }

        // Generate CSV string from calculated data for AI
        const csvHeaderString = displayHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
        const csvRowStrings = calculatedDataRows.map(row => {
          return displayHeaders.map(header => {
            let val = row[header];
            if (typeof val === 'number') {
              // Format currency for CSV as plain number, or specific format if AI needs £
              // For simplicity, using raw number for AI, can be adjusted.
              return String(val); 
            }
            if (val === undefined || val === null) return "";
            const sVal = String(val);
            return sVal.includes(',') || sVal.includes('"') || sVal.includes('\n') ? `"${sVal.replace(/"/g, '""')}"` : sVal;
          }).join(',');
        });
        const csvStringForAI = [csvHeaderString, ...csvRowStrings].join('\n');

        if (calculatedDataRows.length === 0 && displayHeaders.length > 0 && !parameterLinesValues.some(p => String(p[0]).trim() === "INITIAL DC PENSION VALUE") ) {
             // This condition might need review based on calculation logic; an empty calculated table is possible.
        }

        resolve({ rows: calculatedDataRows, headers: displayHeaders, parameters, csvString: csvStringForAI });

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

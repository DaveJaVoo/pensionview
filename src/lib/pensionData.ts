
import type { PensionDataRow, FinancialParameters, ParsedPensionData } from './types';
import { parseCurrency, parsePercentage } from './utils';

const RAW_CSV_DATA = `AGE,YEAR,INITIAL DC PENSION,DC PENSION GROWTH @ % SHOWN BELOW,DC PENSION PLUS GROWTH,DC PENSION AMC CHARGE @ % SHOWN BELOW,DC PENSION MINUS CHARGES,DC PENSION UFPLS DRAWDOWN,DC PENSION BALANCE,DB PENSION (FAS),STATE PENSION,WITHDRAW FROM SAVINGS,TOTAL INCOME,TAXABLE INCOME = DRAWDOWN + FAS + STATE,INCOME TAX PAID,,MY INCOME PER YEAR,MY INCOME PER MONTH,,KATE'S INCOME PER YEAR,KATE'S INCOME PER MONTH,,JOINT INCOME PER YEAR,JOINT INCOME PER MONTH
63,SEPT 2025,"£188,000","£3,760","£191,760",£230,"£191,530","£16,860","£174,670",,,"£3,000","£19,860",,NO TAX,,"£19,860","£1,655",,"£12,000","£1,000",,"£31,860","£2,655"
64,SEPT 2026,"£174,670","£3,493","£178,163",£214,"£177,949","£16,860","£161,089",,,"£3,000","£19,860",,NO TAX,,"£19,860","£1,655",,"£12,000","£1,000",,"£31,860","£2,655"
65,SEPT 2027,"£161,089","£3,222","£164,311",£197,"£164,114","£8,000","£156,114","£7,842",,"£3,000","£18,842",,NO TAX,,"£18,842","£1,570",,"£12,000","£1,000",,"£30,842","£2,570"
66,SEPT 2028,"£156,114","£3,122","£159,236",£191,"£159,045","£10,000","£149,045","£8,156",,,"£18,156","£5,756","£1,151",,"£17,005","£1,417",,"£12,000","£1,000",,"£29,005","£2,417"
67,SEPT 2029,"£149,045","£2,981","£152,026",£182,"£151,844","£8,943","£142,901","£8,482","£12,400",,"£29,825","£17,425","£3,485",,"£26,340","£2,195",,"£12,000","£1,000",,"£38,340","£3,195"
68,SEPT 2030,"£142,901","£2,858","£145,759",£175,"£145,584","£8,574","£137,010","£8,821","£12,896",,"£30,291","£17,395","£3,479",,"£26,812","£2,234",,"£12,000","£1,000",,"£38,812","£3,234"
69,SEPT 2031,"£137,010","£2,740","£139,750",£168,"£139,583","£8,221","£131,362","£9,174","£13,412",,"£30,806","£17,395","£3,479",,"£27,328","£2,277",,"£12,000","£1,000",,"£39,328","£3,277"
70,SEPT 2032,"£131,362","£2,627","£133,989",£161,"£133,828","£7,882","£125,947","£9,541","£13,948",,"£31,371","£17,423","£3,485",,"£27,886","£2,324",,"£12,000","£1,000",,"£39,886","£3,324"
71,SEPT 2033,"£125,947","£2,519","£128,466",£154,"£128,312","£7,557","£120,755","£9,923","£14,506",,"£31,986","£17,479","£3,496",,"£28,490","£2,374",,"£12,000","£1,000",,"£40,490","£3,374"
72,SEPT 2034,"£120,755","£2,415","£123,170",£148,"£123,022","£7,245","£115,777","£10,320","£15,086",,"£32,651","£17,565","£3,513",,"£29,138","£2,428",,"£12,000","£1,000",,"£41,138","£3,428"
73,SEPT 2035,"£115,777","£2,316","£118,092",£142,"£117,951","£6,947","£111,004","£10,732","£15,690",,"£33,369","£17,679","£3,536",,"£29,833","£2,486",,"£12,000","£1,000",,"£41,833","£3,486"
74,SEPT 2036,"£111,004","£2,220","£113,224",£136,"£113,088","£6,660","£106,428","£11,162","£16,318",,"£34,139","£17,822","£3,564",,"£30,575","£2,548",,"£12,000","£1,000",,"£42,575","£3,548"
75,SEPT 2037,"£106,428","£2,129","£108,556",£130,"£108,426","£6,386","£102,041","£11,608","£16,970",,"£34,964","£17,994","£3,599",,"£31,365","£2,614",,"£12,000","£1,000",,"£43,365","£3,614"
76,SEPT 2038,"£102,041","£2,041","£104,081",£125,"£103,956","£6,122","£97,834","£12,072","£17,649",,"£35,844","£18,195","£3,639",,"£32,205","£2,684",,"£12,000","£1,000",,"£44,205","£3,684"
77,SEPT 2039,"£97,834","£1,957","£99,791",£120,"£99,671","£5,870","£93,801","£12,555","£18,355",,"£36,780","£18,425","£3,685",,"£33,095","£2,758",,"£12,000","£1,000",,"£45,095","£3,758"
78,SEPT 2040,"£93,801","£1,876","£95,677",£115,"£95,562","£5,628","£89,934","£13,058","£19,089",,"£37,775","£18,686","£3,737",,"£34,038","£2,836",,"£12,480","£1,040",,"£46,518","£3,876"
79,SEPT 2041,"£89,934","£1,799","£91,733",£110,"£91,623","£5,396","£86,227","£13,580","£19,853",,"£38,829","£18,976","£3,795",,"£35,033","£2,919",,"£12,979","£1,082",,"£48,013","£4,001"
80,SEPT 2042,"£86,227","£1,725","£87,951",£106,"£87,846","£5,174","£82,672","£14,123","£20,647",,"£39,944","£19,297","£3,859",,"£36,084","£3,007",,"£13,498","£1,125",,"£49,583","£4,132"
81,SEPT 2043,"£82,672","£1,653","£84,325",£101,"£84,224","£4,960","£79,264","£14,688","£21,473",,"£41,121","£19,648","£3,930",,"£37,191","£3,099",,"£14,038","£1,170",,"£51,230","£4,269"
82,SEPT 2044,"£74,508","£1,490","£75,998",£91,"£75,907","£4,756","£71,151","£15,275","£22,332",,"£42,363","£20,031","£4,006",,"£38,357","£3,196",,"£14,600","£1,217",,"£52,957","£4,413"
,THE GOAL IS TO END WITH ZERO - THE GOAL IS TO END WITH ZERO - THE GOAL IS TO END WITH ZERO - THE GOAL IS TO END WITH ZERO - THE GOAL IS TO END WITH ZERO - THE GOAL IS TO END WITH ZERO - THE GOAL IS TO END WITH ZERO ,,,,,,,,,,,,,,,,,,,,,,
INITIAL DC PENSION VALUE,"£188,000",,,,,,,,,,,,,,,,,,,,,
INVESTMENT PERCENTAGE GROWTH,,2.00%,,,,,,,,,,,,,,,,,,,,
INFLATION,,4.00%,,,,,,,,,,,,,,,,,,,,
REAL GROWTH,,-2.00%,,,,,,,,,,,,,,,,,,,
WITHDRAWAL RATE,,6.00%,,,,,,,,,,,,,,,,,,,,
(ANNUAL CHARGE) AMC,,0.12%,,,,,,,,,,,,,,,,,,,,
,,,,TOTAL AMC CHARGES,"£2,995",,,,,,,,,,,,,,,,,,
`;

const cleanHeader = (header: string): string => {
  return header.trim();
};

export function getPensionData(): ParsedPensionData {
  const lines = RAW_CSV_DATA.trim().split('\n');
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(cleanHeader);
  
  const dataRows: PensionDataRow[] = [];
  const parameterLines: string[] = [];
  let dataSectionEnded = false;

  const dataCsvForAI: string[] = [headerLine];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("THE GOAL IS TO END WITH ZERO")) {
      dataSectionEnded = true;
      continue;
    }
    if (line.startsWith("INITIAL DC PENSION VALUE") ||
        line.startsWith("INVESTMENT PERCENTAGE GROWTH") ||
        line.startsWith("INFLATION") ||
        line.startsWith("REAL GROWTH") ||
        line.startsWith("WITHDRAWAL RATE") ||
        line.startsWith("(ANNUAL CHARGE) AMC") ||
        line.includes("TOTAL AMC CHARGES")) {
      dataSectionEnded = true; // ensure data section is marked as ended
      parameterLines.push(line);
      continue;
    }

    if (!dataSectionEnded && line.trim() !== "" && line.split(',')[0].trim() !== "") { // Ensure first cell (AGE) is not empty for data rows
      const values = line.split(',');
      dataCsvForAI.push(line); // Add data line to CSV for AI
      const row: any = {};
      headers.forEach((header, index) => {
        const rawValue = values[index] ? values[index].trim() : undefined;
        if (header === 'AGE') {
          row[header] = parseInt(rawValue || "0", 10);
        } else if (header === 'INCOME TAX PAID') {
          row[header] = rawValue?.toLowerCase() === 'no tax' ? 'NO TAX' : parseCurrency(rawValue);
        } else if (header.includes('PENSION') || header.includes('INCOME') || header.includes('SAVINGS') || header.includes('CHARGE') || header.includes('GROWTH') || header.includes('BALANCE') || header.includes('DRAWDOWN') || header.includes('TAXABLE INCOME')) {
          row[header] = parseCurrency(rawValue);
        } else {
          row[header] = rawValue;
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

  parameterLines.forEach(line => {
    const parts = line.split(',');
    if (parts[0] === "INITIAL DC PENSION VALUE") parameters.initialDcPensionValue = parseCurrency(parts[1]) || 0;
    if (parts[0] === "INVESTMENT PERCENTAGE GROWTH") parameters.investmentPercentageGrowth = parsePercentage(parts[2]) || 0;
    if (parts[0] === "INFLATION") parameters.inflationRate = parsePercentage(parts[2]) || 0;
    if (parts[0] === "WITHDRAWAL RATE") parameters.withdrawalRate = parsePercentage(parts[2]) || 0;
    if (parts[0] === "(ANNUAL CHARGE) AMC") parameters.annualChargeAMC = parsePercentage(parts[2]) || 0;
  });
  
  // Filter out empty headers for display
  const displayHeaders = headers.filter(h => h !== "");

  return { rows: dataRows, headers: displayHeaders, parameters, csvString: dataCsvForAI.join('\n') };
}

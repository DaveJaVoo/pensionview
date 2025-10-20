
"use client";
import type { FC } from 'react';
import type { PensionDataRow } from '@/lib/types'; 
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from '@/lib/utils';

interface PensionChartsProps {
  data: PensionDataRow[];
}

const chartColors = {
  sippBalance: "hsl(var(--chart-1))",
  totalIncome: "hsl(var(--chart-3))",
  netIncomePerYear: "hsl(var(--chart-4))", 
  dbPension: "hsl(var(--chart-5))",
  statePension: "hsl(var(--accent))", // Using accent from theme
  taxPaid: "hsl(var(--destructive))",
  totalSavingsBalance: "hsl(var(--primary))", // Using primary from theme
};

const CustomTooltip: FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const age = payload[0].payload.age;
    return (
      <div className="bg-background/80 backdrop-blur-sm p-3 border border-border rounded-lg shadow-lg">
        <p className="label font-semibold text-foreground">{`Age: ${age} (Year: ${label})`}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} style={{ color: entry.color }} className="text-sm">
            {`${entry.name}: ${formatCurrency(entry.value)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PensionCharts: FC<PensionChartsProps> = ({ data }) => {
  const chartData = data.map(row => ({
    year: row.Year, 
    age: row.Age,   
    sippBalance: row['SIPP Balance'],
    totalIncome: row['TOTAL INCOME'],
    netIncomePerYear: row['Net Income Per Year'],
    dbPension: row['DB Pension'] || 0,
    statePension: row['State Pension'] || 0,
    taxPaid: typeof row['Income Tax Paid'] === 'number' ? row['Income Tax Paid'] : 0,
    totalSavingsBalance: row['Total Savings Balance'] || 0,
  }));

  const yAxisTickFormatter = (value: number) => formatCurrency(value, false);
  const xAxisDataKey = "age"; 

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 md:p-6">
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Pension Pot Balances Over Time</CardTitle>
          <CardDescription>Tracks defined contribution pension balances.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisDataKey} stroke="hsl(var(--foreground))" tick={{ fontSize: 12 }} name="Age" />
              <YAxis stroke="hsl(var(--foreground))" tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--muted), 0.5)' }}/>
              <Legend />
              <Line type="monotone" dataKey="sippBalance" name="SIPP Balance" stroke={chartColors.sippBalance} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Total Savings Balance Over Time</CardTitle>
          <CardDescription>Tracks the total balance of Cash, ISA, and GIA savings.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisDataKey} stroke="hsl(var(--foreground))" tick={{ fontSize: 12 }} name="Age" />
              <YAxis stroke="hsl(var(--foreground))" tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--muted), 0.5)' }}/>
              <Legend />
              <Line type="monotone" dataKey="totalSavingsBalance" name="Total Savings Balance" stroke={chartColors.totalSavingsBalance} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Net Income & Total Income Over Time</CardTitle>
          <CardDescription>Compares total gross income vs. net income after tax.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisDataKey} stroke="hsl(var(--foreground))" tick={{ fontSize: 12 }} name="Age" />
              <YAxis stroke="hsl(var(--foreground))" tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--muted), 0.5)' }}/>
              <Legend />
              <Line type="monotone" dataKey="totalIncome" name="Total Gross Income" stroke={chartColors.totalIncome} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="netIncomePerYear" name="Net Income (After Tax)" stroke={chartColors.netIncomePerYear} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">DB & State Pension Income</CardTitle>
           <CardDescription>Tracks Defined Benefit and State Pension income streams.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisDataKey} stroke="hsl(var(--foreground))" tick={{ fontSize: 12 }} name="Age" />
              <YAxis stroke="hsl(var(--foreground))" tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--muted), 0.5)' }}/>
              <Legend />
              <Line type="monotone" dataKey="dbPension" name="DB Pension" stroke={chartColors.dbPension} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="statePension" name="State Pension" stroke={chartColors.statePension} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-xl md:col-span-2"> 
        <CardHeader>
          <CardTitle className="font-headline text-xl">Income Tax Paid Over Time</CardTitle>
          <CardDescription>Shows the amount of income tax paid each year.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.filter(d => d.taxPaid > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisDataKey} stroke="hsl(var(--foreground))" tick={{ fontSize: 12 }} name="Age" />
              <YAxis stroke="hsl(var(--foreground))" tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--muted), 0.5)' }}/>
              <Legend />
              <Bar dataKey="taxPaid" name="Income Tax Paid" fill={chartColors.taxPaid} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default PensionCharts;

    

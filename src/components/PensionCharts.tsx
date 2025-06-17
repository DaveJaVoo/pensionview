
"use client";
import type { FC } from 'react';
import type { PensionDataRow } from '@/lib/types';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, parseCurrency } from '@/lib/utils';

interface PensionChartsProps {
  data: PensionDataRow[];
}

const chartColors = {
  dcPensionBalance: "hsl(var(--chart-1))",
  totalIncome: "hsl(var(--chart-2))",
  myIncome: "hsl(var(--chart-3))",
  katesIncome: "hsl(var(--chart-4))",
  jointIncome: "hsl(var(--chart-5))",
  taxPaid: "hsl(var(--destructive))",
};

const CustomTooltip: FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/80 backdrop-blur-sm p-3 border border-border rounded-lg shadow-lg">
        <p className="label font-semibold text-foreground">{`Year: ${label}`}</p>
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
    year: row.YEAR,
    dcPensionBalance: row['DC PENSION BALANCE'],
    totalIncome: row['TOTAL INCOME'],
    myIncome: row['MY INCOME PER YEAR'],
    katesIncome: row["KATE'S INCOME PER YEAR"],
    jointIncome: row['JOINT INCOME PER YEAR'],
    taxPaid: row['INCOME TAX PAID'] === 'NO TAX' ? 0 : parseCurrency(row['INCOME TAX PAID']) || 0,
  }));

  const yAxisTickFormatter = (value: number) => formatCurrency(value, false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 md:p-6">
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">DC Pension Balance Over Time</CardTitle>
          <CardDescription>Tracks the defined contribution pension balance across years.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" stroke="hsl(var(--foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--foreground))" tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--muted), 0.5)' }}/>
              <Legend />
              <Line type="monotone" dataKey="dcPensionBalance" name="DC Pension Balance" stroke={chartColors.dcPensionBalance} strokeWidth={2} dot={{ r: 4, fill: chartColors.dcPensionBalance }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Income Streams Over Time</CardTitle>
          <CardDescription>Compares My, Kate's, and Joint income per year.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" stroke="hsl(var(--foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--foreground))" tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--muted), 0.5)' }}/>
              <Legend />
              <Line type="monotone" dataKey="myIncome" name="My Income" stroke={chartColors.myIncome} strokeWidth={2} dot={{ r: 4, fill: chartColors.myIncome }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="katesIncome" name="Kate's Income" stroke={chartColors.katesIncome} strokeWidth={2} dot={{ r: 4, fill: chartColors.katesIncome }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="jointIncome" name="Joint Income" stroke={chartColors.jointIncome} strokeWidth={2} dot={{ r: 4, fill: chartColors.jointIncome }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Total Income Over Time</CardTitle>
           <CardDescription>Tracks the total income across years.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" stroke="hsl(var(--foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--foreground))" tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--muted), 0.5)' }}/>
              <Legend />
              <Line type="monotone" dataKey="totalIncome" name="Total Income" stroke={chartColors.totalIncome} strokeWidth={2} dot={{ r: 4, fill: chartColors.totalIncome }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Income Tax Paid Over Time</CardTitle>
          <CardDescription>Shows the amount of income tax paid each year.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.filter(d => d.taxPaid > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" stroke="hsl(var(--foreground))" tick={{ fontSize: 12 }} />
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


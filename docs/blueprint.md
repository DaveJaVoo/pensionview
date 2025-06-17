# **App Name**: PensionView

## Core Features:

- Data Visualization: Display pension data in a tabular format.
- View Mode Toggle: Allow users to toggle between viewing the raw data table and various graphical summaries.
- Tax Implication Highlighting: Highlight years where income exceeds a threshold, indicating potential tax implications. A good UX will show the difference.
- Pension Insights: Generate insights based on the pension data to make decisions about the optimal drawdown strategy.
- Drawdown Optimization: Suggest adjustments to the UFPLS drawdown amounts. LLM acts as a 'tool' to estimate drawdown changes, accounting for goals to end with a zero balance.
- CSV Input: Input of static CSV data, as provided by the user.

## Style Guidelines:

- Primary color: Moderate cyan (#468FAF) to suggest both finance and forward thinking.
- Background color: Light cyan (#E0F4F7) to maintain a calm visual for financial data.
- Accent color: Darker cyan (#2E7796) for interactive elements.
- Body font: 'Inter', a sans-serif font providing a modern and neutral look, suitable for the numerical data and body text.
- Headline font: 'Space Grotesk', a sans-serif font providing a techy and scientific look.
- Use simple, clean icons for navigation and data representation.
- Display all monetary values with the same number of places after the decimal point, left-aligned in their columns, using a monospaced font. Other numeric data should also be left-aligned in its columns. String/text data should be left-aligned.
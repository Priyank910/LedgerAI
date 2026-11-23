export type CsvColumn = {
  date: string
  type: string
  title: string
  category: string
  payment: string
  amount: string
  note: string
}

export type CsvRow = {
  date: string
  type: string
  title: string
  category: string
  payment: string
  amount: string
  note: string
}

function textCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${guarded.replace(/"/g, '""')}"`
}

function numberCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** UTF-8 BOM so Excel on Windows keeps Gujarati and Hindi text. */
export function buildCsv(input: {
  labels: { shop: string; period: string; income: string; expense: string; net: string; balance: string }
  shopName: string
  periodLabel: string
  income: string
  expense: string
  net: string
  balance: string
  columns: CsvColumn
  rows: CsvRow[]
}): string {
  const lines = [
    [textCell(input.labels.shop), textCell(input.shopName)].join(','),
    [textCell(input.labels.period), textCell(input.periodLabel)].join(','),
    [textCell(input.labels.income), numberCell(input.income)].join(','),
    [textCell(input.labels.expense), numberCell(input.expense)].join(','),
    [textCell(input.labels.net), numberCell(input.net)].join(','),
    [textCell(input.labels.balance), numberCell(input.balance)].join(','),
    '',
    [input.columns.date, input.columns.type, input.columns.title, input.columns.category, input.columns.payment, input.columns.amount, input.columns.note]
      .map(textCell)
      .join(','),
    ...input.rows.map((row) =>
      [textCell(row.date), textCell(row.type), textCell(row.title), textCell(row.category), textCell(row.payment), numberCell(row.amount), textCell(row.note)].join(','),
    ),
  ]
  return `\uFEFF${lines.join('\n')}`
}

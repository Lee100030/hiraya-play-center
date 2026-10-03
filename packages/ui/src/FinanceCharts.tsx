import { formatPeso } from '@hiraya/utils';

export type FinanceBar = { label: string; income: number; expenses: number; net: number };
export type FinanceSlice = { label: string; amount: number };

function peso(amount: number) {
  return `₱${formatPeso(amount)}`;
}

export function FinanceColumnChart({ months }: { months: FinanceBar[] }) {
  const width = 640;
  const height = 260;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 16;
  const padBottom = 36;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const values = months.flatMap((row) => [row.income, row.expenses, row.net]);
  const max = Math.max(1, ...values, 0);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const yOf = (value: number) => padTop + ((max - value) / span) * innerH;
  const zero = yOf(0);
  const groupW = innerW / Math.max(1, months.length);
  const barW = Math.min(18, groupW * 0.28);
  const line = months
    .map((row, index) => {
      const x = padLeft + groupW * index + groupW / 2;
      return `${x},${yOf(row.net)}`;
    })
    .join(' ');

  return (
    <svg className="finance-column-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Income and expenses for six months">
      <line x1={padLeft} x2={width - padRight} y1={zero} y2={zero} stroke="#e7e1d6" />
      {months.map((row, index) => {
        const cx = padLeft + groupW * index + groupW / 2;
        const incomeH = Math.abs(yOf(row.income) - zero);
        const expenseH = Math.abs(yOf(row.expenses) - zero);
        return (
          <g key={row.label}>
            <rect x={cx - barW - 2} y={Math.min(yOf(row.income), zero)} width={barW} height={Math.max(incomeH, row.income ? 1 : 0)} fill="#1f6b3a" rx="2">
              <title>{`${row.label} income ${peso(row.income)}`}</title>
            </rect>
            <rect x={cx + 2} y={Math.min(yOf(row.expenses), zero)} width={barW} height={Math.max(expenseH, row.expenses ? 1 : 0)} fill="#a33b32" rx="2">
              <title>{`${row.label} expenses ${peso(row.expenses)}`}</title>
            </rect>
            <text x={cx} y={height - 12} textAnchor="middle" fontSize="12" fill="#5c564c">
              {row.label.replace(/\s+\d{4}$/, '')}
            </text>
          </g>
        );
      })}
      <polyline fill="none" stroke="#c9a227" strokeWidth="2.5" points={line} />
      {months.map((row, index) => {
        const x = padLeft + groupW * index + groupW / 2;
        return <circle key={`${row.label}-net`} cx={x} cy={yOf(row.net)} r="3.5" fill="#c9a227"><title>{`${row.label} net ${peso(row.net)}`}</title></circle>;
      })}
    </svg>
  );
}

export function FinanceCategoryChart({ rows }: { rows: FinanceSlice[] }) {
  const max = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <ul className="finance-category-chart">
      {rows.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          <div>
            <i style={{ width: `${Math.max((row.amount / max) * 100, row.amount ? 2 : 0)}%` }} />
          </div>
          <em>{peso(row.amount)}</em>
        </li>
      ))}
    </ul>
  );
}

export function FinanceLegend() {
  return (
    <p className="finance-legend">
      <span><i className="finance-swatch income" /> Income</span>
      <span><i className="finance-swatch expense" /> Expenses</span>
      <span><i className="finance-swatch net" /> Net</span>
    </p>
  );
}

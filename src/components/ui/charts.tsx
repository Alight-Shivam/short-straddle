import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Area,
  AreaChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORICAL, CHART_AXIS, CHART_GRID, CHART_TOOLTIP_BG, CHART_TOOLTIP_BORDER, CRITICAL, GOOD } from '../../utils/colors';

const tooltipStyle = {
  background: CHART_TOOLTIP_BG,
  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
  borderRadius: 8,
  fontSize: 12,
  color: '#f1f5f9',
};

const axisProps = { stroke: CHART_AXIS, fontSize: 11, tickLine: false, axisLine: { stroke: CHART_GRID } };

export interface SeriesDef {
  dataKey: string;
  name: string;
  color?: string;
}

/** Bars colored green/red by sign of their own value — for single-series P/L bars. */
export function PnlBarChart({ data, xKey, dataKey, height = 260 }: { data: Record<string, unknown>[]; xKey: string; dataKey: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" />
        <YAxis {...axisProps} width={64} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Bar dataKey={dataKey} radius={[4, 4, 4, 4]}>
          {data.map((d, i) => (
            <Cell key={i} fill={(d[dataKey] as number) >= 0 ? GOOD : CRITICAL} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Multi-series categorical bar chart (fixed hue order, never cycled). */
export function MultiBarChart({ data, xKey, series, height = 260 }: { data: Record<string, unknown>[]; xKey: string; series: SeriesDef[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={56} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />}
        {series.map((s, i) => (
          <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={s.color ?? CATEGORICAL[i % CATEGORICAL.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EquityAreaChart({ data, xKey, dataKey, height = 300 }: { data: Record<string, unknown>[]; xKey: string; dataKey: string; height?: number }) {
  const last = data.length ? (data[data.length - 1][dataKey] as number) : 0;
  const color = last >= 0 ? GOOD : CRITICAL;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} minTickGap={32} />
        <YAxis {...axisProps} width={64} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill="url(#equityFill)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DrawdownAreaChart({ data, xKey, dataKey, height = 220 }: { data: Record<string, unknown>[]; xKey: string; dataKey: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CRITICAL} stopOpacity={0.4} />
            <stop offset="95%" stopColor={CRITICAL} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} minTickGap={32} />
        <YAxis {...axisProps} width={64} reversed />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey={dataKey} stroke={CRITICAL} strokeWidth={2} fill="url(#ddFill)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleLineChart({ data, xKey, series, height = 260 }: { data: Record<string, unknown>[]; xKey: string; series: SeriesDef[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} minTickGap={24} />
        <YAxis {...axisProps} width={56} />
        <Tooltip contentStyle={tooltipStyle} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />}
        {series.map((s, i) => (
          <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} stroke={s.color ?? CATEGORICAL[i % CATEGORICAL.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WinLossPie({ wins, losses, scratches = 0, height = 220 }: { wins: number; losses: number; scratches?: number; height?: number }) {
  const data = [
    { name: 'Wins', value: wins, color: GOOD },
    { name: 'Losses', value: losses, color: CRITICAL },
    ...(scratches > 0 ? [{ name: 'Scratch', value: scratches, color: CHART_AXIS }] : []),
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} stroke="none" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

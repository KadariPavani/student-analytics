import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

export function BarChartCard({ title, data, dataKey, xKey, fill = '#6366f1', height = 300, subtitle }) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 220 : height;

  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        {subtitle && <span className="card-subtitle">{subtitle}</span>}
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: isMobile ? -10 : 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: isMobile ? 10 : 12 }} interval={0} angle={isMobile ? -30 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 50 : 30} />
          <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 35 : 40} />
          <Tooltip contentStyle={{ fontSize: '0.82rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
          <Bar dataKey={dataKey} fill={fill} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MultiBarChartCard({ title, data, bars, xKey, height = 300, subtitle }) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 240 : height;

  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        {subtitle && <span className="card-subtitle">{subtitle}</span>}
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: isMobile ? -10 : 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: isMobile ? 10 : 12 }} interval={0} angle={isMobile ? -30 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 50 : 30} />
          <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 35 : 40} />
          <Tooltip contentStyle={{ fontSize: '0.82rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
          <Legend wrapperStyle={{ fontSize: isMobile ? '0.72rem' : '0.82rem' }} />
          {bars.map((bar, i) => (
            <Bar key={bar.dataKey} dataKey={bar.dataKey} name={bar.name} fill={bar.fill || COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PieChartCard({ title, data, dataKey, nameKey, height = 300, subtitle }) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 260 : height;

  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        {subtitle && <span className="card-subtitle">{subtitle}</span>}
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={isMobile ? 45 : 60}
            outerRadius={isMobile ? 75 : 100}
            dataKey={dataKey}
            nameKey={nameKey}
            label={isMobile
              ? ({ percent }) => `${(percent * 100).toFixed(0)}%`
              : ({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`
            }
            labelLine={!isMobile}
          >
            {data && data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: '0.82rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
          <Legend wrapperStyle={{ fontSize: isMobile ? '0.72rem' : '0.82rem' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChartCard({ title, data, lines, xKey, height = 300, subtitle }) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 220 : height;

  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        {subtitle && <span className="card-subtitle">{subtitle}</span>}
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: isMobile ? -10 : 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: isMobile ? 10 : 12 }} />
          <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 35 : 40} />
          <Tooltip contentStyle={{ fontSize: '0.82rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
          <Legend wrapperStyle={{ fontSize: isMobile ? '0.72rem' : '0.82rem' }} />
          {lines.map((line, i) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.stroke || COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: isMobile ? 3 : 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

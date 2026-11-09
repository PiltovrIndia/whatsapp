"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const BAR_COLOR = "#1f8a4c";

function label(day) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-[#e6e6e6] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-[#737373]">{label(point.day)}</p>
      <p className="mt-0.5 font-semibold text-[#1a1a1a]">{point.messages.toLocaleString()} messages</p>
    </div>
  );
}

export function MessagesChart({ series }) {
  const empty = series.every((point) => point.messages === 0);
  return (
    <div>
      <div className="h-56" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -16 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="#efefef" strokeWidth={1} />
            <XAxis dataKey="day" tickFormatter={label} tickLine={false} axisLine={{ stroke: "#e6e6e6" }} tick={{ fontSize: 11, fill: "#888" }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#888" }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f4f4f4" }} />
            <Bar dataKey="messages" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {empty ? <p className="mt-2 text-center text-xs text-[#888]">No messages sent in the last 14 days.</p> : null}
      <table className="sr-only">
        <caption>Messages sent per day, last 14 days</caption>
        <thead><tr><th>Day</th><th>Messages</th></tr></thead>
        <tbody>{series.map((point) => <tr key={point.day}><td>{point.day}</td><td>{point.messages}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

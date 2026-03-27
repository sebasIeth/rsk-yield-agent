"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  time: string;
  sovryn: number;
  tropykus: number;
  moneyonchain: number;
}

type TimeRange = "1H" | "24H" | "7D" | "30D";

const TIME_RANGES: TimeRange[] = ["1H", "24H", "7D", "30D"];

const PROTOCOL_COLORS = {
  sovryn: { stroke: "#F97316", name: "Sovryn" },
  tropykus: { stroke: "#22C55E", name: "Tropykus" },
  moneyonchain: { stroke: "#EAB308", name: "MoneyOnChain" },
};

function generateData(range: TimeRange): DataPoint[] {
  const data: DataPoint[] = [];
  const now = Date.now();

  const configs: Record<TimeRange, { points: number; interval: number; format: Intl.DateTimeFormatOptions }> = {
    "1H": { points: 12, interval: 300000, format: { hour: "2-digit", minute: "2-digit" } },
    "24H": { points: 24, interval: 3600000, format: { hour: "2-digit", minute: "2-digit" } },
    "7D": { points: 28, interval: 21600000, format: { month: "short", day: "numeric" } },
    "30D": { points: 30, interval: 86400000, format: { month: "short", day: "numeric" } },
  };

  const cfg = configs[range];
  for (let i = cfg.points; i >= 0; i--) {
    const time = new Date(now - i * cfg.interval);
    data.push({
      time: time.toLocaleString("en-US", cfg.format),
      sovryn: 4.2 + (Math.random() - 0.5) * 0.8,
      tropykus: 3.8 + (Math.random() - 0.5) * 0.6,
      moneyonchain: 6.2 + (Math.random() - 0.5) * 1.2,
    });
  }

  return data;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-lg">
      <p className="text-xs text-zinc-500 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-zinc-400 text-xs">{entry.name}</span>
          </div>
          <span className="font-mono font-semibold text-zinc-50 text-xs">{entry.value.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

export function APYChart() {
  const [range, setRange] = useState<TimeRange>("24H");
  const [data, setData] = useState<DataPoint[]>([]);
  const [visible, setVisible] = useState<Record<string, boolean>>({
    sovryn: true,
    tropykus: true,
    moneyonchain: true,
  });

  const updateData = useCallback(() => {
    setData(generateData(range));
  }, [range]);

  useEffect(() => {
    updateData();
  }, [updateData]);

  const toggleProtocol = (key: string) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (data.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-50">APY History</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Track yield performance across protocols</p>
        </div>
        {/* Time range selector */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-800">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-medium transition-colors duration-150 ${
                range === r
                  ? "bg-zinc-700 text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {Object.entries(PROTOCOL_COLORS).map(([key, config]) => (
          <button
            key={key}
            onClick={() => toggleProtocol(key)}
            className={`flex items-center gap-1.5 text-xs transition-colors duration-150 ${
              visible[key] ? "opacity-100" : "opacity-30"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: config.stroke }}
            />
            <span className="text-zinc-400">{config.name}</span>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[220px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#3F3F46"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="#3F3F46"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
              dx={-8}
            />
            <Tooltip content={<CustomTooltip />} />
            {visible.sovryn && (
              <Line type="monotone" dataKey="sovryn" name="Sovryn" stroke="#F97316" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#F97316", stroke: "#09090B", strokeWidth: 2 }} />
            )}
            {visible.tropykus && (
              <Line type="monotone" dataKey="tropykus" name="Tropykus" stroke="#22C55E" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#22C55E", stroke: "#09090B", strokeWidth: 2 }} />
            )}
            {visible.moneyonchain && (
              <Line type="monotone" dataKey="moneyonchain" name="MoneyOnChain" stroke="#EAB308" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#EAB308", stroke: "#09090B", strokeWidth: 2 }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

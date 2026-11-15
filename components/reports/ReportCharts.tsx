"use client";

// Chart.js charts for the Reports page (FR-15). Each chart has ONE series, so the title
// names it (no legend needed); hovering a bar shows its exact value.
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const INK_MUTED = "#5e6b6b";
const GRID = "#e3eeec";
const TEAL = "#0f5257";
const CORAL = "#d9532c";
// Expiry urgency is an ordered scale → one hue, darkest = most urgent; "safe" is neutral gray.
const BAND_COLORS = ["#8f2a10", "#d9532c", "#f0a08a", "#a9b6b4"];

const rupees = (v: number) => "Rs " + Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 });

function options(horizontal: boolean, money: boolean): ChartOptions<"bar"> {
  const valueAxis = {
    beginAtZero: true,
    grid: { color: GRID },
    border: { display: false },
    ticks: { color: INK_MUTED, callback: (v: string | number) => (money ? rupees(Number(v)) : v) },
  };
  const categoryAxis = { grid: { display: false }, border: { color: GRID }, ticks: { color: INK_MUTED } };
  return {
    indexAxis: horizontal ? "y" : "x",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1e2b2b",
        padding: 10,
        callbacks: { label: (ctx) => " " + (money ? rupees(Number(ctx.raw)) : `${ctx.raw} units`) },
      },
    },
    scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
  };
}

const barStyle = { borderRadius: 4, borderSkipped: "start" as const, maxBarThickness: 28 };

export function TopSellersChart({ labels, units }: { labels: string[]; units: number[] }) {
  return (
    <div className="h-64">
      <Bar data={{ labels, datasets: [{ label: "Units sold", data: units, backgroundColor: TEAL, ...barStyle }] }} options={options(true, false)} />
    </div>
  );
}

export function LossTrendChart({ labels, values }: { labels: string[]; values: number[] }) {
  return (
    <div className="h-64">
      <Bar data={{ labels, datasets: [{ label: "Expired-stock loss", data: values, backgroundColor: CORAL, ...barStyle }] }} options={options(false, true)} />
    </div>
  );
}

export function StockValueChart({ values }: { values: [number, number, number, number] }) {
  return (
    <div className="h-64">
      <Bar
        data={{
          labels: ["Expires ≤ 30 days", "31–60 days", "61–90 days", "Safe (> 90 days)"],
          datasets: [{ label: "Stock value", data: values, backgroundColor: BAND_COLORS, ...barStyle }],
        }}
        options={options(true, true)}
      />
    </div>
  );
}

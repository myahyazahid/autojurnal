export const PALET = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#f43f5e", "#84cc16", "#3b82f6", "#8b5cf6", "#14b8a6"];

export default function Donat({ data, tengah, sub, ukuran = 168 }: { data: { label: string; nilai: number }[]; tengah: string | number; sub: string; ukuran?: number }) {
  const total = data.reduce((a, d) => a + d.nilai, 0) || 1;
  const r = 42;
  const keliling = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: ukuran, height: ukuran }}>
      <svg viewBox="0 0 100 100" className="-rotate-90" style={{ width: ukuran, height: ukuran }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--c-panel-3)" strokeWidth="11" />
        {data.map((d, i) => {
          const panjang = (d.nilai / total) * keliling;
          const el = (
            <circle
              key={d.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={PALET[i % PALET.length]}
              strokeWidth="11"
              strokeDasharray={`${Math.max(panjang - 1.2, 0.6)} ${keliling}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              className="transition-all duration-700"
            >
              <title>{`${d.label}: ${d.nilai}`}</title>
            </circle>
          );
          offset += panjang;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-extrabold tracking-tight tabular-nums">{tengah}</div>
        <div className="text-[11px] font-medium text-ink-3">{sub}</div>
      </div>
    </div>
  );
}

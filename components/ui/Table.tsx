// Simple table pieces so every list page looks the same.

export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-teal-line">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-teal-soft text-xs uppercase tracking-wide text-teal-brand">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-teal-line bg-white">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

/** Search box shown above tables. */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={50}
      className="w-full rounded-lg border border-teal-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/30 sm:w-72"
    />
  );
}

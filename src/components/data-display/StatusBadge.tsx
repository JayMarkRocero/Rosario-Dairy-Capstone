import { C } from "@/styles/tokens/colors";

const statusMap: Record<string, { bg: string; color: string }> = {
  Completed:  { bg: "#E8F5E9", color: C.green  },
  Pending:    { bg: "#FFF3E0", color: C.orange },
  Processing: { bg: "#EBF3FF", color: C.blue   },
  Ready:      { bg: "#E3F2FD", color: "#1565C0" },
  Cancelled:  { bg: "#FFEBEE", color: C.red    },
  Active:     { bg: "#E8F5E9", color: C.green  },
  Inactive:   { bg: "#F5F5F5", color: C.muted  },
  Low:        { bg: "#FFF3E0", color: C.orange },
  Expired:      { bg: "#FFEBEE", color: C.red     },
  "Near Expiry": { bg: "#FFFDE7", color: "#F59E0B" },
  Critical:   { bg: "#FFEBEE", color: C.red    },
  High:       { bg: "#FFF3E0", color: C.orange },
  Medium:     { bg: "#FFFDE7", color: "#b8b80e" },
};

interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  const s = statusMap[status] ?? { bg: "#F5F5F5", color: C.muted };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

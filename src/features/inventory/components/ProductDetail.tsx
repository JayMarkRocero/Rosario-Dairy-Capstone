import { AlertTriangle } from "lucide-react";
import { CategoryIcon } from "@/components/data-display/CategoryIcon";
import { C } from "@/styles/tokens/colors";
import type { InventoryItem } from "@/features/inventory/types/inventory";
import { getInventoryWarnings } from "@/features/inventory/utils/warnings";
import { InventoryStatusBadge } from "./InventoryWarnings";

export function ProductDetail({ p }: { p: InventoryItem }) {
  const status = getInventoryWarnings(p).status;
  const statusLabel =
    status === "Expired" ? "Expired" :
    status === "Low" ? "Low Stock" :
    status === "Low Stock & Near Expiry" ? status :
    status === "Near Expiry" ? "Near Expiry" : "Adequate";
  const accentColor = status === "Expired" ? C.red : status !== "Active" ? C.orange : C.blue;
  const rows = [
    { label:"Product ID",    value:`PRD-${String(p.id).padStart(3,"0")}` },
    { label:"Name",          value: p.name     },
    { label:"Category",      value: p.cat      },
    { label:"Stock Qty",     value: p.stock    },
    { label:"Expiry Date",   value: p.expiry   },
    { label:"FEFO Status",   value: statusLabel },
  ];
  return (
    <div className="space-y-5 sm:p-6">
      <div
        className="rounded-2xl p-4 text-center"
        style={{ backgroundColor: accentColor + "08", border:`1px solid ${accentColor}20` }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ backgroundColor: accentColor + "12" }}
        >
          <CategoryIcon name={p.cat} size={30} color={accentColor} />
        </div>
        <div className="font-bold text-base" style={{ color:C.text }}>{p.name}</div>
        <div className="mt-1"><InventoryStatusBadge product={p}/></div>
      </div>
      <div className="space-y-2 sm:space-y-5 sm:p-6">
        {rows.map(r => (
          <div key={r.label} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between sm:gap-3" style={{borderBottom:`1px solid ${C.border}`}}>
            <span className="text-sm" style={{color:C.muted}}>{r.label}</span>
            <span className="min-w-0 break-words text-sm font-semibold sm:text-right" style={{color:C.text}}>{r.value}</span>
          </div>
        ))}
      </div>
      {status === "Expired" && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-xs"
          style={{backgroundColor:C.red+"15",color:C.red,border:`1px solid ${C.red}30`}}>
          <AlertTriangle size={14}/>
          <span>This product has expired and should be removed from active stock.</span>
        </div>
      )}
      {getInventoryWarnings(p).lowStock && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-xs"
          style={{backgroundColor:C.orange+"15",color:C.orange,border:`1px solid ${C.orange}30`}}>
          <AlertTriangle size={14}/>
          <span>This product is at or below the global stock threshold.</span>
        </div>
      )}
      {getInventoryWarnings(p).nearExpiry && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-xs"
          style={{backgroundColor:"#F59E0B"+"15",color:"#F59E0B",border:`1px solid #F59E0B30`}}>
          <AlertTriangle size={14}/>
          <span>{getInventoryWarnings(p).expiryMessage} Prioritize it for sale (FEFO).</span>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Settings, Building, Bell, Package, User, Shield } from "lucide-react";
import { toast } from "sonner";
import { Modal, Btn } from "../../components";
import { C } from "../../constants/colors";

type Tab = "general"|"business"|"notifications"|"fefo"|"account"|"security";

const TABS: { id:Tab; label:string; icon:React.ReactNode }[] = [
  { id:"general",       label:"General",        icon:<Settings size={15}/> },
  { id:"business",      label:"Business Info",  icon:<Building size={15}/> },
  { id:"notifications", label:"Notifications",  icon:<Bell size={15}/>     },
  { id:"fefo",          label:"FEFO Settings",  icon:<Package size={15}/>  },
  { id:"account",       label:"Account",        icon:<User size={15}/>     },
  { id:"security",      label:"Security",       icon:<Shield size={15}/>   },
];

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400";
const inputStyle = { borderColor:C.border, color:C.text, backgroundColor:"#F8FAFC" };

function Field({ label, children, span=false }:{ label:string; children:React.ReactNode; span?:boolean }) {
  return (
    <div className={span?"col-span-2":""}>
      <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, desc, value, onChange }:{ label:string; desc:string; value:boolean; onChange:(v:boolean)=>void }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl" style={{border:`1px solid ${C.border}`}}>
      <div>
        <div className="text-sm font-medium" style={{color:C.text}}>{label}</div>
        <div className="text-xs mt-0.5" style={{color:C.muted}}>{desc}</div>
      </div>
      <button onClick={()=>onChange(!value)}
        className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0"
        style={{backgroundColor:value?C.green:C.border}}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
          style={{left:value?"calc(100% - 22px)":"2px"}}/>
      </button>
    </div>
  );
}

function GeneralTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="System Name" span>
          <input className={inputClass} style={inputStyle} defaultValue="Rosario Dairy Management System"/>
        </Field>
        <Field label="Currency">
          <select className={inputClass} style={inputStyle}><option>PHP (₱)</option><option>USD ($)</option></select>
        </Field>
        <Field label="Date Format">
          <select className={inputClass} style={inputStyle}><option>MM/DD/YYYY</option><option>DD/MM/YYYY</option></select>
        </Field>
        <Field label="Time Zone">
          <select className={inputClass} style={inputStyle}><option>Asia/Manila (GMT+8)</option></select>
        </Field>
        <Field label="Language">
          <select className={inputClass} style={inputStyle}><option>English (Philippines)</option></select>
        </Field>
        <Field label="Tax Rate (%)">
          <input className={inputClass} style={inputStyle} type="number" defaultValue="12"/>
        </Field>
      </div>
    </div>
  );
}

function BusinessTab() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Business Name" span>
        <input className={inputClass} style={inputStyle} defaultValue="Rosario Dairy"/>
      </Field>
      <Field label="Address" span>
        <input className={inputClass} style={inputStyle} defaultValue="123 Dairy Road, Quezon City"/>
      </Field>
      <Field label="Contact Number">
        <input className={inputClass} style={inputStyle} defaultValue="(02) 8123-4567"/>
      </Field>
      <Field label="Email">
        <input className={inputClass} style={inputStyle} defaultValue="contact@rosariodairy.com"/>
      </Field>
      <Field label="TIN">
        <input className={inputClass} style={inputStyle} defaultValue="123-456-789"/>
      </Field>
      <Field label="Business Type">
        <select className={inputClass} style={inputStyle}><option>Dairy Business</option></select>
      </Field>
    </div>
  );
}

function NotificationsTab() {
  const [toggles,setToggles] = useState({lowStock:true,nearExpiry:true,newOrders:true,forecast:true,reports:false});
  return (
    <div className="space-y-3">
      <Toggle label="Low Stock Alerts" desc="Notify when stock falls below threshold"
        value={toggles.lowStock} onChange={v=>setToggles(t=>({...t,lowStock:v}))}/>
      <Toggle label="Near Expiry Alerts" desc="Notify when products approach expiry date"
        value={toggles.nearExpiry} onChange={v=>setToggles(t=>({...t,nearExpiry:v}))}/>
      <Toggle label="New Order Alerts" desc="Notify when new orders are placed"
        value={toggles.newOrders} onChange={v=>setToggles(t=>({...t,newOrders:v}))}/>
      <Toggle label="Forecast Warnings" desc="Notify about ML forecast anomalies"
        value={toggles.forecast} onChange={v=>setToggles(t=>({...t,forecast:v}))}/>
      <Toggle label="Report Ready Notifications" desc="Notify when scheduled reports are generated"
        value={toggles.reports} onChange={v=>setToggles(t=>({...t,reports:v}))}/>
    </div>
  );
}

function FEFOTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Low Stock Threshold (units)">
          <input className={inputClass} style={inputStyle} type="number" defaultValue="20"/>
        </Field>
        <Field label="Near Expiry Alert (days)">
          <input className={inputClass} style={inputStyle} type="number" defaultValue="7"/>
        </Field>
        <Field label="Critical Expiry (days)">
          <input className={inputClass} style={inputStyle} type="number" defaultValue="3"/>
        </Field>
        <Field label="Auto-archive Expired After (days)">
          <input className={inputClass} style={inputStyle} type="number" defaultValue="0"/>
        </Field>
      </div>
      <div className="p-4 rounded-xl" style={{backgroundColor:C.blue+"08",border:`1px solid ${C.blue}20`}}>
        <p className="text-xs leading-relaxed" style={{color:C.blue}}>
          <strong>FEFO (First Expired, First Out)</strong> ensures that products closest to expiry are sold first,
          minimizing waste and maintaining product quality standards.
        </p>
      </div>
    </div>
  );
}

function AccountTab() {
  return (
    <div className="space-y-4">
      <Field label="Full Name">
        <input className={inputClass} style={inputStyle} defaultValue="Admin Rosario"/>
      </Field>
      <Field label="Email Address">
        <input className={inputClass} style={inputStyle} defaultValue="admin@rosariodairy.com"/>
      </Field>
      <Field label="Profile Photo">
        <div className="flex items-center gap-3 mt-1">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
            style={{backgroundColor:C.navy}}>A</div>
          <Btn variant="secondary" size="sm">Change Photo</Btn>
        </div>
      </Field>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-4">
      <Field label="Current Password">
        <input className={inputClass} style={inputStyle} type="password" placeholder="Enter current password"/>
      </Field>
      <Field label="New Password">
        <input className={inputClass} style={inputStyle} type="password" placeholder="Min. 8 characters"/>
      </Field>
      <Field label="Confirm New Password">
        <input className={inputClass} style={inputStyle} type="password" placeholder="Repeat new password"/>
      </Field>
      <div className="p-3 rounded-xl text-xs" style={{backgroundColor:C.orange+"12",color:C.orange}}>
        Password must be at least 8 characters and include uppercase, lowercase, and a number.
      </div>
    </div>
  );
}

const TAB_CONTENT: Record<Tab, React.ReactNode> = {
  general:       <GeneralTab/>,
  business:      <BusinessTab/>,
  notifications: <NotificationsTab/>,
  fefo:          <FEFOTab/>,
  account:       <AccountTab/>,
  security:      <SecurityTab/>,
};

// ─── Inline (non-modal) settings page ─────────────────────────────────────────
export function AdminSettings() {
  const [tab,     setTab]     = useState<Tab>("general");
  const [loading, setLoading] = useState(false);

  const save = () => {
    setLoading(true);
    setTimeout(()=>{ setLoading(false); toast.success("Settings saved successfully!"); }, 700);
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold" style={{color:C.muted}}>System configuration and preferences</h2>
      </div>

      <div className="flex gap-6" style={{minHeight:520}}>
        {/* Sidebar tabs */}
        <div className="w-48 flex-shrink-0">
          <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${C.border}`}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-left transition-colors"
                style={{
                  color:         tab===t.id?"#fff":C.muted,
                  backgroundColor:tab===t.id?C.navy:"transparent",
                  borderLeft:    tab===t.id?`3px solid ${C.blue}`:"3px solid transparent",
                }}>
                <span style={{opacity:0.8}}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl p-6" style={{border:`1px solid ${C.border}`}}>
            <h3 className="font-bold text-base mb-5" style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>
              {TABS.find(t=>t.id===tab)?.label}
            </h3>
            {TAB_CONTENT[tab]}
            <div className="flex justify-end mt-6 pt-4" style={{borderTop:`1px solid ${C.border}`}}>
              <Btn variant="primary" onClick={save} disabled={loading}>
                {loading ? "Saving…" : "Save Changes"}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Plus, Eye, Edit, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Card, StatusBadge, Btn, Modal, Drawer, ConfirmDialog, EnhancedTable } from "../../components";
import type { Column } from "../../components";
import { C } from "../../constants/colors";
import { systemUsers } from "../../constants/dummyData";
import type { SystemUser } from "../../types/user";

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400";
const inputStyle = { borderColor:C.border, color:C.text, backgroundColor:"#F8FAFC" };

const SUMMARY = [
  { label:"Total Users",    value:"5", color:C.navy  },
  { label:"Administrators", value:"2", color:C.blue  },
  { label:"Staff",          value:"3", color:C.green },
  { label:"Inactive",       value:"1", color:C.muted },
];

const ROLES = ["Administrator", "Staff"];

export function AdminUserManagement() {
  const [roleFilter,  setRoleFilter]  = useState("All");
  const [viewOpen,    setViewOpen]    = useState(false);
  const [addOpen,     setAddOpen]     = useState(false);
  const [editOpen,    setEditOpen]    = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [resetOpen,   setResetOpen]   = useState(false);
  const [selected,    setSelected]    = useState<SystemUser | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [role,        setRole]        = useState<"Administrator"|"Staff">("Staff");

  const filteredUsers = useMemo(() => {
    if (roleFilter === "All") return systemUsers;
    return systemUsers.filter(u => u.role === roleFilter);
  }, [roleFilter]);

  const openView = (u:SystemUser) => { setSelected(u); setViewOpen(true); };
  const run = (action:string, close:()=>void) => {
    setLoading(true);
    setTimeout(()=>{ setLoading(false); close(); toast.success(`${action} completed.`); }, 700);
  };

  const columns: Column<SystemUser>[] = [
    { key:"name", header:"User", width:"28%", sortKey:r=>r.name,
      render:r=>(
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold"
            style={{backgroundColor:r.role==="Administrator"?C.navy:C.blue}}>
            {r.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
          </div>
          <div>
            <div className="font-semibold text-sm" style={{color:C.text}}>{r.name}</div>
            <div className="text-xs" style={{color:C.muted}}>{r.email}</div>
          </div>
        </div>
      )},
    { key:"role", header:"Role", align:"center", width:"18%", sortKey:r=>r.role,
      render:r=>(
        <div className="flex justify-center">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{backgroundColor:r.role==="Administrator"?C.navy+"15":C.blue+"15",
              color:r.role==="Administrator"?C.navy:C.blue}}>
            {r.role}
          </span>
        </div>
      )},
    { key:"status", header:"Status", align:"center", width:"16%",
      render:r=><div className="flex justify-center"><StatusBadge status={r.status}/></div> },
    { key:"last", header:"Last Login", align:"center", width:"18%", sortKey:r=>r.last,
      render:r=><span className="text-xs" style={{color:C.muted}}>{r.last}</span> },
    { key:"actions", header:"Actions", align:"center", width:"20%",
      render:r=>(
        <div className="flex gap-1 justify-center" onClick={e=>e.stopPropagation()}>
          <button onClick={()=>openView(r)} className="p-1.5 rounded-lg hover:bg-blue-50" style={{color:C.blue}}><Eye size={13}/></button>
          <button onClick={()=>{setSelected(r);setEditOpen(true);}} className="p-1.5 rounded-lg hover:bg-gray-100" style={{color:C.muted}}><Edit size={13}/></button>
          <button onClick={()=>{setSelected(r);setResetOpen(true);}} className="p-1.5 rounded-lg hover:bg-yellow-50" style={{color:C.orange}}><Lock size={13}/></button>
          <button onClick={()=>{setSelected(r);setDeleteOpen(true);}} className="p-1.5 rounded-lg hover:bg-red-50" style={{color:C.red}}><Trash2 size={13}/></button>
        </div>
      )},
  ];

  const UserForm = ({ title }:{title:string}) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {[["Full Name","Juan dela Cruz"],["Email","juan@rosariodairy.com"]].map(([l,p])=>(
          <div key={l} className="col-span-2">
            <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>{l}</label>
            <input className={inputClass} style={inputStyle} placeholder={p}/>
          </div>
        ))}
      </div>
      <div>
        <label className="text-xs font-semibold block mb-2" style={{color:C.muted}}>Role</label>
        <div className="flex gap-2">
          {(["Staff","Administrator"] as const).map(r=>(
            <button key={r} onClick={()=>setRole(r)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{backgroundColor:role===r?C.navy:C.bg,color:role===r?"#fff":C.muted,
                border:`1.5px solid ${role===r?C.navy:C.border}`}}>
              {r}
            </button>
          ))}
        </div>
      </div>
      {title==="Add User"&&(
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Temporary Password</label>
          <input className={inputClass} style={inputStyle} type="password" placeholder="Min. 8 characters"/>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-full gap-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <h2 className="text-base sm:text-lg font-bold leading-snug" style={{color:C.muted}}>
          Manage administrator and staff accounts
        </h2>
        <Btn variant="primary" size="sm" icon={<Plus size={13}/>} onClick={()=>setAddOpen(true)}>
          Add User
        </Btn>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 flex-shrink-0">
        {SUMMARY.map(s=>(
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className="w-2 h-10 rounded-full flex-shrink-0" style={{backgroundColor:s.color}}/>
            <div className="min-w-0">
              <div className="font-bold text-2xl" style={{color:s.color,fontFamily:"Poppins,sans-serif"}}>{s.value}</div>
              <div className="text-xs truncate" style={{color:C.muted}}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <EnhancedTable
          columns={columns}
          data={filteredUsers}
          rowKey={r=>r.id}
          pageSize={4}
          searchable
          searchKeys={r=>[r.name,r.email,r.role]}
          searchPlaceholder="Search users…"
          onRowClick={openView}
          showExport={false}
          extraControls={
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none border"
              style={{ borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" }}
            >
              <option value="All">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          }
        />
      </Card>

      {/* View Drawer */}
      <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="User Profile" subtitle={selected?.role} size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setViewOpen(false)}>Close</Btn>
          <Btn variant="primary" onClick={()=>{setViewOpen(false);setEditOpen(true);}}>Edit User</Btn></>}>
        {selected&&(
          <div className="space-y-5">
            <div className="text-center p-6">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3"
                style={{backgroundColor:selected.role==="Administrator"?C.navy:C.blue}}>
                {selected.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
              </div>
              <h3 className="font-bold text-lg" style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>{selected.name}</h3>
              <p className="text-sm" style={{color:C.muted}}>{selected.role}</p>
              <div className="mt-2"><StatusBadge status={selected.status}/></div>
            </div>
            {[{l:"Email",v:selected.email},{l:"Last Login",v:selected.last}].map(r=>(
              <div key={r.l} className="flex justify-between py-2" style={{borderBottom:`1px solid ${C.border}`}}>
                <span className="text-sm" style={{color:C.muted}}>{r.l}</span>
                <span className="text-sm font-semibold" style={{color:C.text}}>{r.v}</span>
              </div>
            ))}
            <Btn variant="secondary" size="sm" icon={<Lock size={12}/>} onClick={()=>{setViewOpen(false);setResetOpen(true);}}>
              Reset Password
            </Btn>
          </div>
        )}
      </Drawer>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Add User" size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>run("User added",()=>setAddOpen(false))} disabled={loading}>{loading?"Saving…":"Add User"}</Btn></>}>
        <UserForm title="Add User"/>
      </Modal>

      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title="Edit User" subtitle={selected?.name} size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>run("User updated",()=>setEditOpen(false))} disabled={loading}>{loading?"Saving…":"Save Changes"}</Btn></>}>
        <UserForm title="Edit User"/>
      </Modal>

      <ConfirmDialog open={resetOpen} onClose={()=>setResetOpen(false)}
        onConfirm={()=>run("Password reset",()=>setResetOpen(false))}
        title="Reset Password" confirmLabel="Reset Password" variant="warning" loading={loading}
        description={`A temporary password will be sent to ${selected?.email}. They must change it on next login.`}/>

      <ConfirmDialog open={deleteOpen} onClose={()=>setDeleteOpen(false)}
        onConfirm={()=>run("User deleted",()=>setDeleteOpen(false))}
        title="Delete User" confirmLabel="Delete User" variant="danger" loading={loading}
        description={`Remove "${selected?.name}" permanently? This cannot be undone.`}/>
    </div>
  );
}
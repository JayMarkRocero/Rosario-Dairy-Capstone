import { useState, useMemo, useEffect } from "react";
import { Plus, Eye, Edit, Trash2, Lock, PenBox, KeyIcon } from "lucide-react";
import { toast } from "sonner";
import { Card, StatusBadge, Btn, Modal, Drawer, ConfirmDialog, EnhancedTable } from "../../components";
import type { Column } from "../../components";
import { C } from "../../constants/colors";
import { userService } from "../../services/user.service";
import type { SystemUser } from "../../types/user";

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400";
const inputStyle = { borderColor:C.border, color:C.text, backgroundColor:"#F8FAFC" };

const ROLES = ["Administrator", "Staff"];
const DEACTIVATION_REASONS = ["suspended", "resigned", "terminated", "on_leave"];

interface FormState {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}
const EMPTY_FORM: FormState = { username:"", firstName:"", lastName:"", email:"", password:"" };

// ─── Form — defined OUTSIDE the main component so it doesn't remount on every keystroke ──
function UserForm({ title, form, onChange, role, onRoleChange }: {
  title: string;
  form: FormState;
  onChange: (f: FormState) => void;
  role: "Staff" | "Administrator";
  onRoleChange: (r: "Staff" | "Administrator") => void;
}) {
  return (
    <div className="space-y-4">
      {title==="Add User" && (
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Username</label>
          <input className={inputClass} style={inputStyle} placeholder="jdelacruz"
            value={form.username} onChange={e=>onChange({...form,username:e.target.value})}/>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>First Name</label>
          <input className={inputClass} style={inputStyle} placeholder="Juan"
            value={form.firstName} onChange={e=>onChange({...form,firstName:e.target.value})}/>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Last Name</label>
          <input className={inputClass} style={inputStyle} placeholder="dela Cruz"
            value={form.lastName} onChange={e=>onChange({...form,lastName:e.target.value})}/>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Email</label>
          <input className={inputClass} style={inputStyle} placeholder="juan@rosariodairy.com"
            value={form.email} onChange={e=>onChange({...form,email:e.target.value})}/>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold block mb-2" style={{color:C.muted}}>Role</label>
        <div className="flex gap-2">
          {(["Staff","Administrator"] as const).map(r=>(
            <button key={r} onClick={()=>onRoleChange(r)}
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
          <input className={inputClass} style={inputStyle} type="password" placeholder="Min. 8 characters"
            value={form.password} onChange={e=>onChange({...form,password:e.target.value})}/>
        </div>
      )}
    </div>
  );
}

export function AdminUserManagement() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const loadUsers = () => {
    setUsersLoading(true);
    userService.getAll()
      .then(setUsers)
      .catch(() => toast.error("Failed to load users."))
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const [roleFilter,  setRoleFilter]  = useState("All");
  const [viewOpen,    setViewOpen]    = useState(false);
  const [addOpen,     setAddOpen]     = useState(false);
  const [editOpen,    setEditOpen]    = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [resetOpen,   setResetOpen]   = useState(false);
  const [selected,    setSelected]    = useState<SystemUser | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [role,        setRole]        = useState<"Administrator"|"Staff">("Staff");
  const [form,        setForm]        = useState<FormState>(EMPTY_FORM);
  const [deactivateReason, setDeactivateReason] = useState(DEACTIVATION_REASONS[0]);
  const [newPassword, setNewPassword] = useState("");

  const summary = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === "Administrator").length;
    const staff = users.filter(u => u.role === "Staff").length;
    const inactive = users.filter(u => u.status === "Inactive").length;
    return [
      { label:"Total Users",    value:String(total),    color:C.navy  },
      { label:"Administrators", value:String(admins),   color:C.blue  },
      { label:"Staff",          value:String(staff),    color:C.green },
      { label:"Inactive",       value:String(inactive), color:C.muted },
    ];
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (roleFilter === "All") return users;
    return users.filter(u => u.role === roleFilter);
  }, [users, roleFilter]);

  const openView = (u:SystemUser) => { setSelected(u); setViewOpen(true); };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setRole("Staff");
    setAddOpen(true);
  };

  const openEdit = (u: SystemUser) => {
    setSelected(u);
    const [firstName, ...rest] = u.name.split(" ");
    setForm({ username: "", firstName: firstName ?? "", lastName: rest.join(" "), email: u.email, password: "" });
    setRole(u.role);
    setEditOpen(true);
  };

  const handleAddSave = () => {
    if (!form.username || !form.email || !form.password) {
      toast.error("Please fill in username, email, and temporary password."); return;
    }
    setLoading(true);
    userService.createUser({
      username: form.username,
      email: form.email,
      password: form.password,
      role,
      firstName: form.firstName,
      lastName: form.lastName,
    })
      .then(() => {
        toast.success("User added successfully!");
        setAddOpen(false);
        setForm(EMPTY_FORM);
        loadUsers();
      })
      .catch(() => toast.error("Failed to add user."))
      .finally(() => setLoading(false));
  };

  const handleEditSave = () => {
    if (!selected) return;
    if (!form.email) {
      toast.error("Email is required."); return;
    }
    setLoading(true);
    userService.updateUser(selected.id, {
      email: form.email,
      role,
      firstName: form.firstName,
      lastName: form.lastName,
    })
      .then(() => {
        toast.success("User updated successfully!");
        setEditOpen(false);
        setForm(EMPTY_FORM);
        loadUsers();
      })
      .catch(() => toast.error("Failed to update user. You may not be able to edit your own account."))
      .finally(() => setLoading(false));
  };

  const handleDeactivate = () => {
    if (!selected) return;
    setLoading(true);
    userService.deactivateUser(selected.id, deactivateReason)
      .then(() => {
        toast.success(`${selected.name} deactivated.`);
        setDeleteOpen(false);
        loadUsers();
      })
      .catch(() => toast.error("Failed to deactivate user. You may not be able to deactivate the last admin or your own account."))
      .finally(() => setLoading(false));
  };

  const handleResetPassword = () => {
    if (!selected) return;
    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters."); return;
    }
    setLoading(true);
    userService.resetPassword(selected.username ?? "", newPassword)
      .then(() => {
        toast.success("Password reset successfully.");
        setResetOpen(false);
        setNewPassword("");
      })
      .catch(() => toast.error("Failed to reset password."))
      .finally(() => setLoading(false));
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
          <button onClick={()=>openEdit(r)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{color:C.muted}}><Edit size={13}/></button>
          <button onClick={()=>{setSelected(r);setResetOpen(true);}} className="p-1.5 rounded-lg hover:bg-yellow-50" style={{color:C.orange}}><KeyIcon size={13}/></button>
          <button onClick={()=>{setSelected(r);setDeleteOpen(true);}} className="p-1.5 rounded-lg hover:bg-red-50" style={{color:C.red}}><Trash2 size={13}/></button>
        </div>
      )},
  ];

  return (
    <div className="flex flex-col min-h-full gap-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <h2 className="text-base sm:text-lg font-bold leading-snug" style={{color:C.muted}}>
          Manage administrator and staff accounts
        </h2>
        <Btn variant="primary" size="sm" icon={<Plus size={13}/>} onClick={openAdd}>
          Add User
        </Btn>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 flex-shrink-0">
        {summary.map(s=>(
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
          emptyTitle={usersLoading ? "Loading users…" : "No users found"}
          emptyDesc={usersLoading ? "Fetching data from the server." : "Add your first user to get started."}
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
          <Btn variant="primary" onClick={()=>{setViewOpen(false); selected && openEdit(selected);}}>Edit User</Btn></>}>
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
          <Btn variant="primary" onClick={handleAddSave} disabled={loading}>{loading?"Saving…":"Add User"}</Btn></>}>
        <UserForm title="Add User" form={form} onChange={setForm} role={role} onRoleChange={setRole}/>
      </Modal>

      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title="Edit User" subtitle={selected?.name} size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleEditSave} disabled={loading}>{loading?"Saving…":"Save Changes"}</Btn></>}>
        <UserForm title="Edit User" form={form} onChange={setForm} role={role} onRoleChange={setRole}/>
      </Modal>

      {/* Reset Password */}
      <Modal open={resetOpen} onClose={()=>{setResetOpen(false); setNewPassword("");}} title="Reset Password" subtitle={selected?.name} size="sm"
        footer={<><Btn variant="secondary" onClick={()=>{setResetOpen(false); setNewPassword("");}}>Cancel</Btn>
          <Btn variant="primary" onClick={handleResetPassword} disabled={loading}>{loading?"Resetting…":"Reset Password"}</Btn></>}>
        <div className="space-y-4">
          <p className="text-sm" style={{color:C.muted}}>
            Set a new password for {selected?.name}. They should change it on next login.
          </p>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>New Password</label>
            <input className={inputClass} style={inputStyle} type="password" placeholder="Min. 8 characters"
              value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
          </div>
        </div>
      </Modal>

      {/* Deactivate Confirm */}
      <Modal open={deleteOpen} onClose={()=>setDeleteOpen(false)} title="Deactivate User" subtitle={selected?.name} size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setDeleteOpen(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={handleDeactivate} disabled={loading}>{loading?"Deactivating…":"Deactivate User"}</Btn></>}>
        <div className="space-y-4">
          <p className="text-sm" style={{color:C.muted}}>
            {`Deactivate "${selected?.name}"? They will no longer be able to log in.`}
          </p>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Reason</label>
            <select className={inputClass} style={inputStyle} value={deactivateReason}
              onChange={e => setDeactivateReason(e.target.value)}>
              {DEACTIVATION_REASONS.map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
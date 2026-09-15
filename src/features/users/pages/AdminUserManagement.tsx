import { useAdminAutoPageSize } from "@/hooks/useAutoPageSize";
import { toastApiError } from "@/lib/errorHandling";
import { filterSelectClass } from "@/styles/controlClasses";
import { ActionButton } from "@/components/buttons/ActionButton";
import { SummaryCard } from "@/components/data-display/SummaryCard";
import { useState, useMemo, useEffect } from "react";
import { Plus, Eye, Edit, Trash2, Lock, PenBox, KeyIcon, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/data-display/Card";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { Btn } from "@/components/buttons/Btn";
import { Modal } from "@/components/overlays/Modal";
import { Drawer } from "@/components/overlays/Drawer";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { C } from "@/styles/tokens/colors";
import { userService } from "@/features/users/api/user.service";
import type { SystemUser } from "@/features/users/types/user";
import { DEACTIVATION_OPTIONS, canReactivateUser, compareUsersByStatusAndLogin, userLastLoginTimestamp } from "@/features/users/types/user";
import type { DeactivationReason } from "@/lib/api";
import { isValidPhoneNumber, PHONE_FORMAT_HINT } from "@/lib/validators";

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400";
const inputStyle = { borderColor:C.border, color:C.text, backgroundColor:"#F8FAFC" };
const readOnlyStyle = { borderColor:C.border, color:C.muted, backgroundColor:"#F1F3F5" };

const ROLES = ["Administrator", "Staff"];

interface FormState {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber: string;
  address: string;
}
const EMPTY_FORM: FormState = { username:"", firstName:"", lastName:"", email:"", password:"", phoneNumber:"", address:"" };

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
      {title==="Add User" ? (
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Username</label>
          <input className={inputClass} style={inputStyle} placeholder="jdelacruz"
            autoComplete="off"
            value={form.username} onChange={e=>onChange({...form,username:e.target.value})}/>
        </div>
      ) : (
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Username</label>
          <input className={inputClass} style={readOnlyStyle} value={form.username} readOnly disabled/>
          <p className="text-xs mt-1" style={{color:C.muted}}>Username cannot be changed.</p>
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
            autoComplete="off"
            value={form.email} onChange={e=>onChange({...form,email:e.target.value})}/>
        </div>
        <div>
  <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Phone Number</label>
  <input className={inputClass} style={inputStyle} placeholder="09XXXXXXXXX"
    maxLength={11}
    value={form.phoneNumber}
    onChange={e=>onChange({...form,phoneNumber:e.target.value.replace(/\D/g, "")})}/>
</div>
        <div className="col-span-2">
          <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Address</label>
          <input className={inputClass} style={inputStyle} placeholder="Street, Barangay, City"
            value={form.address} onChange={e=>onChange({...form,address:e.target.value})}/>
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
            autoComplete="new-password"
            value={form.password} onChange={e=>onChange({...form,password:e.target.value})}/>
        </div>
      )}
    </div>
  );
}

export function AdminUserManagement() {
  const pageCapacity = useAdminAutoPageSize(56);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const loadUsers = () => {
    setUsersLoading(true);
    userService.getAll()
      .then(setUsers)
      .catch(error => toastApiError(error, "Failed to load users."))
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const [roleFilter,  setRoleFilter]  = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewOpen,    setViewOpen]    = useState(false);
  const [addOpen,     setAddOpen]     = useState(false);
  const [editOpen,    setEditOpen]    = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [resetOpen,   setResetOpen]   = useState(false);
  const [selected,    setSelected]    = useState<SystemUser | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [role,        setRole]        = useState<"Administrator"|"Staff">("Staff");
  const [form,        setForm]        = useState<FormState>(EMPTY_FORM);
  const [deactivateReason, setDeactivateReason] = useState<DeactivationReason>("suspended");
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
    return users.filter(u => (roleFilter === "All" || u.role === roleFilter)
      && (statusFilter === "All" || u.status === statusFilter))
      .sort(compareUsersByStatusAndLogin);
  }, [users, roleFilter, statusFilter]);

  const openView = (u:SystemUser) => { setSelected(u); setViewOpen(true); };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setRole("Staff");
    setAddOpen(true);
  };

  const openEdit = (u: SystemUser) => {
  setSelected(u);
  const [firstName, ...rest] = u.name.split(" ");
  setForm({
    username: u.username ?? "",
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    email: u.email,
    password: "",
    phoneNumber: u.phone !== "—" ? u.phone : "",
    address: u.address !== "—" ? u.address : "",
  });
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
      .catch((err: Error) => toastApiError(err))
      .finally(() => setLoading(false));
  };

  const handleEditSave = () => {
    if (!selected) return;
    if (!form.email) {
      toast.error("Email is required."); return;
    }
    if (!isValidPhoneNumber(form.phoneNumber)) {
      toast.error(PHONE_FORMAT_HINT); return;
    }

    setLoading(true);
    userService.updateUser(selected.id, {
      email: form.email,
      role,
      firstName: form.firstName,
      lastName: form.lastName,
      phoneNumber: form.phoneNumber,
      address: form.address,
    })
      .then(() => {
        toast.success("User updated successfully!");
        setEditOpen(false);
        setForm(EMPTY_FORM);
        loadUsers();
      })
      .catch((err: Error) => toastApiError(err))
      .finally(() => setLoading(false));
  };

  const handleDeactivate = () => {
    if (!selected || selected.status !== "Active" || loading) return;
    setLoading(true);
    userService.deactivateUser(selected.id, deactivateReason)
      .then(() => {
        toast.success(`${selected.name} deactivated.`);
        setDeleteOpen(false);
        loadUsers();
      })
      .catch((err: Error) => toastApiError(err))
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
      .catch((err: Error) => toastApiError(err))
      .finally(() => setLoading(false));
  };

  const handleReactivate = async () => {
    if (!selected || !canReactivateUser(selected) || loading) return;
    setLoading(true);
    try {
      await userService.reactivateUser(selected.id);
      toast.success(`${selected.name} reactivated.`);
      setReactivateOpen(false);
      setSelected({ ...selected, status: "Active", deactivationReason: "none" });
      loadUsers();
    } catch (error) {
      toastApiError(error, "Unable to reactivate account.");
    } finally { setLoading(false); }
  };

  const columns: Column<SystemUser>[] = [
    { key:"name", header:"User", align:"left", width:"32%", sortKey:r=>r.name,
      render:r=>(
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold"
            style={{backgroundColor:r.role==="Administrator"?C.navy:C.blue}}>
            {r.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
          </div>
          <div>
            <div className="font-medium text-sm" style={{color:C.text}}>{r.name}</div>
            <div className="text-xs" style={{color:C.muted}}>{r.email}</div>
          </div>
        </div>
      )},
    { key:"role", header:"Role", align:"center", width:"15%", sortKey:r=>r.role,
      render:r=>(
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1 border border-blue-200/60"
            style={{backgroundColor:r.role==="Administrator"?C.navy+"15":C.blue+"15",
              color:r.role==="Administrator"?C.navy:C.blue}}>
            {r.role}
          </span>
        </div>
      )},
    { key:"status", header:"Status", align:"center", width:"13%", sortKey:r=>r.status,
      render:r=><div className="flex items-center justify-center gap-2"><StatusBadge status={r.status}/></div> },
    { key:"last", header:"Last Login", align:"center", width:"24%", sortKey:userLastLoginTimestamp,
      render:r=><span className="text-xs" style={{color:C.muted}}>{r.last}</span> },
    { key:"actions", header:"Actions", align:"center", width:"16%",
      render:r=>(
        <div className="flex items-center justify-center gap-2" onClick={e=>e.stopPropagation()}>
          <ActionButton label="View details" onClick={()=>openView(r)}><Eye size={13}/></ActionButton>
          <ActionButton label="Edit" onClick={()=>openEdit(r)}><Edit size={13}/></ActionButton>
          <ActionButton label="Reset password" onClick={()=>{setSelected(r);setResetOpen(true);}}><KeyIcon size={13}/></ActionButton>
          {r.status === "Active" ? <ActionButton label="Deactivate" destructive disabled={loading} onClick={()=>{setSelected(r);setDeactivateReason("suspended");setDeleteOpen(true);}}><Trash2 size={13}/></ActionButton>
            : <ActionButton label={canReactivateUser(r) ? "Reactivate Account" : "Reactivation unavailable for resigned or terminated accounts"} disabled={loading || !canReactivateUser(r)} onClick={()=>{setSelected(r);setReactivateOpen(true);}}><UserCheck size={13}/></ActionButton>}
        </div>
      )},
  ];

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 overflow-hidden gap-3 px-4 sm:px-6 pt-3 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <h2 className="text-base sm:text-lg font-bold leading-snug" style={{color:C.muted}}>
          Manage administrator and staff accounts
        </h2>
        <Btn variant="primary" size="sm" icon={<Plus size={13}/>} onClick={openAdd}>
          Add User
        </Btn>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
  {summary.map(s=>(
    <SummaryCard compact key={s.label} label={s.label} value={s.value} color={s.color} />
  ))}
</div>

      <Card className="p-4 flex-1 min-h-0 flex flex-col justify-between mb-3 overflow-hidden">
        <EnhancedTable
          rowHeight={56}
          fillHeight
          scrollBody
          disableScroll
          columns={columns}
          data={filteredUsers}
          rowKey={r=>r.id}
          pageCapacity={pageCapacity}
          searchable
          searchKeys={r=>[r.name,r.email,r.role]}
          searchPlaceholder="Search users…"
          onRowClick={openView}
          showExport={false}
          emptyTitle={usersLoading ? "Loading users…" : "No users found"}
          emptyDesc={usersLoading ? "Fetching data from the server." : "Add your first user to get started."}
          extraControls={
            <>
            <select
              aria-label="Role"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className={filterSelectClass}
            >
              <option value="All">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select aria-label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={filterSelectClass}>
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            </>
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
              {selected.status === "Inactive" && <p className="mt-2 text-xs" style={{color:C.muted}}>
                {DEACTIVATION_OPTIONS.find(option => option.value === selected.deactivationReason)?.label ?? "Inactive"}
                {!canReactivateUser(selected) && " · This account cannot be reactivated directly."}
              </p>}
            </div>
            {[
              {l:"Username",v:selected.username},
              {l:"Email",v:selected.email},
              {l:"Phone",v:selected.phone},
              {l:"Address",v:selected.address},
              {l:"Last Login",v:selected.last},
]           .map(r=>(
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
              autoComplete="new-password"
              value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
          </div>
        </div>
      </Modal>

      {/* Deactivate Confirm */}
      <Modal open={reactivateOpen} onClose={()=>{if (!loading) setReactivateOpen(false);}} title="Reactivate Account" subtitle={selected?.name} size="sm"
        footer={<><Btn variant="secondary" disabled={loading} onClick={()=>setReactivateOpen(false)}>Cancel</Btn>
          <Btn variant="primary" disabled={loading || !selected || !canReactivateUser(selected)} onClick={handleReactivate}>{loading ? "Reactivating..." : "Reactivate Account"}</Btn></>}>
        <p className="text-sm" style={{color:C.muted}}>Reactivate {selected?.name}? This restores the account's active status so they can sign in with their existing credentials.</p>
      </Modal>

      <Modal open={deleteOpen} onClose={()=>{if (!loading) setDeleteOpen(false);}} title="Deactivate User" subtitle={selected?.name} size="sm"
        footer={<><Btn variant="secondary" disabled={loading} onClick={()=>setDeleteOpen(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={handleDeactivate} disabled={loading}>{loading?"Deactivating…":"Deactivate User"}</Btn></>}>
        <div className="space-y-4">
          <p className="text-sm" style={{color:C.muted}}>
            {`Deactivate "${selected?.name}"? They will no longer be able to log in.`}
          </p>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Reason</label>
            <select disabled={loading} className={inputClass} style={inputStyle} value={deactivateReason}
              onChange={e => { const option = DEACTIVATION_OPTIONS.find(item => item.value === e.target.value); if (option) setDeactivateReason(option.value); }}>
              {DEACTIVATION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

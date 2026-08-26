import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, UserStatus } from '../types';
import { AppStore } from '../services/store';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  UserCheck,
  UserX,
  Edit,
  CheckCircle2,
  AlertCircle,
  X,
  Key,
} from 'lucide-react';

interface AdminUsersProps {
  currentUser: User;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>(() => AppStore.getUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    AppStore.fetchUsersFromBackend().then((fresh) => {
      setUsers(fresh);
    });

    const unsubscribe = AppStore.subscribe((event) => {
      if (event.type === 'USER_UPDATED') {
        setUsers(AppStore.getUsers());
      }
    });
    return unsubscribe;
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const handleOpenAdd = () => {
    setEditingUser({
      name: '',
      email: '',
      role: 'user',
      department: 'Electrical Maintenance',
      designation: 'Assistant Engineer',
      status: 'active',
      password: 'user123',
    });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser({ ...user });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (user: User) => {
    if (user.id === currentUser.id || user.auth_user_id === currentUser.auth_user_id || user.email?.toLowerCase() === currentUser.email?.toLowerCase()) {
      alert('You cannot deactivate your own active account.');
      return;
    }
    const newStatus: UserStatus = user.status === 'active' ? 'inactive' : 'active';
    const updated: User = { ...user, status: newStatus };
    try {
      await AppStore.saveUser(updated);
      const fresh = await AppStore.fetchUsersFromBackend();
      setUsers(fresh || AppStore.getUsers());
      setStatusMessage(`User ${user.name} is now ${newStatus}.`);
      setTimeout(() => setStatusMessage(''), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update user status.');
      setTimeout(() => setErrorMessage(''), 4500);
    }
  };

  const handleToggleRole = async (user: User) => {
    if (user.id === currentUser.id || user.auth_user_id === currentUser.auth_user_id || user.email?.toLowerCase() === currentUser.email?.toLowerCase()) {
      alert('You cannot change your own role.');
      return;
    }
    const newRole: UserRole = user.role === 'admin' ? 'user' : 'admin';
    const updated: User = { ...user, role: newRole };
    try {
      await AppStore.saveUser(updated);
      const fresh = await AppStore.fetchUsersFromBackend();
      setUsers(fresh || AppStore.getUsers());
      setStatusMessage(`User ${user.name} (${user.email}) role changed to ${newRole === 'admin' ? 'ADMINISTRATOR (এডমিন)' : 'NORMAL USER (ইউজার)'} and synced to Supabase.`);
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update user role in Supabase.');
      setTimeout(() => setErrorMessage(''), 4500);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editingUser.name?.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!editingUser.email?.trim() || !editingUser.email.includes('@')) {
      setErrorMessage('Valid email address is required.');
      return;
    }

    const username = (editingUser.username || editingUser.email.split('@')[0]).trim().toLowerCase();

    setIsSaving(true);
    setErrorMessage('');

    try {
      if (editingUser.id) {
        await AppStore.saveUser({ ...(editingUser as User), username });
      } else {
        const registered = await AppStore.registerUser(
          editingUser.name!,
          username,
          editingUser.email!,
          editingUser.password || '123456',
          editingUser.department || 'General'
        );
        if (registered && (editingUser.role === 'admin' || editingUser.status === 'inactive' || editingUser.designation)) {
          await AppStore.saveUser({
            ...registered,
            role: editingUser.role || 'user',
            status: editingUser.status || 'active',
            designation: editingUser.designation || registered.designation,
          });
        }
      }
      const freshList = await AppStore.fetchUsersFromBackend();
      setUsers(freshList || AppStore.getUsers());
      setIsModalOpen(false);
      setEditingUser(null);
      setStatusMessage('User profile and permissions saved to Supabase successfully.');
      setTimeout(() => setStatusMessage(''), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save user.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            User Management (ব্যবহারকারী ব্যবস্থাপনা)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin console for managing user roles, department assignments, User IDs, and active authorizations.
          </p>
        </div>

        <button
          id="admin-add-user-btn"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          + Add New User
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
        <div className="relative">
          <input
            id="admin-user-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name, email, User ID, or department..."
            className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
          />
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3 w-10">SL</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Full Name &amp; Designation</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3 text-center">Role</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredUsers.map((user, idx) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 font-normal">{idx + 1}</td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">
                    {user.userId}
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-800 font-semibold">
                    @{user.username || user.email.split('@')[0]}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-950">{user.name}</div>
                    <div className="text-[10.5px] text-slate-500">{user.designation || 'Staff'}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{user.email}</td>
                  <td className="px-4 py-3 text-slate-700">{user.department}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleRole(user)}
                      title="Click to toggle role"
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-transform hover:scale-105 ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {user.role}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleStatus(user)}
                      title="Click to toggle active status"
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-transform hover:scale-105 ${
                        user.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {user.status === 'active' ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      {user.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      id={`edit-user-${user.id}`}
                      onClick={() => handleOpenEdit(user)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-medium transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                      Edit Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {isModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                {editingUser.id ? `Edit User (${editingUser.userId})` : 'Register New User'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser((p) => ({ ...p!, name: e.target.value }))}
                  placeholder="e.g. Engr. Jalel Ahmed"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser((p) => ({ ...p!, email: e.target.value }))}
                  placeholder="e.g. user@tsp.gov.bd or user@gmail.com"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={editingUser.department || 'Electrical Maintenance'}
                    onChange={(e) =>
                      setEditingUser((p) => ({ ...p!, department: e.target.value }))
                    }
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded"
                  >
                    <option value="Electrical Maintenance">Electrical</option>
                    <option value="Mechanical Division">Mechanical</option>
                    <option value="Instrumentation & Control">Instrumentation</option>
                    <option value="Chemical Production (TSP Plant)">Chemical / TSP Plant</option>
                    <option value="Civil Engineering">Civil</option>
                    <option value="Workshop & Heavy Machine">Workshop</option>
                    <option value="Store & Inventory">Store (ভান্ডার)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={editingUser.designation || ''}
                    onChange={(e) =>
                      setEditingUser((p) => ({ ...p!, designation: e.target.value }))
                    }
                    placeholder="e.g. Executive Engineer"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={editingUser.role || 'user'}
                    onChange={(e) =>
                      setEditingUser((p) => ({ ...p!, role: e.target.value as UserRole }))
                    }
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded"
                  >
                    <option value="user">Normal User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingUser.status || 'active'}
                    onChange={(e) =>
                      setEditingUser((p) => ({ ...p!, status: e.target.value as UserStatus }))
                    }
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="text"
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser((p) => ({ ...p!, password: e.target.value }))}
                  placeholder="Set account password"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {isSaving ? 'Saving User...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

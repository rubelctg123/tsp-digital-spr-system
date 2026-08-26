import React, { useState } from 'react';
import { User } from '../types';
import { AppStore } from '../services/store';
import {
  UserCheck,
  Shield,
  Key,
  Save,
  CheckCircle2,
  AlertCircle,
  Mail,
  Hash,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';

interface UserProfileProps {
  currentUser: User;
  onUpdateProfile: (updated: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ currentUser, onUpdateProfile }) => {
  // Profile Info State
  const [name, setName] = useState(currentUser.name);
  const [department, setDepartment] = useState(currentUser.department);
  const [designation, setDesignation] = useState(currentUser.designation || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password Management State (Supabase Auth)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Password validation checks
  const isMinLength = newPassword.length >= 6;
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileStatus('');

    if (!name.trim()) {
      setProfileError('Name cannot be empty.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const updated: User = {
        ...currentUser,
        name: name.trim(),
        department,
        designation: designation.trim(),
      };
      await AppStore.saveUser(updated);
      onUpdateProfile(updated);
      setProfileStatus('Profile information updated successfully.');
      setTimeout(() => setProfileStatus(''), 4000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordStatus('');

    if (!newPassword) {
      setPasswordError('New password cannot be empty.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must contain at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match. Please verify your confirmation.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await AppStore.updatePassword(newPassword);
      setPasswordStatus('Password changed successfully.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordStatus(''), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Unable to change password. Please try again.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-14">
      {/* Title Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-emerald-600" />
            My Profile &amp; Account Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your corporate identity, department details, and account security.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              currentUser.role === 'admin'
                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            {currentUser.role === 'admin' ? 'Administrator' : 'Standard User'}
          </span>
        </div>
      </div>

      {/* 1. Account Credentials & Basic Profile */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-800">
            Account Identification &amp; Profile Details
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {profileStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{profileStatus}</span>
            </div>
          )}

          {profileError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {/* Read-Only System Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 p-4 bg-slate-50 rounded-xl border border-slate-200/90">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-400" /> Assigned User ID
              </span>
              <div className="text-base font-black font-mono text-slate-900 mt-1">
                {currentUser.userId}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" /> Username
              </span>
              <div className="text-sm font-mono font-bold text-slate-800 mt-1 truncate">
                {currentUser.username || currentUser.email.split('@')[0]}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address
              </span>
              <div className="text-xs font-mono font-medium text-slate-800 mt-1 truncate" title={currentUser.email}>
                {currentUser.email}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-slate-400" /> System Role
              </span>
              <div className="mt-1">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                    currentUser.role === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
            </div>
          </div>

          {/* Editable Details Form */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full Name (পূর্ণ নাম) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Department (বিভাগ)
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none font-medium"
                >
                  <option value="Electrical Maintenance">Electrical Maintenance (বৈদ্যুতিক)</option>
                  <option value="Mechanical Division">Mechanical Division (যান্ত্রিক)</option>
                  <option value="Instrumentation & Control">Instrumentation &amp; Control</option>
                  <option value="Chemical Production (TSP Plant)">Chemical Production (টিএসপি প্ল্যান্ট)</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                  <option value="Workshop & Heavy Machine">Workshop</option>
                  <option value="Store & Inventory">Store (ভান্ডার)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Designation (পদবী)
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Assistant Engineer (Electrical)"
                  className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {isSavingProfile ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 2. Dedicated Security & Change Password Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">
              Security &amp; Password Management (নিরাপত্তা ও পাসওয়ার্ড)
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Powered by Supabase Auth
          </span>
        </div>

        <div className="p-6">
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Update your account password securely. Changes take effect immediately across all sessions.
          </p>

          {passwordStatus && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{passwordStatus}</span>
            </div>
          )}

          {passwordError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                New Password (নতুন পাসওয়ার্ড) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="profile-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter at least 6 characters"
                  className="w-full text-xs pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none font-medium transition-all"
                />
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Confirm New Password (পাসওয়ার্ড নিশ্চিত করুন) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="profile-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full text-xs pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none font-medium transition-all"
                />
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Validation Indicators */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1.5">
              <span className="font-bold text-slate-700 block">Password Requirements:</span>
              <div className="flex items-center gap-2">
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                    isMinLength ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  ✓
                </div>
                <span className={isMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                  Minimum 6 characters
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                    isMatching ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  ✓
                </div>
                <span className={isMatching ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                  Passwords must match
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="profile-change-password-btn"
                type="submit"
                disabled={isUpdatingPassword || !isMinLength || !isMatching}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {isUpdatingPassword ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Change Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { SprRecord, User, Material } from '../types';
import { AppStore } from '../services/store';
import { formatCurrencyBDT } from '../utils/numberToWords';
import { exportSprToExcel } from '../utils/exporter';
import {
  FileText,
  Plus,
  Calendar,
  DollarSign,
  Package,
  ArrowUpRight,
  Eye,
  Edit,
  Download,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

interface DashboardProps {
  currentUser: User;
  onNewSpr: () => void;
  onViewSpr: (spr: SprRecord) => void;
  onEditSpr: (spr: SprRecord) => void;
  onNavigateToRecords: () => void;
  onNavigateToMaterials: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  onNewSpr,
  onViewSpr,
  onEditSpr,
  onNavigateToRecords,
  onNavigateToMaterials,
}) => {
  const [sprList, setSprList] = useState<SprRecord[]>(() => AppStore.getSprRecords());
  const [materials, setMaterials] = useState<Material[]>(() => AppStore.getMaterials());

  useEffect(() => {
    AppStore.fetchSprsFromBackend().then((fresh) => {
      if (fresh) setSprList(fresh);
    });
    AppStore.fetchMaterialsFromBackend().then((fresh) => {
      if (fresh) setMaterials(fresh);
    });

    const unsubscribe = AppStore.subscribe((event) => {
      if (event.type.startsWith('SPR_')) {
        setSprList(AppStore.getSprRecords());
      }
      if (event.type.startsWith('MATERIAL_')) {
        setMaterials(AppStore.getMaterials());
      }
    });
    return unsubscribe;
  }, []);

  // Stats calculation
  const totalSprCount = sprList.length;

  const currentMonthYear = new Date().toISOString().substring(0, 7); // e.g. "2026-08"
  const thisMonthSprCount = useMemo(() => {
    return sprList.filter((s) => s.date && s.date.startsWith(currentMonthYear)).length;
  }, [sprList, currentMonthYear]);

  const grandTotalAmount = useMemo(() => {
    return sprList.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
  }, [sprList]);

  const recentSprs = useMemo(() => {
    return [...sprList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  }, [sprList]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Banner with TSP Office Context & + New SPR Button */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded w-fit mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            TSP Complex Ltd. • BCIC Digital Portal
          </div>
          <h1 className="text-2xl font-black text-slate-950 tracking-tight">
            Store Purchase Requisition (SPR) System
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            Welcome back, <strong className="text-slate-900">{currentUser.name}</strong> ({currentUser.userId}). Create, record, and generate print-ready BCIC standard SPR forms in seconds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="dash-new-spr-btn"
            onClick={onNewSpr}
            className="inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            + New SPR (নতুন এসপিআর)
          </button>
        </div>
      </div>

      {/* 4 Clean Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total SPR */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Requisitions
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {totalSprCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">All registered SPRs</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: This Month */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              This Month
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {thisMonthSprCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Current billing cycle</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Total Value */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Value (BDT)
            </span>
            <div className="text-xl font-black text-slate-900 mt-1 font-mono">
              ৳ {formatCurrencyBDT(grandTotalAmount)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Cumulated estimate</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-lg">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Material Master Count */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Material Codes
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {materials.length}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Authorized catalogue</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-700 rounded-lg">
            <Package className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Recent SPRs Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Recent SPR Requisitions (সাম্প্রতিক এসপিআর)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest purchase requisitions submitted across departments.
            </p>
          </div>

          <button
            id="dash-view-all-spr-btn"
            onClick={onNavigateToRecords}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
          >
            View All Records
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">SPR No.</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Prepared By</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Total (BDT)</th>
                <th className="px-4 py-3 text-center w-32">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {recentSprs.length > 0 ? (
                recentSprs.map((spr) => {
                  const canEdit = currentUser.role === 'admin' || spr.preparedByUserId === currentUser.userId;

                  return (
                    <tr key={spr.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => onViewSpr(spr)}
                          className="font-mono font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {spr.sprNo}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-700">
                        {spr.date}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[10.5px]">
                          {spr.department}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900">{spr.preparedBy}</span>
                        <span className="block text-[10px] text-slate-500 font-mono">
                          {spr.preparedByUserId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-full font-mono text-slate-700 text-[10.5px]">
                          {spr.items.length} items
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">
                        ৳ {formatCurrencyBDT(spr.grandTotal)}/-
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onViewSpr(spr)}
                            title="View & Print Word Layout"
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => exportSprToExcel(spr)}
                            title="Export Excel"
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => onEditSpr(spr)}
                              title="Edit SPR"
                              className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No SPR records found. Click "+ New SPR" to create your first entry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import { SprRecord, User } from '../types';
import { AppStore } from '../services/store';
import { formatCurrencyBDT } from '../utils/numberToWords';
import { exportAllSprsToPdf, downloadSprPdf } from '../utils/pdfExporter';
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  Download,
  Calendar,
  FileText,
  UserCheck,
  Building,
  RefreshCw,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface SprRecordsProps {
  currentUser: User;
  onNewSpr: () => void;
  onViewSpr: (spr: SprRecord) => void;
  onEditSpr: (spr: SprRecord) => void;
}

export const SprRecords: React.FC<SprRecordsProps> = ({
  currentUser,
  onNewSpr,
  onViewSpr,
  onEditSpr,
}) => {
  const [sprList, setSprList] = useState<SprRecord[]>(() => AppStore.getSprRecords());
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState('all');
  const [statusMessage, setStatusMessage] = useState('');
  const [isExportingAllPdf, setIsExportingAllPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  // Subscribe to real-time updates & fetch on mount
  useEffect(() => {
    AppStore.fetchSprsFromBackend().then((fresh) => {
      if (fresh) setSprList(fresh);
    });

    const unsubscribe = AppStore.subscribe((event) => {
      if (event.type.startsWith('SPR_')) {
        setSprList(AppStore.getSprRecords());
      }
    });
    return unsubscribe;
  }, []);

  // Filter SPRs
  const filteredSprs = useMemo(() => {
    return sprList.filter((spr) => {
      // Normal user permissions: If not admin, can choose to view own or all public SPRs (system allows viewing all SPR records or filter by self)
      if (selectedUserFilter === 'my' && spr.preparedByUserId !== currentUser.userId) {
        return false;
      }
      if (selectedUserFilter !== 'all' && selectedUserFilter !== 'my' && spr.preparedByUserId !== selectedUserFilter) {
        return false;
      }

      // Department filter
      if (selectedDept !== 'all' && spr.department !== selectedDept) {
        return false;
      }

      // Date range filter
      if (fromDate && spr.date < fromDate) {
        return false;
      }
      if (toDate && spr.date > toDate) {
        return false;
      }

      // Text Search: SPR No, User ID, Prepared By, Ref No, or any material item code/description
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSprInfo =
          spr.sprNo.toLowerCase().includes(q) ||
          spr.refNo.toLowerCase().includes(q) ||
          spr.preparedBy.toLowerCase().includes(q) ||
          spr.preparedByUserId.toLowerCase().includes(q) ||
          spr.department.toLowerCase().includes(q) ||
          spr.subject.toLowerCase().includes(q);

        const matchesMaterial = spr.items.some(
          (it) =>
            it.code.toLowerCase().includes(q) ||
            it.description.toLowerCase().includes(q) ||
            (it.remarks && it.remarks.toLowerCase().includes(q))
        );

        if (!matchesSprInfo && !matchesMaterial) {
          return false;
        }
      }

      return true;
    });
  }, [sprList, searchQuery, fromDate, toDate, selectedDept, selectedUserFilter, currentUser]);

  // Unique departments & users for filters
  const departments = useMemo(() => {
    const depts = new Set(sprList.map((s) => s.department).filter(Boolean));
    return Array.from(depts);
  }, [sprList]);

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    sprList.forEach((s) => {
      if (s.preparedByUserId && s.preparedBy) {
        map.set(s.preparedByUserId, `${s.preparedBy} (${s.preparedByUserId})`);
      }
    });
    return Array.from(map.entries());
  }, [sprList]);

  // Delete Handler
  const handleDelete = async (id: string, sprNo: string) => {
    if (window.confirm(`Are you sure you want to permanently delete "${sprNo}"?`)) {
      await AppStore.deleteSpr(id);
      setSprList(AppStore.getSprRecords());
      setStatusMessage(`Deleted ${sprNo} successfully.`);
      setTimeout(() => setStatusMessage(''), 3500);
    }
  };

  const handleExportAllPdf = async () => {
    const targetSprs = filteredSprs.length > 0 ? filteredSprs : sprList;
    if (targetSprs.length === 0) {
      alert('No SPR records found to export.');
      return;
    }

    setIsExportingAllPdf(true);
    setExportProgress({ current: 1, total: targetSprs.length });

    try {
      await exportAllSprsToPdf(targetSprs, (current, total) => {
        setExportProgress({ current, total });
      });
      setStatusMessage(`Successfully exported ${targetSprs.length} SPR records to PDF.`);
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err) {
      console.error('Error exporting all SPRs to PDF:', err);
      alert('Failed to generate full PDF export. Please try again.');
    } finally {
      setIsExportingAllPdf(false);
      setExportProgress(null);
    }
  };

  const handleDownloadSinglePdf = async (spr: SprRecord) => {
    try {
      await downloadSprPdf(spr);
    } catch (err) {
      console.error('Error downloading single SPR PDF:', err);
      alert('Failed to download PDF.');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            SPR Records (সংরক্ষিত এসপিআর সমূহ)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Central repository of all Store Purchase Requisitions with instant search, Legal PDF generation, and Word-identical layout.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="records-export-all-pdf-btn"
            onClick={handleExportAllPdf}
            disabled={sprList.length === 0 || isExportingAllPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
          >
            {isExportingAllPdf ? (
              <>
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                Exporting PDF ({exportProgress?.current || 1}/{exportProgress?.total || sprList.length})...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-emerald-600" />
                Export All to PDF
              </>
            )}
          </button>

          <button
            id="records-new-spr-btn"
            onClick={onNewSpr}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + New SPR
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Main Keyword Search */}
          <div className="lg:col-span-4 relative">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Search by SPR No / Code / Material / User
            </label>
            <div className="relative">
              <input
                id="records-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. SPR-2024, 18.14.303, LED, USER-001..."
                className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Department Filter */}
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Department
            </label>
            <select
              id="records-dept-filter"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="all">All Departments ({sprList.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* User Scope Filter */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              User Filter
            </label>
            <select
              id="records-user-filter"
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="all">All Users</option>
              <option value="my">My SPRs ({currentUser.userId})</option>
              {uniqueUsers.map(([uid, label]) => (
                <option key={uid} value={uid}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Filter info tags */}
        {(searchQuery || selectedDept !== 'all' || selectedUserFilter !== 'all' || fromDate || toDate) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing <strong>{filteredSprs.length}</strong> of {sprList.length} records
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDept('all');
                setSelectedUserFilter('all');
                setFromDate('');
                setToDate('');
              }}
              className="text-emerald-700 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* SPR Records Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3 w-10">SL</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">SPR No.</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Prepared By</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Grand Total (BDT)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredSprs.length > 0 ? (
                filteredSprs.map((spr, idx) => {
                  const canEdit = currentUser.role === 'admin' || spr.preparedByUserId === currentUser.userId;
                  const canDelete = currentUser.role === 'admin' || spr.preparedByUserId === currentUser.userId;

                  return (
                    <tr key={spr.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 font-normal">{idx + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-700">
                        {spr.date}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => onViewSpr(spr)}
                          className="font-mono font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          {spr.sprNo}
                        </button>
                        <span className="text-[10px] text-slate-500 block truncate max-w-[180px]">
                          {spr.subject}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[10.5px]">
                          {spr.department}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900 font-medium">{spr.preparedBy}</div>
                        <div className="font-mono text-[10px] text-slate-500">{spr.preparedByUserId}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[11px]">
                          {spr.items.length} items
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">
                        ৳ {formatCurrencyBDT(spr.grandTotal)}/-
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 uppercase">
                          {spr.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            id={`view-spr-${spr.id}`}
                            onClick={() => onViewSpr(spr)}
                            title="View & Print Word SPR Document"
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            id={`pdf-spr-${spr.id}`}
                            onClick={() => handleDownloadSinglePdf(spr)}
                            title="Download PDF"
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button
                              id={`edit-spr-${spr.id}`}
                              onClick={() => onEditSpr(spr)}
                              title="Edit SPR"
                              className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              id={`delete-spr-${spr.id}`}
                              onClick={() => handleDelete(spr.id, spr.sprNo)}
                              title="Delete SPR"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No SPR records match your filter.</p>
                    <p className="text-xs text-slate-500 mt-1">Try resetting the search terms or create a new SPR.</p>
                    <button
                      onClick={onNewSpr}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded hover:bg-emerald-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create New SPR
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600">
          <span>
            Total: <strong>{filteredSprs.length}</strong> SPRs
          </span>
          <span className="font-mono font-bold text-slate-900">
            Total Requisition Amount: ৳{' '}
            {formatCurrencyBDT(filteredSprs.reduce((sum, s) => sum + s.grandTotal, 0))}/-
          </span>
        </div>
      </div>
    </div>
  );
};

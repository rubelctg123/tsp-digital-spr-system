import React, { useState, useEffect, useMemo } from 'react';
import { Material, User } from '../types';
import { AppStore } from '../services/store';
import { searchMaterialsUniversal } from '../utils/materialSearch';
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Database,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Upload,
  Download,
  FileSpreadsheet,
  Copy,
  Check,
  HelpCircle,
  FileText,
  Terminal,
  Power,
  Ban,
} from 'lucide-react';

interface MaterialMasterProps {
  currentUser: User;
}

export const MaterialMaster: React.FC<MaterialMasterProps> = ({ currentUser }) => {
  const isAdmin = currentUser.role === 'admin' || currentUser.email?.toLowerCase() === 'admin@tsp.gov.bd' || currentUser.email?.toLowerCase() === 'rubelctg1237@gmail.com';
  const [materials, setMaterials] = useState<Material[]>(() => AppStore.getMaterials());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editingMaterial, setEditingMaterial] = useState<Partial<Material> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  // Supabase sync and RLS state
  const [syncDetails, setSyncDetails] = useState<{ status: string; message: string; count: number }>({
    status: AppStore.getSupabaseSyncStatus(),
    message: '',
    count: 0,
  });
  const [showRlsHelp, setShowRlsHelp] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteModalMaterial, setConfirmDeleteModalMaterial] = useState<Material | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch directly from Supabase on mount and subscribe to Realtime updates
  useEffect(() => {
    let isMounted = true;
    
    AppStore.fetchMaterialsFromSupabase().then((res) => {
      if (isMounted) {
        setSyncDetails({
          status: AppStore.getSupabaseSyncStatus(),
          message: res.error || (res.count > 0 ? `Synced ${res.count} materials from Supabase` : ''),
          count: res.count,
        });
        if (res.rlsBlocked) {
          setShowRlsHelp(true);
        } else if (res.materials && res.materials.length > 0) {
          setMaterials(res.materials);
        }
      }
    });

    const unsubscribe = AppStore.subscribe((event) => {
      if (event.type.startsWith('MATERIAL_')) {
        setMaterials(AppStore.getMaterials());
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleRefreshFromSupabase = async () => {
    setIsRefreshing(true);
    setErrorMessage('');
    try {
      const res = await AppStore.fetchMaterialsFromSupabase();
      setSyncDetails({
        status: AppStore.getSupabaseSyncStatus(),
        message: res.error || `Synced ${res.count} materials from Supabase`,
        count: res.count,
      });

      if (res.rlsBlocked) {
        setShowRlsHelp(true);
        setErrorMessage('Supabase database-এ Row Level Security (RLS) সক্রিয় থাকায় ডাটা রিসিভ করা যাচ্ছে না। নিচের SQL টি Supabase SQL Editor-এ রান করুন।');
      } else if (res.count > 0) {
        setMaterials(res.materials);
        setShowRlsHelp(false);
        setStatusMessage(`সুপাবেজ থেকে ${res.count} টি মালামালের ডাটা সফলভাবে সিঙ্ক হয়েছে!`);
        setTimeout(() => setStatusMessage(''), 4500);
      } else {
        setMaterials(AppStore.getMaterials());
        setStatusMessage(`Current database contains ${AppStore.getMaterials().length} materials.`);
        setTimeout(() => setStatusMessage(''), 3500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to refresh materials from Supabase.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopySql = () => {
    const sql = `ALTER TABLE public.materials DISABLE ROW LEVEL SECURITY;\nALTER TABLE public.material_usage DISABLE ROW LEVEL SECURITY;`;
    navigator.clipboard.writeText(sql);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  const handleImportData = async () => {
    setImportError('');
    if (!importText.trim()) {
      setImportError('Please paste JSON or CSV data to import.');
      return;
    }

    try {
      let parsedItems: any[] = [];
      const trimmed = importText.trim();

      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const json = JSON.parse(trimmed);
        parsedItems = Array.isArray(json) ? json : [json];
      } else {
        // Simple CSV parse
        const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length > 1) {
          const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
          for (let i = 1; i < lines.length; i++) {
            const rowVals = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
            const obj: any = {};
            headers.forEach((h, colIdx) => {
              obj[h] = rowVals[colIdx] || '';
            });
            parsedItems.push(obj);
          }
        }
      }

      if (parsedItems.length === 0) {
        setImportError('No valid records found in the provided data.');
        return;
      }

      // Map each item
      const mapped: Material[] = parsedItems.map((item, idx) => {
        return {
          id: item.id || `MAT-${String(idx + 1).padStart(4, '0')}`,
          master_id: item.master_id || idx + 1,
          code: item.material_code || item.code || 'New',
          material_code: item.material_code || item.code || 'New',
          description: item.material_description || item.description || '',
          material_description: item.material_description || item.description || '',
          unit: item.unit || 'No',
          usage20_21: item.usage_20_21 ?? item.usage20_21 ?? '-',
          usage21_22: item.usage_21_22 ?? item.usage21_22 ?? '-',
          usage22_23: item.usage_22_23 ?? item.usage22_23 ?? '-',
          usage23_24: item.usage_23_24 ?? item.usage23_24 ?? '-',
          usage24_25: item.usage_24_25 ?? item.usage24_25 ?? '-',
          usage25_26: item.usage_25_26 ?? item.usage25_26 ?? '-',
          storeStock: item.store_stock || item.storeStock || 'Nil',
          store_stock: item.store_stock || item.storeStock || 'Nil',
          pipelineQty: item.pipeline_qty || item.pipelineQty || '-',
          lastMrrNo: item.last_mrr_no || item.lastMrrNo || '',
          lastMrrDate: item.last_mrr_date || item.lastMrrDate || '',
          lastMrrPrice: item.last_mrr_price || item.lastMrrPrice || item.unit_price || item.unitPrice || '',
          unit_price: item.unit_price || item.unitPrice || '',
          unitPrice: item.unit_price || item.unitPrice || '',
          previous_purchase_order_date_price: item.previous_purchase_order_date_price || '',
          remarks: item.remarks || '',
          category: item.category || 'General',
          status: item.status || 'active',
          source: item.source || 'Supabase Export Import',
          createdAt: item.created_at || new Date().toISOString(),
          updatedAt: item.updated_at || new Date().toISOString(),
        };
      });

      await AppStore.bulkImportMaterials(mapped);
      setMaterials(mapped);
      setIsImportModalOpen(false);
      setImportText('');
      setStatusMessage(`সফলভাবে ${mapped.length} টি মালামাল ইমপোর্ট ও সংরক্ষণ করা হয়েছে!`);
      setTimeout(() => setStatusMessage(''), 4500);
    } catch (err: any) {
      setImportError(`Import parsing error: ${err.message}`);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(
      materials
        .map((m) => m.category)
        .filter((c): c is string => Boolean(c && c.trim() && c !== 'General'))
    );
    return Array.from(cats);
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    let result = searchMaterialsUniversal(materials, searchQuery, selectedCategory);
    if (selectedStatusFilter !== 'all') {
      result = result.filter((m) => (m.status || 'active') === selectedStatusFilter);
    }
    return result;
  }, [materials, searchQuery, selectedCategory, selectedStatusFilter]);

  // Reset pagination when search or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedStatusFilter, itemsPerPage]);

  const totalItems = filteredMaterials.length;
  const totalPages = itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1;

  const paginatedMaterials = useMemo(() => {
    if (itemsPerPage <= 0) return filteredMaterials;
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredMaterials.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredMaterials, currentPage, itemsPerPage]);

  const handleOpenAdd = () => {
    if (!isAdmin) {
      setErrorMessage('Permission denied: Only Administrators can create Material Master codes.');
      return;
    }
    setEditingMaterial({
      code: '',
      description: '',
      unit: 'No',
      usage20_21: '-',
      usage21_22: '-',
      usage22_23: '-',
      usage23_24: '-',
      usage24_25: '-',
      usage25_26: '-',
      storeStock: 'Nil',
      pipelineQty: '-',
      lastMrrNo: '',
      lastMrrDate: '',
      lastMrrPrice: '',
      remarks: '',
      category: 'Electrical Maintenance',
      status: 'active',
      source: 'TSP System',
    });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mat: Material) => {
    if (!isAdmin) {
      setErrorMessage('Permission denied: Only Administrators can modify Material Master codes.');
      return;
    }
    setEditingMaterial({ ...mat, status: mat.status || 'active' });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;

    if (!isAdmin) {
      setErrorMessage('Permission denied: Only Administrators can save Material Master records.');
      return;
    }

    if (!editingMaterial.code?.trim()) {
      setErrorMessage('Material Code is required (e.g. 18.14.303 or New).');
      return;
    }
    if (!editingMaterial.description?.trim()) {
      setErrorMessage('Material Description & Specifications are required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const saved = await AppStore.saveMaterial(editingMaterial);
      setMaterials(AppStore.getMaterials());
      setIsModalOpen(false);
      setEditingMaterial(null);
      setStatusMessage(`Saved material "${saved.code}" (Status: ${saved.status || 'active'}) to Supabase successfully.`);
      setTimeout(() => setStatusMessage(''), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save material to Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (mat: Material) => {
    if (!isAdmin) {
      setErrorMessage('Permission denied: Only Administrators can enable or disable materials.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }
    const currentStatus = mat.status || 'active';
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await AppStore.toggleMaterialStatus(mat.id || String(mat.master_id) || mat.code);
      setMaterials(AppStore.getMaterials());
      setStatusMessage(`Material "${mat.code}" is now ${newStatus === 'active' ? 'ACTIVE (সক্রিয়)' : 'INACTIVE / DISABLED (নিষ্ক্রিয়)'}.`);
      setTimeout(() => setStatusMessage(''), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update material status.');
      setTimeout(() => setErrorMessage(''), 4500);
    }
  };

  const handleOpenDeleteModal = (mat: Material) => {
    if (!isAdmin) {
      setErrorMessage('Permission denied: Only Administrators can delete or deactivate Material Master records.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }
    setConfirmDeleteModalMaterial(mat);
  };

  const executeDeleteAction = async (mat: Material, isPermanent: boolean) => {
    setIsDeleting(true);
    const targetId = mat.id || String(mat.master_id) || mat.code;
    try {
      await AppStore.deleteMaterial(targetId, isPermanent);
      setMaterials(AppStore.getMaterials());
      if (isModalOpen) {
        setIsModalOpen(false);
        setEditingMaterial(null);
      }
      setConfirmDeleteModalMaterial(null);
      setStatusMessage(
        isPermanent
          ? `Material "${mat.code}" permanently deleted from Supabase.`
          : `Material "${mat.code}" deactivated (marked as Inactive).`
      );
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete or deactivate material.');
      setTimeout(() => setErrorMessage(''), 4500);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-12">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            Material Master (মালামাল কোড ও বিবরণী মাস্টার)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
            <span>Catalogue of authorized BCIC / TSP material codes, specifications, historical usage, and store records.</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 text-xs">
              <Database className="w-3.5 h-3.5" />
              {materials.length} Materials
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button
              id="mat-master-add-btn"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + Add Material Code
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[260px] relative">
            <input
              id="mat-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Code (e.g. 18.26.241, 18.14.303, 9.07.053) or Description (e.g. Wall Clip, LED, Wire)..."
              className="w-full text-xs pl-8 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
            <Search className="w-4 h-4 absolute left-2.5 top-3 text-slate-400" />
            {searchQuery && (
              <button
                id="mat-search-clear-btn"
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Status:</label>
              <select
                id="mat-status-filter"
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              >
                <option value="all">All Status ({materials.length})</option>
                <option value="active">Active Only ({materials.filter(m => (m.status || 'active') === 'active').length})</option>
                <option value="inactive">Disabled / Inactive ({materials.filter(m => m.status === 'inactive').length})</option>
              </select>
            </div>

            {categories.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Category:</label>
                <select
                  id="mat-category-filter"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="all">All Categories ({materials.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Rows per page:</label>
              <select
                id="mat-per-page-select"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>All ({materials.length})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Search Chips & Search Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500 font-medium">Quick search:</span>
            {[
              { label: '18.08.203', query: '18.08.203' },
              { label: '18.08.202', query: '18.08.202' },
              { label: '18.06.197', query: '18.06.197' },
              { label: '18.26.241', query: '18.26.241' },
              { label: 'Wall Clip', query: 'Wall Clip' },
              { label: '18.14.303', query: '18.14.303' },
              { label: 'LED Flood Light', query: 'LED Flood Light' },
              { label: '9.07.053', query: '9.07.053' },
              { label: 'Copper Wire', query: 'Copper Wire' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setSearchQuery(chip.query)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                  searchQuery === chip.query
                    ? 'bg-emerald-700 text-white font-semibold'
                    : 'bg-slate-100 hover:bg-emerald-100 text-slate-700 border border-slate-200'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-semibold text-slate-600">
            {searchQuery ? (
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Found {filteredMaterials.length} of {materials.length} records for "{searchQuery}"
              </span>
            ) : (
              <span>Showing {filteredMaterials.length} materials</span>
            )}
          </div>
        </div>
      </div>

      {/* Material Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3 w-12">SL</th>
                <th className="px-4 py-3 w-28">Code (কোড নং)</th>
                <th className="px-4 py-3 min-w-[280px]">Material Description (বিনির্দেশ)</th>
                <th className="px-4 py-3 text-center w-14">Unit</th>
                <th className="px-4 py-3 text-center w-36">Annual Usage (20-26)</th>
                <th className="px-4 py-3 text-center w-20">Store Stock</th>
                <th className="px-4 py-3 min-w-[150px]">Last MRR / Unit Price</th>
                <th className="px-4 py-3 text-center w-20">Status</th>
                {isAdmin && <th className="px-4 py-3 text-center w-24">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {paginatedMaterials.length > 0 ? (
                paginatedMaterials.map((mat, idx) => {
                  const globalIndex = itemsPerPage > 0 ? (currentPage - 1) * itemsPerPage + idx + 1 : idx + 1;
                  return (
                    <tr key={mat.id || (mat.master_id ? `MAT-${mat.master_id}` : `${mat.code}-${idx}`)} className="hover:bg-slate-50 transition-colors align-top">
                      <td className="px-4 py-3 text-slate-500 font-normal">{globalIndex}</td>
                      <td className="px-4 py-3 font-mono">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-xs">
                            {mat.code}
                          </span>
                          {(mat.id || mat.master_id) && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded">
                              {mat.id || `MAT-${String(mat.master_id).padStart(4, '0')}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-900 font-normal leading-snug whitespace-pre-wrap">
                          {mat.description}
                        </p>
                        {mat.remarks && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px]">
                            Note: {mat.remarks}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700">
                        {mat.unit}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-[11px] text-slate-600">
                        <div className="space-y-0.5">
                          <div>
                            <span className="text-[10px] text-slate-400">20-23:</span> {mat.usage20_21 || '-'} | {mat.usage21_22 || '-'} | {mat.usage22_23 || '-'}
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400">23-26:</span> {mat.usage23_24 || '-'} | {mat.usage24_25 || '-'} | {mat.usage25_26 || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-800">
                        {mat.storeStock || 'Nil'}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-slate-600 leading-tight">
                        {mat.lastMrrNo || mat.unit_price || mat.unitPrice || mat.lastMrrPrice ? (
                          <div>
                            {mat.lastMrrNo && <div className="font-semibold text-slate-800">{mat.lastMrrNo}</div>}
                            <div className="text-emerald-800 font-bold">
                              {mat.unit_price || mat.unitPrice || mat.lastMrrPrice} {mat.lastMrrDate && <span className="font-normal text-slate-500">• {mat.lastMrrDate}</span>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => isAdmin && handleToggleStatus(mat)}
                          title={isAdmin ? `Status: ${mat.status || 'active'}. Click to toggle Active/Disabled.` : `Status: ${mat.status || 'active'}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                            (mat.status || 'active') === 'active'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                          } ${isAdmin ? 'cursor-pointer hover:shadow-xs' : 'cursor-default'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${mat.status === 'inactive' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {mat.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'}
                        </button>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              id={`edit-mat-${mat.id || mat.code}`}
                              onClick={() => handleOpenEdit(mat)}
                              title="Edit Material / সম্পাদনা করুন"
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              id={`toggle-mat-${mat.id || mat.code}`}
                              onClick={() => handleToggleStatus(mat)}
                              title={mat.status === 'inactive' ? 'Enable / সক্রিয় করুন' : 'Disable / নিষ্ক্রিয় করুন'}
                              className={`p-1.5 rounded transition-colors cursor-pointer border border-transparent ${
                                mat.status === 'inactive'
                                  ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-200'
                                  : 'text-amber-600 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              id={`delete-mat-${mat.id || mat.code}`}
                              onClick={() => handleOpenDeleteModal(mat)}
                              title="Delete or Deactivate Material / মালামাল নিষ্ক্রিয় বা মুছুন"
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-slate-500">
                    No materials found matching your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Summary Footer */}
        <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">
              Showing {totalItems === 0 ? 0 : itemsPerPage > 0 ? (currentPage - 1) * itemsPerPage + 1 : 1} to{' '}
              {itemsPerPage > 0 ? Math.min(currentPage * itemsPerPage, totalItems) : totalItems} of{' '}
              <span className="text-emerald-800 font-bold">{totalItems} Materials</span>
            </span>
            {searchQuery && (
              <span className="text-slate-400 font-normal">
                (filtered from {materials.length} total)
              </span>
            )}
          </div>

          {itemsPerPage > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                id="mat-page-first"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="First Page"
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                id="mat-page-prev"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Previous Page"
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded">
                Page {currentPage} of {totalPages}
              </span>

              <button
                id="mat-page-next"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="Next Page"
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                id="mat-page-last"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                title="Last Page"
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Material Modal */}
      {isModalOpen && editingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                {editingMaterial.id ? 'Edit Material Code' : 'Add New Material to Master'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Material Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="modal-mat-code"
                    type="text"
                    required
                    value={editingMaterial.code || ''}
                    onChange={(e) =>
                      setEditingMaterial((prev) => ({ ...prev!, code: e.target.value }))
                    }
                    placeholder="e.g. 18.14.303"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit (একক)
                  </label>
                  <input
                    id="modal-mat-unit"
                    type="text"
                    value={editingMaterial.unit || 'No'}
                    onChange={(e) =>
                      setEditingMaterial((prev) => ({ ...prev!, unit: e.target.value }))
                    }
                    placeholder="No, Pkt, Kg, Set, Mtr"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={editingMaterial.category || 'Electrical Maintenance'}
                    onChange={(e) =>
                      setEditingMaterial((prev) => ({ ...prev!, category: e.target.value }))
                    }
                    placeholder="e.g. Electrical / Lighting"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status (অবস্থা)
                  </label>
                  <select
                    id="modal-mat-status"
                    value={editingMaterial.status || 'active'}
                    onChange={(e) =>
                      setEditingMaterial((prev) => ({ ...prev!, status: e.target.value as 'active' | 'inactive' }))
                    }
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded font-semibold bg-white"
                  >
                    <option value="active">Active (সক্রিয়)</option>
                    <option value="inactive">Inactive / Disabled (নিষ্ক্রিয়)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Material Description &amp; Technical Specifications <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="modal-mat-desc"
                  rows={3}
                  required
                  value={editingMaterial.description || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({ ...prev!, description: e.target.value }))
                  }
                  placeholder="e.g. LED Flood Light (Complete Set)-200W, 220 ~ 250V AC, 50HZ C/S IP-65, (Industrial grade) 2 Years Warranty card. Brand: Click/Epic/Super Star, BD."
                  className="w-full text-xs p-2 border border-slate-300 rounded"
                />
              </div>

              {/* Historical Usage & Stock Row */}
              <div className="border border-slate-200 p-3 rounded bg-slate-50/50 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Historical Annual Usage &amp; Store Stock
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">20-21 Usage</label>
                    <input
                      type="text"
                      value={editingMaterial.usage20_21 || '-'}
                      onChange={(e) =>
                        setEditingMaterial((prev) => ({ ...prev!, usage20_21: e.target.value }))
                      }
                      className="w-full text-xs text-center p-1 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">21-22 Usage</label>
                    <input
                      type="text"
                      value={editingMaterial.usage21_22 || '-'}
                      onChange={(e) =>
                        setEditingMaterial((prev) => ({ ...prev!, usage21_22: e.target.value }))
                      }
                      className="w-full text-xs text-center p-1 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">22-23 Usage</label>
                    <input
                      type="text"
                      value={editingMaterial.usage22_23 || '-'}
                      onChange={(e) =>
                        setEditingMaterial((prev) => ({ ...prev!, usage22_23: e.target.value }))
                      }
                      className="w-full text-xs text-center p-1 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">23-24 Usage</label>
                    <input
                      type="text"
                      value={editingMaterial.usage23_24 || '-'}
                      onChange={(e) =>
                        setEditingMaterial((prev) => ({ ...prev!, usage23_24: e.target.value }))
                      }
                      className="w-full text-xs text-center p-1 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">24-25 Usage</label>
                    <input
                      type="text"
                      value={editingMaterial.usage24_25 || '-'}
                      onChange={(e) =>
                        setEditingMaterial((prev) => ({ ...prev!, usage24_25: e.target.value }))
                      }
                      className="w-full text-xs text-center p-1 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">25-26 Usage</label>
                    <input
                      type="text"
                      value={editingMaterial.usage25_26 || '-'}
                      onChange={(e) =>
                        setEditingMaterial((prev) => ({ ...prev!, usage25_26: e.target.value }))
                      }
                      className="w-full text-xs text-center p-1 bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-[10px] text-slate-600 font-semibold">Store Stock</label>
                    <input
                      type="text"
                      value={editingMaterial.storeStock || 'Nil'}
                      onChange={(e) =>
                        setEditingMaterial((prev) => ({ ...prev!, storeStock: e.target.value }))
                      }
                      placeholder="Nil"
                      className="w-full text-xs text-center p-1 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-semibold">Pipeline Qty</label>
                    <input
                      type="text"
                      value={editingMaterial.pipelineQty || '-'}
                      onChange={(e) =>
                        setEditingMaterial((prev) => ({ ...prev!, pipelineQty: e.target.value }))
                      }
                      placeholder="-"
                      className="w-full text-xs text-center p-1 bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Previous Purchase History */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last MRR No
                  </label>
                  <input
                    type="text"
                    value={editingMaterial.lastMrrNo || ''}
                    onChange={(e) =>
                      setEditingMaterial((prev) => ({ ...prev!, lastMrrNo: e.target.value }))
                    }
                    placeholder="e.g. MRR-26910"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last MRR Date
                  </label>
                  <input
                    type="text"
                    value={editingMaterial.lastMrrDate || ''}
                    onChange={(e) =>
                      setEditingMaterial((prev) => ({ ...prev!, lastMrrDate: e.target.value }))
                    }
                    placeholder="e.g. 22/10/23"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Price / একক মূল্য (unit_price)
                  </label>
                  <input
                    type="text"
                    value={editingMaterial.unit_price || editingMaterial.unitPrice || editingMaterial.lastMrrPrice || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingMaterial((prev) => ({ 
                        ...prev!, 
                        unit_price: val,
                        unitPrice: val,
                        lastMrrPrice: val 
                      }));
                    }}
                    placeholder="e.g. 8672/- or 350.00"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks / Special Instructions
                </label>
                <input
                  type="text"
                  value={editingMaterial.remarks || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({ ...prev!, remarks: e.target.value }))
                  }
                  placeholder="e.g. Sample Approved, Brand: Click / Super Star, DPM"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <div>
                  {editingMaterial.id && (
                    <button
                      type="button"
                      id="modal-mat-delete-btn"
                      onClick={() => handleOpenDeleteModal(editingMaterial as Material)}
                      className="px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete / Deactivate Material
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
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
                    {isSaving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {isSaving ? 'Saving to Supabase...' : 'Save Material'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete / Deactivate */}
      {confirmDeleteModalMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                মালামাল পরিচালনা / মুছুন বা নিষ্ক্রিয় করুন
              </h3>
              <button
                type="button"
                onClick={() => setConfirmDeleteModalMaterial(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500 font-medium">কোড নং (Material Code):</div>
                <div className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                  {confirmDeleteModalMaterial.code}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-2">বিবরণী (Description):</div>
                <div className="text-xs text-slate-800 font-medium mt-0.5 line-clamp-3">
                  {confirmDeleteModalMaterial.description}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-2.5 flex items-center gap-2">
                  <span>বর্তমান স্ট্যাটাস:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    confirmDeleteModalMaterial.status === 'inactive' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {confirmDeleteModalMaterial.status === 'inactive' ? 'INACTIVE (নিষ্ক্রিয়)' : 'ACTIVE (সক্রিয়)'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600">
                আপনি এই মালামালটি নিষ্ক্রিয় (Disable) করতে চান নাকি সম্পূর্ণ ডাটাবেস থেকে মুছে ফেলতে চান?
              </p>

              <div className="space-y-2">
                {/* Option 1: Disable / Inactivate */}
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => executeDeleteAction(confirmDeleteModalMaterial, false)}
                  className="w-full text-left p-3.5 rounded-lg border border-amber-300 bg-amber-50/80 hover:bg-amber-100 transition-colors flex items-start gap-3 cursor-pointer group disabled:opacity-50"
                >
                  <Power className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-amber-950 group-hover:underline flex items-center gap-1.5">
                      ১. মালামালটি নিষ্ক্রিয় করুন (Deactivate / Disable) - <span>সুপারিশকৃত</span>
                    </div>
                    <div className="text-[11px] text-amber-800 mt-0.5">
                      নতুন কোনো ভাউচার বা এসপিআর-এ এটি আসবে না, কিন্তু অতীতের ভাউচার/এসপিআর রেকর্ড ও ইতিহাস অক্ষত থাকবে।
                    </div>
                  </div>
                </button>

                {/* Option 2: Permanent Delete */}
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => executeDeleteAction(confirmDeleteModalMaterial, true)}
                  className="w-full text-left p-3.5 rounded-lg border border-rose-300 bg-rose-50/80 hover:bg-rose-100 transition-colors flex items-start gap-3 cursor-pointer group disabled:opacity-50"
                >
                  <Trash2 className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-rose-950 group-hover:underline flex items-center gap-1.5">
                      ২. স্থায়ীভাবে মুছে ফেলুন (Permanent Delete)
                    </div>
                    <div className="text-[11px] text-rose-800 mt-0.5">
                      মালামালটি Supabase ডাটাবেস এবং সিস্টেম থেকে চিরতরে মুছে যাবে।
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteModalMaterial(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Cancel (বাতিল)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Import Materials Data (JSON / CSV)</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                সুপাবেজ থেকে এক্সপোর্ট করা JSON বা CSV ডাটা সরাসরি নিচে পেস্ট করে <strong>"Import & Save All"</strong> এ ক্লিক করুন। এটি সরাসরি অ্যাপে ও সার্ভারে সংরক্ষিত হবে।
              </p>

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Paste JSON Array or CSV content:
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Example JSON format:\n[\n  {\n    "code": "18.14.335",\n    "description": "LED Tube light 4' 18W",\n    "unit": "No",\n    "store_stock": "Nil"\n  }\n]`}
                  className="w-full h-48 text-xs p-3 font-mono border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="text-[11px] text-slate-500">
                  সাপোর্টেড ফরম্যাট: JSON Array <code>[...]</code> অথবা CSV টেক্সট
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImportData}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded hover:bg-emerald-700 shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Import & Save All
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

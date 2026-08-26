import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Material, SprItem, SprRecord, User } from '../types';
import { AppStore } from '../services/store';
import { numberToWordsEnglish, numberToWordsBengali, formatCurrencyBDT } from '../utils/numberToWords';
import { TspLogo } from './TspLogo';
import { Plus, Trash2, Save, ArrowLeft, Search, Check, AlertCircle, Sparkles, FileText } from 'lucide-react';
import { searchMaterialsUniversal } from '../utils/materialSearch';
import { getDynamicFiscalYears } from '../utils/fiscalYear';

interface SprFormProps {
  initialSpr?: SprRecord | null;
  currentUser: User;
  onSaveSuccess: (savedSpr: SprRecord) => void;
  onCancel: () => void;
}

// Advanced multi-term, flexible fuzzy search for code and description
function searchMaterialCatalogue(catalogue: Material[], query: string): Material[] {
  return searchMaterialsUniversal(catalogue, query).slice(0, 100);
}

export const SprForm: React.FC<SprFormProps> = ({
  initialSpr,
  currentUser,
  onSaveSuccess,
  onCancel,
}) => {
  const isEditing = Boolean(initialSpr);

  // Dynamic 3 Fiscal Years for Annual Usage (e.g. ['23-24', '24-25', '25-26'] for 2026)
  const fiscalYears = useMemo(() => getDynamicFiscalYears(), []);

  // Form State
  const [sprNo, setSprNo] = useState(initialSpr?.sprNo || AppStore.generateNextSprNo());
  const [refNo, setRefNo] = useState(
    initialSpr?.refNo || `টিএসপি/এমপিআইসি (পিএণ্ড) / ${new Date().getFullYear()}-0${Math.floor(Math.random() * 90 + 10)}`
  );
  const [date, setDate] = useState(initialSpr?.date || new Date().toISOString().split('T')[0]);
  const [fiscalYear, setFiscalYear] = useState(initialSpr?.fiscalYear || '২০২৬-২০২৭ খ্রি.');
  const [procurementType, setProcurementType] = useState(initialSpr?.procurementType || 'স্থানীয়');
  const [subject, setSubject] = useState(initialSpr?.subject || 'বৈদ্যুতিক মালামাল ক্রয়');
  const [department, setDepartment] = useState(initialSpr?.department || currentUser.department || 'Electrical Maintenance');

  // Materials master list for lookup
  const [materials, setMaterials] = useState<Material[]>(() => AppStore.getMaterials());

  // Search dropdown active state (row index + field type: 'code' or 'description' + anchor element)
  const [activeSearch, setActiveSearch] = useState<{
    rowIndex: number;
    field: 'code' | 'description';
    query: string;
    anchorEl: HTMLElement | null;
  } | null>(null);

  // Dropdown portal coordinates (always positioned directly below anchorEl)
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!activeSearch?.anchorEl) {
      setDropdownCoords(null);
      return;
    }

    const updatePosition = () => {
      if (!activeSearch.anchorEl) return;
      const rect = activeSearch.anchorEl.getBoundingClientRect();
      const desiredWidth = activeSearch.field === 'code' ? Math.max(rect.width, 480) : Math.max(rect.width, 520);
      const width = Math.min(desiredWidth, window.innerWidth - 32);
      const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
      setDropdownCoords({
        top: rect.bottom + 4,
        left,
        width,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [activeSearch]);

  // Items State
  const [items, setItems] = useState<SprItem[]>(() => {
    if (initialSpr && initialSpr.items.length > 0) {
      return initialSpr.items.map((it) => {
        const usageByYear: Record<string, string> = { ...(it.usageByYear || {}) };
        fiscalYears.forEach((fy) => {
          if (usageByYear[fy] === undefined) {
            usageByYear[fy] = it[fy] || it[`usage_${fy.replace('-', '_')}`] || it[`usage${fy.replace('-', '_')}`] || '-';
          }
        });
        return { ...it, usageByYear };
      });
    }
    // Default initial row with empty or first material
    const initUsage: Record<string, string> = {};
    fiscalYears.forEach((fy) => {
      initUsage[fy] = '-';
    });

    return [
      {
        id: 'item_init_1',
        sl: 1,
        code: '',
        description: '',
        unit: 'No',
        usageByYear: initUsage,
        storeStock: 'Nil',
        pipelineQty: '-',
        requiredQty: 1,
        unitPrice: 0,
        total: 0,
        eda: '',
        previousPurchase: '',
        remarks: '',
      },
    ];
  });

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch materials on mount and subscribe to realtime updates
  useEffect(() => {
    let isMounted = true;
    AppStore.fetchMaterialsFromSupabase().then((res: any) => {
      if (isMounted) {
        const matList = Array.isArray(res) ? res : res?.materials;
        if (matList && matList.length > 0) {
          setMaterials(matList);
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

  // Close search dropdown on Escape key or clicking outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveSearch(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest('#spr-search-dropdown-portal') ||
        target.closest('[id^="spr-item-code-"]') ||
        target.closest('[id^="spr-item-desc-"]')
      ) {
        return;
      }
      setActiveSearch(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const portalSearchResults = useMemo(() => {
    if (!activeSearch || !activeSearch.query || !activeSearch.query.trim()) return [];
    return searchMaterialCatalogue(materials, activeSearch.query);
  }, [activeSearch, materials]);

  // Calculate live Grand Total & In-Words
  const grandTotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const q = typeof it.requiredQty === 'string' ? parseFloat(it.requiredQty) || 0 : it.requiredQty || 0;
      const p = typeof it.unitPrice === 'string' ? parseFloat(it.unitPrice) || 0 : it.unitPrice || 0;
      return sum + Math.round(q * p * 100) / 100;
    }, 0);
  }, [items]);

  const inWords = useMemo(() => numberToWordsEnglish(grandTotal), [grandTotal]);
  const inWordsBn = useMemo(() => numberToWordsBengali(grandTotal), [grandTotal]);

  // Update item field
  const handleItemChange = (index: number, field: keyof SprItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const current = { ...copy[index], [field]: value };

      // If quantity or unit price changed, recalculate row total
      if (field === 'requiredQty' || field === 'unitPrice') {
        const q = field === 'requiredQty' ? (typeof value === 'string' ? parseFloat(value) || 0 : value || 0) : typeof current.requiredQty === 'string' ? parseFloat(current.requiredQty) || 0 : current.requiredQty || 0;
        const p = field === 'unitPrice' ? (typeof value === 'string' ? parseFloat(value) || 0 : value || 0) : typeof current.unitPrice === 'string' ? parseFloat(current.unitPrice) || 0 : current.unitPrice || 0;
        current.total = Math.round(q * p * 100) / 100;
      }

      copy[index] = current;
      return copy;
    });
  };

  // Update dynamic annual usage field
  const handleUsageChange = (index: number, fy: string, value: string) => {
    setItems((prev) => {
      const copy = [...prev];
      const current = copy[index];
      copy[index] = {
        ...current,
        usageByYear: {
          ...(current.usageByYear || {}),
          [fy]: value,
        },
      };
      return copy;
    });
  };

  // Helper to cleanly parse numeric unit price from strings like "Tk-28.46", "Tk-8240/-", "8240", etc.
  const parsePriceNumber = (priceStr?: string | null): number => {
    if (!priceStr || priceStr === '-') return 0;
    const cleaned = priceStr.replace(/,/g, '').replace(/[^\d.]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  };

  // Populate row from Material Master and load usage from public.material_usage
  const handleSelectMaterial = async (index: number, mat: Material) => {
    const priceSource = mat.unit_price !== undefined && mat.unit_price !== null && mat.unit_price !== '' 
      ? String(mat.unit_price) 
      : (mat.unitPrice !== undefined && mat.unitPrice !== null && mat.unitPrice !== '' ? String(mat.unitPrice) : (mat.lastMrrPrice || ''));

    const prevRef = [
      mat.lastMrrNo ? `${mat.lastMrrNo}` : '',
      mat.lastMrrDate ? `Date :${mat.lastMrrDate}` : '',
      priceSource ? (priceSource.includes('Tk') ? priceSource : `Tk-${priceSource}`) : '',
    ]
      .filter(Boolean)
      .join(' ');

    const finalPreviousPurchase = mat.previous_purchase_order_date_price || prevRef || '-';

    // Extract numeric unit price directly from selected material's unit_price / lastMrrPrice
    const parsedPrice = parsePriceNumber(priceSource);
    const unitPrice = parsedPrice > 0 ? parsedPrice : 0;

    const q = typeof items[index]?.requiredQty === 'string' ? parseFloat(items[index].requiredQty as string) || 1 : items[index]?.requiredQty || 1;
    const p = typeof unitPrice === 'string' ? parseFloat(unitPrice) || 0 : unitPrice;

    // Initialize with direct material record usage for the 3 dynamic fiscal years
    const initialUsage: Record<string, string> = {};
    fiscalYears.forEach((fy) => {
      initialUsage[fy] =
        mat[fy] ||
        mat[`usage_${fy.replace('-', '_')}`] ||
        mat[`usage${fy.replace('-', '_')}`] ||
        '-';
    });

    setItems((prev) => {
      const copy = [...prev];
      const current = copy[index];

      copy[index] = {
        ...current,
        code: mat.material_code || mat.code || '',
        description: mat.material_description || mat.description || '',
        unit: mat.unit || 'No',
        usageByYear: initialUsage,
        storeStock: mat.store_stock || mat.storeStock || 'Nil',
        pipelineQty: mat.pipelineQty || '-',
        unitPrice: p,
        total: Math.round(q * p * 100) / 100,
        previousPurchase: finalPreviousPurchase,
        remarks: mat.remarks || current.remarks || '',
        materialId: mat.id,
      };
      return copy;
    });

    setActiveSearch(null);

    // Query public.material_usage dynamically matching material_id with master_id
    try {
      const masterId = mat.master_id ?? mat.id;
      const usageMap = await AppStore.getMaterialUsage(masterId, fiscalYears);
      setItems((prev) => {
        const copy = [...prev];
        if (copy[index]) {
          copy[index] = {
            ...copy[index],
            usageByYear: {
              ...(copy[index].usageByYear || {}),
              ...usageMap,
            },
          };
        }
        return copy;
      });
    } catch (err) {
      console.warn('Error fetching usage from public.material_usage:', err);
    }
  };

  // Quick add non-existent material directly into catalogue and row
  const handleQuickAddMaterial = async (
    rowIndex: number,
    query: string,
    field: 'code' | 'description'
  ) => {
    const currentItem = items[rowIndex];
    const newCode = field === 'code' ? query.trim() : (currentItem.code.trim() || 'New');
    const newDesc = field === 'description' ? query.trim() : (currentItem.description.trim() || query.trim());

    const newMatPayload: Partial<Material> = {
      code: newCode,
      description: newDesc,
      unit: currentItem.unit || 'No',
      storeStock: currentItem.storeStock || 'Nil',
      pipelineQty: currentItem.pipelineQty || '-',
      lastMrrPrice: currentItem.unitPrice ? `Tk-${currentItem.unitPrice}/-` : '',
      status: 'active',
      category: department || 'General',
    };

    try {
      const saved = await AppStore.saveMaterial(newMatPayload);
      const allMats = AppStore.getMaterials();
      setMaterials(allMats);
      handleSelectMaterial(rowIndex, saved);
    } catch (err: any) {
      console.warn('Quick add error:', err);
      handleItemChange(rowIndex, field, query);
      setActiveSearch(null);
    }
  };

  // Add new item row
  const handleAddItem = () => {
    const initUsage: Record<string, string> = {};
    fiscalYears.forEach((fy) => {
      initUsage[fy] = '-';
    });

    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sl: prev.length + 1,
        code: '',
        description: '',
        unit: 'No',
        usageByYear: initUsage,
        storeStock: 'Nil',
        pipelineQty: '-',
        requiredQty: 1,
        unitPrice: 0,
        total: 0,
        eda: '',
        previousPurchase: '',
        remarks: '',
      },
    ]);
  };

  // Remove item row
  const handleDeleteItem = (index: number) => {
    if (items.length <= 1) {
      alert('An SPR must have at least one item.');
      return;
    }
    setItems((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((it, idx) => ({ ...it, sl: idx + 1 }));
    });
  };

  // Save SPR handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!sprNo.trim()) {
      setErrorMessage('SPR No is required.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Please add at least one material item.');
      return;
    }

    const invalidItem = items.find((it) => !it.description.trim());
    if (invalidItem) {
      setErrorMessage(`Please provide a description for item #${invalidItem.sl}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const sprPayload: Partial<SprRecord> = {
        ...(initialSpr || {}),
        sprNo: sprNo.trim(),
        refNo: refNo.trim(),
        date,
        fiscalYear: fiscalYear.trim(),
        procurementType,
        subject: subject.trim(),
        department: department.trim(),
        preparedBy: (isEditing && initialSpr?.preparedBy ? initialSpr.preparedBy : (currentUser.name || '')).trim(),
        preparedByUserId: (isEditing && initialSpr?.preparedByUserId ? initialSpr.preparedByUserId : (currentUser.userId || '')).trim(),
        preparedByEmail: (isEditing && initialSpr?.preparedByEmail ? initialSpr.preparedByEmail : (currentUser.email || '')).trim(),
        items,
        grandTotal,
        inWords,
        inWordsBn,
        status: initialSpr?.status || 'submitted',
      };

      const saved = await AppStore.saveSpr(sprPayload);
      onSaveSuccess(saved);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save SPR.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-none mx-auto pb-10 px-1 sm:px-2">
      {/* Header Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            id="spr-form-back-btn"
            type="button"
            onClick={onCancel}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              {isEditing ? `Edit SPR (${initialSpr?.sprNo})` : 'New SPR Entry (মালামাল ক্রয়ের অধিযাচন পত্র)'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Fill out the required quantities and prices. Materials auto-populate from the Master catalogue with instant live search.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="spr-form-cancel-btn"
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="spr-form-save-btn"
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Save SPR'}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-md flex items-center gap-2 text-rose-700 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Form Container simulating the Word Layout */}
      <form onSubmit={handleSave} className="bg-white p-3 sm:p-5 border border-slate-300 rounded-lg shadow-sm w-full">
        {/* Document Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start border-b border-slate-300 pb-5 mb-5">
          {/* Left Fields */}
          <div className="md:col-span-4 space-y-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                সূত্র নং (Ref No)
              </label>
              <input
                id="spr-input-ref-no"
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="টিএসপি/এমপিআইসি (পিএণ্ড) / ২০২৬-০১৩"
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SPR No <span className="text-rose-500">*</span>
                </label>
                <input
                  id="spr-input-spr-no"
                  type="text"
                  required
                  value={sprNo}
                  onChange={(e) => setSprNo(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  তারিখ (Date)
                </label>
                <input
                  id="spr-input-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-md border border-slate-200">
              <span className="font-semibold text-slate-800">Prepared By:</span>
              <span className="font-medium text-slate-900">
                {isEditing && initialSpr?.preparedBy ? initialSpr.preparedBy : currentUser.name}
              </span>
              <span className="font-mono bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[10.5px]">
                {isEditing && initialSpr?.preparedByUserId ? initialSpr.preparedByUserId : currentUser.userId}
              </span>
            </div>
          </div>

          {/* Center TSP Brand */}
          <div className="md:col-span-4 flex flex-col items-center text-center">
            <TspLogo size={48} className="mb-1" />
            <h2 className="text-sm sm:text-base font-bold text-slate-950">
              টিএসপি কমপ্লেক্স লিঃ
            </h2>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-wider">
              TSP COMPLEX LTD.
            </h3>
            <p className="text-[11px] font-semibold text-slate-700">
              A COMPANY OF BCIC
            </p>
            <p className="text-[10.5px] text-slate-600">
              পতেঙ্গা, চট্টগ্রাম-৪২০৪
            </p>
            <div className="mt-1.5 bg-slate-100 text-slate-950 px-3 py-0.5 rounded text-xs font-bold border border-slate-300">
              মালামাল ক্রয়ের অধিযাচন পত্র (এসপিআর)
            </div>
          </div>

          {/* Right Parameters */}
          <div className="md:col-span-4 space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ক্রয়ের ধরন (Procurement)
                </label>
                <select
                  id="spr-select-procurement"
                  value={procurementType}
                  onChange={(e) => setProcurementType(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="স্থানীয়">স্থানীয় (Local)</option>
                  <option value="বৈদেশিক">বৈদেশিক (Foreign)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বৎসর (Fiscal Year)
                </label>
                <select
                  id="spr-select-fiscal-year"
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="২০২৪-২০২৫ খ্রি.">২০২৪-২০২৫ খ্রি.</option>
                  <option value="২০২৫-২০২৬ খ্রি.">২০২৫-২০২৬ খ্রি.</option>
                  <option value="২০২৬-২০২৭ খ্রি.">২০২৬-২০২৭ খ্রি.</option>
                  <option value="২০২৭-২০২৮ খ্রি.">২০২৭-২০২৮ খ্রি.</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রসঙ্গ (Subject)
              </label>
              <input
                id="spr-input-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="বৈদ্যুতিক মালামাল ক্রয়"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                বিভাগ (Department)
              </label>
              <select
                id="spr-select-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              >
                <option value="Electrical Maintenance">Electrical Maintenance (বৈদ্যুতিক)</option>
                <option value="Mechanical Division">Mechanical Division (যান্ত্রিক)</option>
                <option value="Instrumentation & Control">Instrumentation &amp; Control (ইন্সট্রুমেন্ট)</option>
                <option value="Chemical Production (TSP Plant)">Chemical Production (টিএসপি প্ল্যান্ট)</option>
                <option value="Civil Engineering">Civil Engineering (পূর্ত)</option>
                <option value="Workshop & Heavy Machine">Workshop &amp; Heavy Machine (ওয়ার্কশপ)</option>
                <option value="Store & Inventory">Store &amp; Inventory (ভান্ডার)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 14-Column Responsive Large Table */}
        <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-xs">
          <table className="spr-table w-full">
            <thead>
              <tr className="bg-slate-100 text-slate-900 text-xs">
                <th rowSpan={2} className="w-9 min-w-[34px] max-w-[38px] text-center py-2 px-1">ক্র/ নং</th>
                <th rowSpan={2} className="w-32 min-w-[125px] max-w-[145px] text-left py-2 px-2">কোড নং / Search</th>
                <th rowSpan={2} className="min-w-[420px] lg:min-w-[540px] text-left py-2 px-3">মালামালের বিনির্দেশ (Description)</th>
                <th rowSpan={2} className="w-12 min-w-[44px] max-w-[52px] text-center py-2 px-1">একক</th>
                <th colSpan={fiscalYears.length} className="text-center py-1 px-0.5 bg-slate-200/70 text-[10.5px]">
                  বাৎসরিক ব্যবহার
                </th>
                <th rowSpan={2} className="w-14 min-w-[48px] max-w-[58px] text-center py-2 px-1">সরবরাহের মজুদ</th>
                <th rowSpan={2} className="w-12 min-w-[44px] max-w-[52px] text-center py-2 px-1">পাইপ লাইন</th>
                <th rowSpan={2} className="w-16 min-w-[58px] max-w-[68px] bg-emerald-100 text-emerald-950 font-bold border-emerald-400 py-2 px-1">
                  বর্তমান প্রয়োজন *
                </th>
                <th colSpan={2} className="text-center py-1 px-1 bg-slate-200/70">
                  আনুমানিক মূল্য (টাকা)
                </th>
                <th rowSpan={2} className="w-16 min-w-[56px] max-w-[68px] text-center py-2 px-1">ইডিএ</th>
                <th rowSpan={2} className="w-56 min-w-[220px] lg:min-w-[260px] text-left py-2 px-2">বিগত ক্রয়াদেশ নং/তাং/মূল্য</th>
                <th rowSpan={2} className="w-24 min-w-[90px] max-w-[120px] text-left py-2 px-2">মন্তব্য</th>
                <th rowSpan={2} className="w-9 min-w-[34px] max-w-[38px] text-center py-2 px-1 no-print">Action</th>
              </tr>
              <tr className="bg-slate-100 text-slate-900 text-xs">
                {fiscalYears.map((fy) => (
                  <th key={fy} className="w-10 min-w-[34px] max-w-[40px] font-medium text-[10px] py-1 px-0.5">
                    {fy}
                  </th>
                ))}
                <th className="w-16 min-w-[62px] max-w-[74px] font-bold bg-emerald-100 text-emerald-950 border-emerald-400 py-1 px-1">
                  একক মূল্য *
                </th>
                <th className="w-20 min-w-[72px] max-w-[86px] font-bold bg-slate-200/80 py-1 px-1">মোট মূল্য</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {items.map((item, idx) => {
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 align-top transition-colors">
                    {/* SL */}
                    <td className="text-center font-bold pt-3 text-slate-700 w-9 min-w-[34px] max-w-[38px]">{idx + 1}</td>

                    {/* Code & Search Selector */}
                    <td className="p-1.5 w-32 min-w-[125px] max-w-[145px]">
                      <div className="flex flex-col gap-1">
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                            <Search className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <input
                            id={`spr-item-code-${idx}`}
                            type="text"
                            value={item.code}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleItemChange(idx, 'code', val);
                              setActiveSearch({ rowIndex: idx, field: 'code', query: val, anchorEl: e.currentTarget });
                            }}
                            onFocus={(e) => {
                              setActiveSearch({ rowIndex: idx, field: 'code', query: item.code, anchorEl: e.currentTarget });
                            }}
                            placeholder="Code..."
                            className="w-full text-xs font-mono font-bold pl-7 pr-1 py-1.5 bg-emerald-50/30 border border-emerald-300 rounded-md focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-2xs"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Description & Search Autocomplete */}
                    <td className="p-1.5 min-w-[420px] lg:min-w-[540px]">
                      <div className="flex flex-col gap-1">
                        <div className="relative">
                          <textarea
                            id={`spr-item-desc-${idx}`}
                            rows={2}
                            value={item.description}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleItemChange(idx, 'description', val);
                              setActiveSearch({ rowIndex: idx, field: 'description', query: val, anchorEl: e.currentTarget });
                            }}
                            onFocus={(e) => {
                              setActiveSearch({ rowIndex: idx, field: 'description', query: item.description, anchorEl: e.currentTarget });
                            }}
                            placeholder="Material specification or search catalogue..."
                            className="w-full text-xs p-2 border border-slate-300 rounded-md focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y bg-white font-medium leading-relaxed"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Unit */}
                    <td className="p-1 w-12 min-w-[44px] max-w-[52px]">
                      <input
                        id={`spr-item-unit-${idx}`}
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        className="w-full text-xs font-medium text-center py-1.5 px-0.5 border border-slate-300 rounded-md focus:border-emerald-500 focus:outline-none"
                      />
                    </td>

                    {/* Dynamic Annual Usage Columns (e.g. 23-24, 24-25, 25-26) */}
                    {fiscalYears.map((fy) => (
                      <td key={fy} className="p-0.5 w-10 min-w-[34px] max-w-[40px]">
                        <input
                          id={`spr-item-usage-${fy}-${idx}`}
                          type="text"
                          value={item.usageByYear?.[fy] ?? '-'}
                          onChange={(e) => handleUsageChange(idx, fy, e.target.value)}
                          className="w-full text-[10px] text-center py-1.5 px-0.5 border border-slate-200 rounded-md bg-slate-50 font-mono font-medium"
                        />
                      </td>
                    ))}

                    {/* Store Stock */}
                    <td className="p-1 w-14 min-w-[48px] max-w-[58px]">
                      <input
                        type="text"
                        value={item.storeStock}
                        onChange={(e) => handleItemChange(idx, 'storeStock', e.target.value)}
                        placeholder="Nil"
                        className="w-full text-xs text-center py-1.5 px-0.5 border border-slate-300 rounded-md bg-slate-50 font-medium"
                      />
                    </td>

                    {/* Pipeline Qty */}
                    <td className="p-1 w-12 min-w-[44px] max-w-[52px]">
                      <input
                        type="text"
                        value={item.pipelineQty}
                        onChange={(e) => handleItemChange(idx, 'pipelineQty', e.target.value)}
                        placeholder="-"
                        className="w-full text-xs text-center py-1.5 px-0.5 border border-slate-300 rounded-md bg-slate-50 font-medium"
                      />
                    </td>

                    {/* Required Quantity (HIGHLIGHTED USER INPUT) */}
                    <td className="p-1 w-16 min-w-[58px] max-w-[68px] bg-emerald-50/50">
                      <input
                        id={`spr-item-qty-${idx}`}
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={item.requiredQty}
                        onChange={(e) => handleItemChange(idx, 'requiredQty', e.target.value)}
                        className="w-full text-xs font-bold text-emerald-900 text-center py-1.5 px-0.5 border-2 border-emerald-400 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-2xs"
                      />
                    </td>

                    {/* Unit Price (HIGHLIGHTED USER INPUT - SMALLER) */}
                    <td className="p-1 w-16 min-w-[62px] max-w-[74px] bg-emerald-50/50">
                      <input
                        id={`spr-item-price-${idx}`}
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        className="w-full text-xs font-mono font-bold text-right py-1.5 px-1 border-2 border-emerald-400 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-2xs"
                      />
                    </td>

                    {/* Total (AUTOMATIC LIVE CALCULATION - SMALLER) */}
                    <td className="p-1 w-20 min-w-[72px] max-w-[86px] bg-slate-100 font-mono font-bold text-right text-xs pr-1.5 pt-3 text-slate-900">
                      {formatCurrencyBDT(item.total)}/-
                    </td>

                    {/* EDA */}
                    <td className="p-1 w-16 min-w-[56px] max-w-[68px]">
                      <input
                        type="text"
                        value={item.eda}
                        onChange={(e) => handleItemChange(idx, 'eda', e.target.value)}
                        placeholder="15 Days"
                        className="w-full text-[10.5px] text-center py-1.5 px-0.5 border border-slate-300 rounded-md"
                      />
                    </td>

                    {/* Previous Purchase Ref */}
                    <td className="p-1 w-56 min-w-[220px] lg:min-w-[260px]">
                      <input
                        type="text"
                        value={item.previousPurchase}
                        onChange={(e) => handleItemChange(idx, 'previousPurchase', e.target.value)}
                        placeholder="MRR No, Date, Tk"
                        className="w-full text-xs font-mono py-1.5 px-2 border border-slate-300 rounded-md focus:border-emerald-500 focus:outline-none bg-white font-medium"
                      />
                    </td>

                    {/* Remarks */}
                    <td className="p-1 w-24 min-w-[90px] max-w-[120px]">
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                        placeholder="Remarks"
                        className="w-full text-xs py-1.5 px-1 border border-slate-300 rounded-md"
                      />
                    </td>

                    {/* Delete Action */}
                    <td className="p-1 w-9 min-w-[34px] max-w-[38px] text-center pt-2.5">
                      <button
                        id={`spr-delete-item-${idx}`}
                        type="button"
                        onClick={() => handleDeleteItem(idx)}
                        title="Remove row"
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Grand Total Row */}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <td colSpan={11} className="text-right pr-4 py-2.5 text-xs uppercase text-slate-800">
                  Total = (with vat &amp; tax) :
                </td>
                <td className="text-right pr-1.5 py-2.5 font-mono text-sm text-emerald-800">
                  ৳ {formatCurrencyBDT(grandTotal)}/-
                </td>
                <td colSpan={4} className="no-print"></td>
              </tr>

              {/* In Words Row */}
              <tr className="bg-white">
                <td colSpan={16} className="p-3.5 text-xs border-t-2 border-slate-300">
                  <div className="space-y-1.5">
                    <p className="flex items-baseline gap-2">
                      <span className="font-bold text-slate-900">In words :</span>
                      <span className="italic font-medium text-slate-800 text-sm">
                        {inWords}
                      </span>
                    </p>
                    <p className="flex items-baseline gap-2 text-slate-700">
                      <span className="font-semibold text-slate-900">কথায় :</span>
                      <span className="font-medium text-sm">
                        {inWordsBn}
                      </span>
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Add Row Button & Bottom Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            id="spr-add-item-btn"
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-md hover:bg-emerald-100 active:bg-emerald-200 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + Add Item (নতুন মালামাল যোগ করুন)
          </button>

          <div className="flex items-center gap-3">
            <button
              id="spr-form-bottom-cancel-btn"
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="spr-form-bottom-save-btn"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Save SPR'}
            </button>
          </div>
        </div>
      </form>

      {/* Global Portal-based Material Search Dropdown - Always opens directly BELOW the search field and extends downward into the page space */}
      {activeSearch && activeSearch.anchorEl && dropdownCoords && activeSearch.query && activeSearch.query.trim().length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          id="spr-search-dropdown-portal"
          style={{
            position: 'fixed',
            top: `${dropdownCoords.top}px`,
            left: `${dropdownCoords.left}px`,
            width: `${dropdownCoords.width}px`,
            zIndex: 99999,
          }}
          className="bg-white border border-slate-300 rounded-lg shadow-2xl overflow-hidden text-left text-xs ring-1 ring-slate-900/15 transition-none animate-in fade-in-50 duration-100"
        >
          {/* Header Bar */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-semibold text-slate-700 shadow-xs">
            <span className="flex items-center gap-1.5 text-slate-800">
              <Search className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {portalSearchResults.length > 0
                  ? `${portalSearchResults.length} matching material${portalSearchResults.length !== 1 ? 's' : ''}`
                  : 'No matches'}
              </span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveSearch(null);
              }}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              title="Close search (Esc)"
            >
              ✕
            </button>
          </div>

          {/* Results List: 1-5 results show all at once with NO internal scrollbar; 6+ results activate scrollbar */}
          <div
            className={`divide-y divide-slate-100 ${
              portalSearchResults.length > 5 ? 'max-h-[460px] overflow-y-auto' : ''
            }`}
          >
            {portalSearchResults.length > 0 ? (
              portalSearchResults.map((mat, sIdx) => {
                const displayMasterId = mat.id || (mat.master_id !== undefined ? `MAT-${String(mat.master_id).padStart(4, '0')}` : '');
                const priceVal = mat.unit_price || mat.unitPrice || mat.lastMrrPrice;
                return (
                  <button
                    key={mat.id || `${mat.code}-${mat.master_id || sIdx}`}
                    type="button"
                    onClick={() => {
                      handleSelectMaterial(activeSearch.rowIndex, mat);
                      setActiveSearch(null);
                    }}
                    className="w-full text-left p-2.5 sm:p-3 hover:bg-emerald-50/90 transition-colors flex flex-col gap-1 cursor-pointer border-l-4 border-transparent hover:border-emerald-600 focus:bg-emerald-50 focus:outline-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded text-xs">
                          {mat.material_code || mat.code}
                        </span>
                        {displayMasterId && (
                          <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            Master ID: {displayMasterId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-semibold border border-slate-200">
                          Unit: {mat.unit || 'No'}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 leading-snug">
                      {mat.material_description || mat.description}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono pt-1 border-t border-slate-100">
                      <span>
                        Stock: <strong className="text-slate-800">{mat.store_stock || mat.storeStock || 'Nil'}</strong>
                      </span>
                      {priceVal && (
                        <span className="text-emerald-700 font-bold">
                          Price: {priceVal} {mat.lastMrrDate ? `(${mat.lastMrrDate})` : ''}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-slate-500 text-center text-xs">
                No matching material found
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

import { User, Material, SprRecord, SprItem, RealtimeEvent } from '../types';
import { numberToWordsEnglish, numberToWordsBengali } from '../utils/numberToWords';
import { supabase } from './supabaseClient';
import { TSP_254_MATERIALS } from './materialsDataset';
import { searchMaterialsUniversal } from '../utils/materialSearch';

const STORAGE_KEYS = {
  USERS: 'tsp_spr_users_v1',
  MATERIALS: 'tsp_spr_materials_v1',
  SPRS: 'tsp_spr_records_v1',
  CURRENT_USER: 'tsp_spr_current_user_v1',
};

// Cross-tab broadcast channel for instant local tab sync
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('tsp_spr_realtime_sync')
  : null;

const CLIENT_ID = Math.random().toString(36).substring(2, 9);

// Default seed users
const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin_01',
    userId: 'USER-001',
    username: 'jalel',
    name: 'Engr. Jalel Ahmed',
    email: 'admin@tsp.gov.bd',
    role: 'admin',
    department: 'Electrical Maintenance',
    designation: 'Executive Engineer (Electrical)',
    status: 'active',
    password: 'admin',
    createdAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 'usr_normal_02',
    userId: 'USER-002',
    username: 'rubel',
    name: 'Md. Rubel Hossain',
    email: 'rubelctg1237@gmail.com',
    role: 'admin',
    department: 'Electrical Maintenance',
    designation: 'Assistant Engineer (Electrical)',
    status: 'active',
    password: 'user123',
    createdAt: '2026-02-10T10:30:00Z',
  },
  {
    id: 'usr_normal_03',
    userId: 'USER-003',
    username: 'kamrul',
    name: 'Kamrul Islam',
    email: 'kamrul@tsp.gov.bd',
    role: 'user',
    department: 'Mechanical Division',
    designation: 'Sub-Assistant Engineer',
    status: 'active',
    password: 'user123',
    createdAt: '2026-03-01T11:00:00Z',
  },
  {
    id: 'usr_normal_04',
    userId: 'USER-004',
    username: 'nasir',
    name: 'Nasir Uddin',
    email: 'nasir.store@tsp.gov.bd',
    role: 'user',
    department: 'Store & Inventory (ভান্ডার)',
    designation: 'Store Officer',
    status: 'active',
    password: 'user123',
    createdAt: '2026-04-12T08:15:00Z',
  },
];

// Helper: Convert Material model to Supabase materials table record
export function mapMaterialToSupabase(mat: Partial<Material>): any {
  const priceVal = mat.unit_price || mat.unitPrice || mat.lastMrrPrice || '';
  const mrrNo = mat.lastMrrNo || '';
  const mrrDate = mat.lastMrrDate || '';
  let prevPurchase = mat.previous_purchase_order_date_price || '';
  if (!prevPurchase && (mrrNo || mrrDate || priceVal)) {
    prevPurchase = `${mrrNo} | Date-${mrrDate} | ${priceVal}`;
  }

  let masterIdStr = '';
  if (typeof mat.id === 'string' && mat.id.startsWith('MAT-')) {
    masterIdStr = mat.id.trim();
  } else if (typeof mat.master_id === 'string' && mat.master_id.startsWith('MAT-')) {
    masterIdStr = mat.master_id.trim();
  } else if (mat.master_id !== undefined && mat.master_id !== null && !isNaN(Number(mat.master_id))) {
    masterIdStr = `MAT-${String(mat.master_id).padStart(4, '0')}`;
  } else if (typeof mat.id === 'string' && !isNaN(Number(mat.id))) {
    masterIdStr = `MAT-${String(mat.id).padStart(4, '0')}`;
  } else {
    masterIdStr = `MAT-${Date.now()}`;
  }

  return {
    master_id: masterIdStr,
    material_code: (mat.code || mat.material_code || 'New').trim(),
    material_description: (mat.description || mat.material_description || '').trim(),
    unit: mat.unit || 'No',
    status: mat.status === 'inactive' ? 'inactive' : 'active',
    review_flag: mat.review_flag ?? null,
    source: mat.source || 'TSP System',
    store_stock: mat.store_stock || mat.storeStock || 'Nil',
    estimated_receipt_time_eba: mat.estimated_receipt_time_eba || null,
    previous_purchase_order_date_price: prevPurchase || null,
    remarks: mat.remarks || '',
  };
}

// Helper: Convert Supabase materials row to frontend Material model
export function mapSupabaseToMaterial(row: any): Material {
  const masterId = row.master_id ?? row.id;
  const idStr = typeof masterId === 'string' && masterId.startsWith('MAT-')
    ? masterId
    : (masterId !== undefined && masterId !== null ? `MAT-${String(masterId).padStart(4, '0')}` : `mat_${Math.random().toString(36).substr(2, 6)}`);
  const priceVal = row.unit_price || row.unitPrice || row.last_mrr_price || row.lastMrrPrice || '';

  // Extract from previous_purchase_order_date_price if present (e.g., "MRR-27617 | Date-14/10/25 | Tk-74.40/-")
  let parsedMrrNo = row.last_mrr_no || row.lastMrrNo || '';
  let parsedMrrDate = row.last_mrr_date || row.lastMrrDate || '';
  let parsedMrrPrice = row.last_mrr_price || row.lastMrrPrice || (priceVal ? (String(priceVal).includes('Tk') ? String(priceVal) : `Tk-${priceVal}`) : '');

  if (row.previous_purchase_order_date_price && (!parsedMrrNo || !parsedMrrDate)) {
    const parts = String(row.previous_purchase_order_date_price).split('|').map((p) => p.trim());
    if (parts[0] && !parsedMrrNo) parsedMrrNo = parts[0];
    if (parts[1] && !parsedMrrDate) parsedMrrDate = parts[1].replace(/^(DT-|Date-)/i, '').trim();
    if (parts[2] && !parsedMrrPrice) parsedMrrPrice = parts[2];
  }

  return {
    id: idStr,
    master_id: idStr,
    code: (row.material_code || row.code || '').trim(),
    material_code: (row.material_code || row.code || '').trim(),
    description: (row.material_description || row.description || '').trim(),
    material_description: (row.material_description || row.description || '').trim(),
    unit: row.unit || 'No',
    usage20_21: row.usage20_21 || row.usage_20_21 || '-',
    usage21_22: row.usage21_22 || row.usage_21_22 || '-',
    usage22_23: row.usage22_23 || row.usage_22_23 || '-',
    usage23_24: row.usage23_24 || row.usage_23_24 || '-',
    usage24_25: row.usage24_25 || row.usage_24_25 || '-',
    usage25_26: row.usage25_26 || row.usage_25_26 || '-',
    storeStock: row.store_stock || row.storeStock || 'Nil',
    store_stock: row.store_stock || row.storeStock || 'Nil',
    pipelineQty: row.pipeline_qty || row.pipelineQty || '-',
    lastMrrNo: parsedMrrNo,
    lastMrrDate: parsedMrrDate,
    lastMrrPrice: parsedMrrPrice || priceVal,
    unit_price: priceVal || parsedMrrPrice,
    unitPrice: priceVal || parsedMrrPrice,
    previous_purchase_order_date_price: row.previous_purchase_order_date_price || (parsedMrrNo ? `${parsedMrrNo} | Date-${parsedMrrDate} | ${priceVal || parsedMrrPrice}` : ''),
    remarks: row.remarks || '',
    category: row.category || 'General',
    review_flag: row.review_flag || null,
    source: row.source || 'TSP Supabase',
    status: (row.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export class AppStore {
  private static listeners: Array<(event: RealtimeEvent) => void> = [];
  private static isInitialized = false;
  private static sseSource: EventSource | null = null;
  private static realtimeChannel: any = null;
  private static syncStatus: 'connected' | 'connecting' | 'error' | 'rls_restricted' = 'connecting';
  private static isSyncingFlag = false;
  private static lastSyncMessage = '';
  private static lastSyncCount = 0;

  public static init() {
    if (typeof window === 'undefined') return;
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Fallback local caches
    const cachedUsersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!cachedUsersRaw) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    } else {
      try {
        const parsed: User[] = JSON.parse(cachedUsersRaw);
        let updated = false;
        parsed.forEach((p) => {
          if (!p.username) {
            if (p.userId === 'USER-001' || p.email === 'admin@tsp.gov.bd') {
              p.username = 'jalel';
              updated = true;
            } else if (p.userId === 'USER-002' || p.email === 'rubelctg1237@gmail.com') {
              p.username = 'rubel';
              updated = true;
            } else if (p.userId === 'USER-003' || p.email === 'kamrul@tsp.gov.bd') {
              p.username = 'kamrul';
              updated = true;
            } else if (p.userId === 'USER-004' || p.email === 'nasir.store@tsp.gov.bd') {
              p.username = 'nasir';
              updated = true;
            }
          }
        });
        if (updated) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(parsed));
        }
      } catch {}
    }
    const existingMats = localStorage.getItem(STORAGE_KEYS.MATERIALS);
    if (!existingMats || !existingMats.includes('18.26.241') || JSON.parse(existingMats).length < 200) {
      localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(TSP_254_MATERIALS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(INITIAL_USERS[1])); // Default to Rubel Hossain (Admin)
    }

    // Cross-tab broadcast channel listener
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data && event.data.senderId !== CLIENT_ID) {
          this.notifyListeners(event.data);
        }
      };
    }

    // Initial API and Supabase fetching
    this.fetchMaterialsFromBackend();
    this.fetchSprsFromBackend();
    this.fetchUsersFromBackend();

    // Check & restore authenticated session from Supabase Auth
    this.checkAuthSession();

    // Listen to Supabase Auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          try {
            const res = await fetch('/api/auth/sync-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                auth_user_id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name,
                username: session.user.user_metadata?.username,
                department: session.user.user_metadata?.department,
                designation: session.user.user_metadata?.designation,
              }),
            });
            if (res.ok) {
              const profile = await res.json();
              this.setCurrentUser(profile);
              this.broadcast({ type: 'USER_UPDATED', payload: profile });
            }
          } catch (err) {
            console.warn('Sync profile on auth change warning:', err);
          }
        }
      }
    });

    // Setup Realtime SSE + Supabase Realtime
    this.setupRealtimeSync();
  }

  public static getSupabaseSyncStatus() {
    return this.syncStatus;
  }

  public static getSupabaseSyncDetails() {
    return {
      status: this.syncStatus,
      message: this.lastSyncMessage,
      count: this.lastSyncCount,
    };
  }

  public static isSyncing() {
    return this.isSyncingFlag;
  }

  public static async fetchMaterialsFromSupabase(): Promise<{ materials: Material[]; count: number; error: string | null; rlsBlocked: boolean }> {
    try {
      this.isSyncingFlag = true;
      let allRawMaterials: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      // 1. Fetch materials in chunks
      while (hasMore && page < 20) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('materials')
          .select('*')
          .range(from, to)
          .order('material_code', { ascending: true });

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          allRawMaterials = allRawMaterials.concat(data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      // Check if Supabase returned 0 items
      if (allRawMaterials.length === 0) {
        this.syncStatus = 'rls_restricted';
        this.lastSyncMessage = 'Supabase returned 0 records. Row Level Security (RLS) is active on public.materials.';
        this.lastSyncCount = 0;
        return {
          materials: this.getMaterials(),
          count: 0,
          error: 'Supabase returned 0 rows. Please disable RLS or allow public SELECT policy on public.materials in Supabase SQL Editor.',
          rlsBlocked: true,
        };
      }

      // 2. Fetch material_usage in chunks
      let allUsage: any[] = [];
      try {
        let usagePage = 0;
        let moreUsage = true;
        while (moreUsage && usagePage < 20) {
          const from = usagePage * pageSize;
          const to = from + pageSize - 1;
          const { data: usageData, error: usageErr } = await supabase
            .from('material_usage')
            .select('*')
            .range(from, to);

          if (!usageErr && usageData && usageData.length > 0) {
            allUsage = allUsage.concat(usageData);
            if (usageData.length < pageSize) moreUsage = false;
            else usagePage++;
          } else {
            moreUsage = false;
          }
        }
      } catch (err) {
        console.warn('Could not fetch material_usage:', err);
      }

      // Build usage map by material_id (master_id)
      const usageMap = new Map<string, { [fy: string]: string }>();
      allUsage.forEach((u) => {
        const matIdKey = String(u.material_id);
        if (!usageMap.has(matIdKey)) usageMap.set(matIdKey, {});
        const fy = String(u.fiscal_year || '').replace('20', '').replace('-', '_');
        usageMap.get(matIdKey)![`usage${fy}`] = String(u.usage ?? '-');
      });

      // Map Supabase rows to frontend materials
      const mapped: Material[] = allRawMaterials.map((row) => {
        const base = mapSupabaseToMaterial(row);
        const matIdKey = String(row.master_id ?? row.id);
        const extraUsage = usageMap.get(matIdKey);
        if (extraUsage) {
          if (extraUsage.usage20_21) base.usage20_21 = extraUsage.usage20_21;
          if (extraUsage.usage21_22) base.usage21_22 = extraUsage.usage21_22;
          if (extraUsage.usage22_23) base.usage22_23 = extraUsage.usage22_23;
          if (extraUsage.usage23_24) base.usage23_24 = extraUsage.usage23_24;
          if (extraUsage.usage24_25) base.usage24_25 = extraUsage.usage24_25;
          if (extraUsage.usage25_26) base.usage25_26 = extraUsage.usage25_26;
        }
        return base;
      });

      // Merge with any newly created local materials to prevent race condition overwrites
      const localList = this.getMaterials();
      const existingIds = new Set(
        mapped.map((m) => String(m.master_id || m.id).toLowerCase())
      );
      const existingCodes = new Set(
        mapped.map((m) => String(m.code || m.material_code).toLowerCase().trim())
      );

      localList.forEach((localMat) => {
        const idKey = String(localMat.master_id || localMat.id).toLowerCase();
        const codeKey = String(localMat.code || localMat.material_code).toLowerCase().trim();
        if (!existingIds.has(idKey) && !existingCodes.has(codeKey) && localMat.status === 'active') {
          mapped.push(localMat);
          existingIds.add(idKey);
          existingCodes.add(codeKey);
          // Auto-push unsynced local materials to Supabase
          try {
            const payload = mapMaterialToSupabase(localMat);
            supabase.from('materials').upsert(payload).then(({ error }) => {
              if (error) console.warn('[AUTO SYNC LOCAL MAT ERROR]', error.message);
            });
          } catch (e) {
            console.warn('[AUTO SYNC EXCEPTION]', e);
          }
        }
      });

      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(mapped));
      this.syncStatus = 'connected';
      this.lastSyncCount = mapped.length;
      this.lastSyncMessage = `Successfully synchronized ${mapped.length} materials live from Supabase.`;

      // Sync to shared backend server
      fetch('/api/materials/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapped),
      }).catch((e) => console.warn('Bulk import to server notice:', e));

      this.broadcast({ type: 'MATERIAL_UPDATED', payload: mapped });
      return { materials: mapped, count: mapped.length, error: null, rlsBlocked: false };
    } catch (err: any) {
      console.warn('Supabase fetch exception:', err);
      this.syncStatus = 'error';
      this.lastSyncMessage = err.message || 'Failed to connect to Supabase';
      return {
        materials: this.getMaterials(),
        count: 0,
        error: err.message || 'Error connecting to Supabase',
        rlsBlocked: false,
      };
    } finally {
      this.isSyncingFlag = false;
    }
  }

  public static async fetchMaterialsFromBackend(): Promise<Material[]> {
    this.isSyncingFlag = true;

    // 1. Try direct Supabase live fetch first
    try {
      const spResult = await this.fetchMaterialsFromSupabase();
      if (!spResult.rlsBlocked && spResult.count > 0) {
        return spResult.materials;
      }
    } catch (err) {
      console.warn('Direct Supabase fetch attempted:', err);
    }

    // 2. Fetch from backend API
    try {
      const res = await fetch('/api/materials');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const localList = this.getMaterials();
          const existingKeys = new Set(
            data.map((m: Material) => `${m.code.toLowerCase()}_${m.master_id || m.id}`)
          );
          localList.forEach((localMat) => {
            const key = `${localMat.code.toLowerCase()}_${localMat.master_id || localMat.id}`;
            if (!existingKeys.has(key) && localMat.status === 'active') {
              data.unshift(localMat);
              existingKeys.add(key);
            }
          });
          localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(data));
          this.broadcast({ type: 'MATERIAL_UPDATED', payload: data });
          return data;
        }
      }
    } catch (err) {
      console.warn('Could not fetch materials from API:', err);
    } finally {
      this.isSyncingFlag = false;
    }

    return this.getMaterials();
  }

  public static async bulkImportMaterials(materialsList: Material[]): Promise<number> {
    if (!Array.isArray(materialsList) || materialsList.length === 0) return 0;
    
    // Save to local storage
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materialsList));
    this.lastSyncCount = materialsList.length;
    this.lastSyncMessage = `Imported ${materialsList.length} materials into system.`;

    // Save to backend
    try {
      await fetch('/api/materials/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materialsList),
      });
    } catch (err) {
      console.warn('Backend bulk import sync error:', err);
    }

    this.broadcast({ type: 'MATERIAL_UPDATED', payload: materialsList });
    return materialsList.length;
  }

  private static setupRealtimeSync() {
    // 1. Server-Sent Events stream from shared backend
    if (typeof EventSource !== 'undefined') {
      try {
        if (this.sseSource) this.sseSource.close();
        this.sseSource = new EventSource('/api/realtime/stream');

        this.sseSource.onopen = () => {
          this.syncStatus = 'connected';
          console.log('[Realtime SSE] Connected to live backend event stream');
        };

        this.sseSource.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);
            if (event.type && event.type !== 'CONNECTED') {
              console.log('[Realtime SSE] Received event:', event.type);
              
              if (event.type.startsWith('MATERIAL_')) {
                this.fetchMaterialsFromBackend();
              } else if (event.type.startsWith('SPR_')) {
                this.fetchSprsFromBackend();
              } else if (event.type.startsWith('USER_')) {
                this.fetchUsersFromBackend();
              }
              
              this.notifyListeners(event);
            }
          } catch (err) {
            console.warn('Error parsing SSE event:', err);
          }
        };

        this.sseSource.onerror = () => {
          this.syncStatus = 'error';
        };
      } catch (err) {
        console.warn('SSE connection error:', err);
      }
    }

    // 2. Supabase Realtime Postgres Changes
    try {
      if (this.realtimeChannel) {
        this.realtimeChannel.unsubscribe();
      }

      this.realtimeChannel = supabase
        .channel('tsp_materials_realtime_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'materials' },
          (payload) => {
            console.log('[Supabase Realtime] Material changed:', payload.eventType);
            this.fetchMaterialsFromBackend();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.syncStatus = 'connected';
            console.log('[Supabase Realtime] Subscribed to public.materials');
          }
        });
    } catch (err) {
      console.warn('Supabase Realtime setup exception:', err);
    }

    // 3. Periodic Background Sync & Window Focus Sync
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.fetchMaterialsFromBackend();
        this.fetchSprsFromBackend();
      });

      setInterval(() => {
        this.fetchMaterialsFromBackend();
        this.fetchSprsFromBackend();
      }, 10000);
    }
  }

  public static async fetchSprsFromBackend(): Promise<SprRecord[]> {
    try {
      const res = await fetch('/api/sprs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem(STORAGE_KEYS.SPRS, JSON.stringify(data));
          this.broadcast({ type: 'SPR_UPDATED', payload: data });
          return data;
        }
      }
    } catch (err) {
      console.warn('Could not fetch SPRs from API:', err);
    }
    return this.getSprRecords();
  }

  private static broadcast(event: Omit<RealtimeEvent, 'senderId' | 'timestamp'>) {
    const fullEvent: RealtimeEvent = {
      ...event,
      senderId: CLIENT_ID,
      timestamp: new Date().toISOString(),
    };
    if (channel) {
      try {
        channel.postMessage(fullEvent);
      } catch (err) {
        console.warn('Broadcast error:', err);
      }
    }
    this.notifyListeners(fullEvent);
  }

  private static notifyListeners(event: RealtimeEvent) {
    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error('Error in realtime listener:', err);
      }
    });
  }

  public static subscribe(callback: (event: RealtimeEvent) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== callback);
    };
  }

  // --- USERS & AUTH API (Supabase Auth & PostgreSQL public.profiles Single Source of Truth) ---
  public static getUsers(): User[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  }

  public static async fetchUsersFromBackend(): Promise<User[]> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/auth/profiles', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));
          return list;
        }
      }
    } catch (e) {
      console.warn('Fetch users notice:', e);
    }
    return this.getUsers();
  }

  public static getCurrentUser(): User | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object' && parsed.email) {
          return parsed;
        }
      }
    } catch {}
    return null;
  }

  public static setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  public static async checkAuthSession(): Promise<User | null> {
    try {
      const { data: sessionData, error } = await supabase.auth.getSession();
      if (error || !sessionData?.session?.user) {
        this.setCurrentUser(null);
        return null;
      }

      const authUser = sessionData.session.user;
      const token = sessionData.session.access_token;

      // Sync profile from backend linked with Supabase Auth ID
      const res = await fetch('/api/auth/sync-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          auth_user_id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.full_name,
          username: authUser.user_metadata?.username,
          department: authUser.user_metadata?.department,
          designation: authUser.user_metadata?.designation,
        }),
      });

      if (res.ok) {
        const profile: User = await res.json();
        this.setCurrentUser(profile);
        this.broadcast({ type: 'USER_UPDATED', payload: profile });
        return profile;
      } else {
        // Fallback: build user profile directly from Supabase session metadata with default 'user' role
        const fallbackUser: User = {
          id: `usr_${authUser.id.substring(0, 8)}`,
          auth_user_id: authUser.id,
          userId: 'USER-AUTH',
          username: authUser.user_metadata?.username || authUser.email?.split('@')[0],
          name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          email: authUser.email || '',
          role: 'user',
          department: authUser.user_metadata?.department || 'General Department',
          designation: authUser.user_metadata?.designation || 'Officer',
          status: 'active',
          createdAt: authUser.created_at || new Date().toISOString(),
        };
        this.setCurrentUser(fallbackUser);
        return fallbackUser;
      }
    } catch (err) {
      console.warn('Auth session check notice:', err);
    }
    return this.getCurrentUser();
  }

  public static setupAuthListener(
    onAuthChange: (user: User | null, event: string) => void
  ): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          this.setCurrentUser(null);
          this.broadcast({ type: 'USER_UPDATED', payload: null as any });
          onAuthChange(null, 'SIGNED_OUT');
        } else if (event === 'PASSWORD_RECOVERY') {
          onAuthChange(null, 'PASSWORD_RECOVERY');
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const token = session.access_token;
            try {
              const res = await fetch('/api/auth/sync-profile', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  auth_user_id: session.user.id,
                  email: session.user.email,
                  name: session.user.user_metadata?.full_name,
                  username: session.user.user_metadata?.username,
                  department: session.user.user_metadata?.department,
                  designation: session.user.user_metadata?.designation,
                }),
              });
              if (res.ok) {
                const profile: User = await res.json();
                this.setCurrentUser(profile);
                this.broadcast({ type: 'USER_UPDATED', payload: profile });
                onAuthChange(profile, event);
                return;
              }
            } catch (e) {
              console.warn('Listener profile sync warning:', e);
            }

            const activeUser: User = {
              id: `usr_${session.user.id.substring(0, 8)}`,
              auth_user_id: session.user.id,
              userId: 'USER-AUTH',
              username: session.user.user_metadata?.username || session.user.email?.split('@')[0],
              name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
              email: session.user.email || '',
              role: 'user',
              department: session.user.user_metadata?.department || 'General Department',
              designation: session.user.user_metadata?.designation || 'Officer',
              status: 'active',
              createdAt: session.user.created_at || new Date().toISOString(),
            };
            this.setCurrentUser(activeUser);
            onAuthChange(activeUser, event);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }

  public static async sendPasswordResetEmail(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}`,
    });

    if (error) {
      console.error('Password reset error:', error);
      throw new Error(error.message || 'Unable to send password reset email. Please try again.');
    }
  }

  public static async updatePassword(newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must contain at least 6 characters.');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('Update password error:', error);
      throw new Error(error.message || 'Unable to update password. Please try again.');
    }
  }

  public static async saveUser(user: User): Promise<User> {
    const currentUser = this.getCurrentUser();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const targetIdentifier = user.id || user.auth_user_id || user.userId || user.email;

    // 1. Direct Supabase PostgreSQL update
    try {
      const cleanEmail = user.email.toLowerCase().trim();
      const userIdVal = user.userId;
      const updateClauses = [`email.eq.${cleanEmail}`];
      if (userIdVal) updateClauses.push(`user_id.eq.${userIdVal}`);
      if (user.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
        updateClauses.push(`id.eq.${user.id}`);
      }
      if (user.auth_user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.auth_user_id)) {
        updateClauses.push(`auth_user_id.eq.${user.auth_user_id}`);
      }

      await supabase
        .from('profiles')
        .update({
          role: user.role,
          status: user.status,
          name: user.name,
          username: user.username,
          department: user.department,
          designation: user.designation,
          updated_at: new Date().toISOString(),
        })
        .or(updateClauses.join(','));
    } catch (supaErr) {
      console.warn('Direct client Supabase profile update notice:', supaErr);
    }

    // 2. Server API Profile update
    const res = await fetch(`/api/auth/profiles/${encodeURIComponent(targetIdentifier)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Auth-User-Id': currentUser?.auth_user_id || currentUser?.id || '',
        'X-User-Role': currentUser?.role || 'user',
        'X-User-Email': currentUser?.email || '',
      },
      body: JSON.stringify(user),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ error: 'Failed to update user profile' }));
      throw new Error(errJson.error || `Failed to update user profile (${res.status})`);
    }

    const updated: User = await res.json();

    const users = this.getUsers();
    const index = users.findIndex(
      (u) =>
        u.id === updated.id ||
        (updated.auth_user_id && u.auth_user_id === updated.auth_user_id) ||
        (updated.email && u.email.toLowerCase() === updated.email.toLowerCase()) ||
        (updated.userId && u.userId === updated.userId)
    );
    if (index >= 0) {
      users[index] = { ...users[index], ...updated, role: updated.role };
    } else {
      users.push(updated);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    const current = this.getCurrentUser();
    if (
      current &&
      (current.id === updated.id ||
        (updated.auth_user_id && current.auth_user_id === updated.auth_user_id) ||
        (updated.email && current.email.toLowerCase() === updated.email.toLowerCase()) ||
        (updated.userId && current.userId === updated.userId))
    ) {
      this.setCurrentUser({ ...current, ...updated, role: updated.role });
    }

    this.broadcast({ type: 'USER_UPDATED', payload: updated });
    return updated;
  }

  public static async registerUser(
    name: string,
    username: string,
    email: string,
    password?: string,
    department?: string,
    designation?: string,
    role?: 'admin' | 'user'
  ): Promise<User> {
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password || '123456';

    // 1. Create real Supabase Auth user
    let authUserId: string | undefined;
    const assignedRole = role || (cleanEmail === 'admin@tsp.gov.bd' || cleanEmail === 'rubelctg1237@gmail.com' ? 'admin' : 'user');
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: {
          full_name: name.trim(),
          username: cleanUsername,
          department: department || 'General Department',
          designation: designation || 'Officer',
          role: assignedRole,
        },
      },
    });

    if (signUpError) {
      const errMsg = signUpError.message.toLowerCase();
      if (errMsg.includes('already registered') || errMsg.includes('already taken')) {
        throw new Error('An account with this email address already exists.');
      }
      throw new Error(signUpError.message || 'Registration could not be completed.');
    }

    if (authData?.user) {
      authUserId = authData.user.id;
    }

    // 2. Register & Sync profile record in shared backend
    const token = authData?.session?.access_token;
    const res = await fetch('/api/auth/sync-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        auth_user_id: authUserId,
        name: name.trim(),
        username: cleanUsername,
        email: cleanEmail,
        department: department || 'General Department',
        designation: designation || 'Officer',
        role: role || (cleanEmail === 'admin@tsp.gov.bd' || cleanEmail === 'rubelctg1237@gmail.com' ? 'admin' : 'user'),
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(errJson.error || 'Failed to initialize user profile.');
    }

    const newUser: User = await res.json();
    const users = this.getUsers();
    const existingIdx = users.findIndex((u) => u.email.toLowerCase() === cleanEmail || u.id === newUser.id);
    if (existingIdx >= 0) {
      users[existingIdx] = newUser;
    } else {
      users.push(newUser);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.setCurrentUser(newUser);
    this.broadcast({ type: 'USER_UPDATED', payload: newUser });
    return newUser;
  }

  public static async loginUser(identifier: string, password?: string): Promise<User> {
    const cleanInput = identifier.trim();
    if (!cleanInput) {
      throw new Error('Please enter your email address or username.');
    }
    if (!password) {
      throw new Error('Please enter your password.');
    }

    // 1. Resolve identifier to actual account email if username or userId was entered
    let targetEmail = cleanInput.toLowerCase();
    if (!cleanInput.includes('@')) {
      try {
        const resolveRes = await fetch('/api/auth/resolve-identifier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanInput }),
        });
        if (resolveRes.ok) {
          const resolveData = await resolveRes.json();
          if (resolveData.found && resolveData.email) {
            targetEmail = resolveData.email.toLowerCase();
          } else {
            throw new Error('Unable to sign in. Please check your username/email and password.');
          }
        }
      } catch (err: any) {
        if (err.message && err.message.startsWith('Unable to sign in')) {
          throw err;
        }
        console.warn('Identifier resolution warning:', err);
      }
    }

    // 2. Authenticate through Supabase Auth (Single Source of Truth)
    let authUser: any = null;
    let signInData: any = null;
    let signInError: any = null;

    try {
      const authResult = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password,
      });
      signInData = authResult.data;
      signInError = authResult.error;
    } catch (networkErr: any) {
      console.error('Supabase network error:', networkErr);
      throw new Error('Unable to connect to the authentication service. Please try again.');
    }

    if (signInError) {
      // Safe self-healing for legacy seeded admin/user accounts not yet registered in Supabase Auth
      if (
        signInError.message.includes('Invalid login credentials') &&
        (targetEmail === 'admin@tsp.gov.bd' || targetEmail === 'rubelctg1237@gmail.com' || targetEmail === 'kamrul@tsp.gov.bd' || targetEmail === 'nasir.store@tsp.gov.bd')
      ) {
        // Attempt first-time creation in Supabase Auth
        const seedUser = INITIAL_USERS.find((u) => u.email.toLowerCase() === targetEmail);
        const { data: seedSignUp, error: seedErr } = await supabase.auth.signUp({
          email: targetEmail,
          password: password,
          options: {
            data: {
              full_name: seedUser?.name || 'Administrator',
              username: seedUser?.username || 'admin',
              department: seedUser?.department || 'Electrical Maintenance',
            },
          },
        });

        if (!seedErr && seedSignUp?.user) {
          authUser = seedSignUp.user;
        } else {
          throw new Error('Unable to sign in. Please check your username/email and password.');
        }
      } else {
        throw new Error('Unable to sign in. Please check your username/email and password.');
      }
    } else {
      authUser = signInData?.user;
    }

    if (!authUser) {
      throw new Error('Unable to establish authentication session with Supabase Auth.');
    }

    // 3. Retrieve and sync linked user profile
    let profile: User | null = null;
    try {
      const syncRes = await fetch('/api/auth/sync-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_user_id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.full_name,
          username: authUser.user_metadata?.username,
          department: authUser.user_metadata?.department,
          designation: authUser.user_metadata?.designation,
        }),
      });

      if (syncRes.ok) {
        profile = await syncRes.json();
      }
    } catch (err) {
      console.warn('Profile sync network notice:', err);
    }

    if (!profile) {
      profile = {
        id: `usr_${authUser.id.substring(0, 8)}`,
        auth_user_id: authUser.id,
        userId: 'USER-AUTH',
        username: authUser.user_metadata?.username || authUser.email?.split('@')[0],
        name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email || '',
        role: 'user',
        department: authUser.user_metadata?.department || 'General Department',
        designation: authUser.user_metadata?.designation || 'Officer',
        status: 'active',
        createdAt: authUser.created_at || new Date().toISOString(),
      };
    }

    this.setCurrentUser(profile);
    this.broadcast({ type: 'USER_UPDATED', payload: profile });
    return profile;
  }

  public static async logoutUser(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase signout notice:', err);
    }
    // Completely clear authentication session and cached profile
    this.setCurrentUser(null);
    this.broadcast({ type: 'USER_UPDATED', payload: null as any });
  }

  // --- MATERIALS API ---
  public static getMaterials(): Material[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MATERIALS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      return TSP_254_MATERIALS;
    } catch {
      return TSP_254_MATERIALS;
    }
  }

  public static async saveMaterial(materialData: Partial<Material>): Promise<Material> {
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.role !== 'admin') {
      throw new Error('Access denied: Only administrators can add or edit materials.');
    }

    const isEdit = Boolean(materialData.id && materialData.id.startsWith('MAT-'));
    const currentList = this.getMaterials();
    
    let targetId = '';
    if (materialData.id && materialData.id.startsWith('MAT-')) {
      targetId = materialData.id;
    } else if (materialData.master_id && String(materialData.master_id).startsWith('MAT-')) {
      targetId = String(materialData.master_id);
    } else {
      let maxNum = 0;
      for (const m of currentList) {
        const raw = String(m.master_id || m.id || '');
        const match = raw.match(/MAT-(\d+)/i);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        } else if (!isNaN(Number(m.master_id))) {
          const n = Number(m.master_id);
          if (n > maxNum) maxNum = n;
        }
      }
      const nextNum = maxNum > 0 ? maxNum + 1 : currentList.length + 1;
      targetId = `MAT-${String(nextNum).padStart(4, '0')}`;
    }

    const code = (materialData.code || materialData.material_code || 'New').trim();
    const desc = (materialData.description || materialData.material_description || '').trim();
    const priceVal = materialData.unit_price || materialData.unitPrice || materialData.lastMrrPrice || '';
    const now = new Date().toISOString();

    const fullMaterial: Material = {
      id: targetId,
      master_id: targetId,
      code,
      material_code: code,
      description: desc,
      material_description: desc,
      unit: materialData.unit || 'No',
      usage20_21: materialData.usage20_21 ?? '-',
      usage21_22: materialData.usage21_22 ?? '-',
      usage22_23: materialData.usage22_23 ?? '-',
      usage23_24: materialData.usage23_24 ?? '-',
      usage24_25: materialData.usage24_25 ?? '-',
      usage25_26: materialData.usage25_26 ?? '-',
      storeStock: materialData.storeStock || (materialData as any).store_stock || 'Nil',
      store_stock: materialData.storeStock || (materialData as any).store_stock || 'Nil',
      pipelineQty: materialData.pipelineQty || (materialData as any).pipeline_qty || '-',
      lastMrrNo: materialData.lastMrrNo || '',
      lastMrrDate: materialData.lastMrrDate || '',
      lastMrrPrice: String(priceVal),
      unit_price: String(priceVal),
      unitPrice: String(priceVal),
      previous_purchase_order_date_price:
        materialData.previous_purchase_order_date_price ||
        (materialData.lastMrrNo ? `${materialData.lastMrrNo} | Date-${materialData.lastMrrDate} | ${priceVal}` : ''),
      remarks: materialData.remarks || '',
      category: materialData.category || 'General',
      review_flag: materialData.review_flag ?? null,
      source: materialData.source || 'TSP System',
      status: materialData.status || 'active',
      createdAt: materialData.createdAt || now,
      updatedAt: now,
    };

    // 1. Authoritative Backend Server API write (verifies admin role against public.profiles)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const url = isEdit ? `/api/materials/${encodeURIComponent(targetId)}` : '/api/materials';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Auth-User-Id': currentUser?.auth_user_id || currentUser?.id || '',
          'X-User-Role': currentUser?.role || 'user',
          'X-User-Email': currentUser?.email || '',
        },
        body: JSON.stringify(fullMaterial),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error) {
          throw new Error(errData.error);
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Access denied') || err.message.includes('permission') || err.message.includes('administrators'))) {
        throw err;
      }
      console.warn('Backend server material save notice:', err);
    }

    // 2. Direct Supabase Upsert sync
    const dbPayload = mapMaterialToSupabase(fullMaterial);
    try {
      const { error: sbUpsertErr } = await supabase.from('materials').upsert(dbPayload);
      if (sbUpsertErr) {
        console.error('[SUPABASE DIRECT MATERIAL UPSERT ERROR]', sbUpsertErr.message, sbUpsertErr.details);
      }

      // Upsert annual usage into material_usage table
      const usageEntries = [
        { fy: '20-21', val: fullMaterial.usage20_21 },
        { fy: '21-22', val: fullMaterial.usage21_22 },
        { fy: '22-23', val: fullMaterial.usage22_23 },
        { fy: '23-24', val: fullMaterial.usage23_24 },
        { fy: '24-25', val: fullMaterial.usage24_25 },
        { fy: '25-26', val: fullMaterial.usage25_26 },
      ].filter((e) => e.val && e.val !== '-' && String(e.val).trim() !== '');

      if (usageEntries.length > 0) {
        const usageRows = usageEntries.map((e) => ({
          id: `${targetId}-${e.fy}`,
          material_id: targetId,
          fiscal_year: e.fy,
          usage: String(e.val),
        }));
        await supabase.from('material_usage').upsert(usageRows);
      }
    } catch (err: any) {
      console.warn('Direct Supabase sync notice:', err);
    }

    // 3. Update local cache and state
    const list = this.getMaterials();
    const existingIdx = list.findIndex(
      (m) => m.id === targetId || String(m.master_id) === targetId || (m.code.toLowerCase() === code.toLowerCase() && m.id === targetId)
    );

    if (existingIdx >= 0) {
      list[existingIdx] = fullMaterial;
    } else {
      list.unshift(fullMaterial);
    }

    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(list));
    this.broadcast({ type: isEdit ? 'MATERIAL_UPDATED' : 'MATERIAL_ADDED', payload: fullMaterial });

    return fullMaterial;
  }

  public static async deleteMaterial(id: string, hardDelete: boolean = false): Promise<boolean> {
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.role !== 'admin') {
      throw new Error('Access denied: Only administrators can delete or deactivate materials.');
    }

    try {
      // 1. Authoritative Backend Server API deactivation or deletion
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`/api/materials/${encodeURIComponent(id)}${hardDelete ? '?hard=true' : ''}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Auth-User-Id': currentUser?.auth_user_id || currentUser?.id || '',
          'X-User-Role': currentUser?.role || 'user',
          'X-User-Email': currentUser?.email || '',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error) {
          throw new Error(errData.error);
        }
      }

      // 2. Direct Supabase sync
      try {
        if (hardDelete) {
          await supabase
            .from('materials')
            .delete()
            .or(`master_id.eq.${id},material_code.eq.${id}`);
        } else {
          await supabase
            .from('materials')
            .update({ status: 'inactive' })
            .or(`master_id.eq.${id},material_code.eq.${id}`);
        }
      } catch (err: any) {
        console.warn('Supabase delete notice:', err);
      }

      // 3. Local state
      const list = this.getMaterials();
      const idx = list.findIndex((m) => m.id === id || String(m.master_id) === id || m.code === id);
      if (idx >= 0) {
        if (hardDelete) {
          const removed = list.splice(idx, 1)[0];
          localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(list));
          this.broadcast({ type: 'MATERIAL_DELETED', payload: { id, code: removed.code } });
        } else {
          list[idx].status = 'inactive';
          localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(list));
          this.broadcast({ type: 'MATERIAL_UPDATED', payload: list[idx] });
        }
      }
      return true;
    } catch (err: any) {
      if (err.message && (err.message.includes('Access denied') || err.message.includes('permission') || err.message.includes('administrators'))) {
        throw err;
      }
      console.error('Error modifying material:', err);
      return false;
    }
  }

  public static async toggleMaterialStatus(id: string): Promise<Material | null> {
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.role !== 'admin') {
      throw new Error('Access denied: Only administrators can change material status.');
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`/api/materials/${encodeURIComponent(id)}/toggle-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Auth-User-Id': currentUser?.auth_user_id || currentUser?.id || '',
          'X-User-Role': currentUser?.role || 'user',
          'X-User-Email': currentUser?.email || '',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to toggle material status');
      }

      const resData = await res.json();
      const newStatus = resData.status || (resData.material && resData.material.status);

      // Direct Supabase sync
      try {
        await supabase
          .from('materials')
          .update({ status: newStatus })
          .or(`master_id.eq.${id},material_code.eq.${id}`);
      } catch (err) {
        console.warn('Supabase toggle status notice:', err);
      }

      const list = this.getMaterials();
      const idx = list.findIndex((m) => m.id === id || String(m.master_id) === id || m.code === id);
      if (idx >= 0) {
        list[idx].status = newStatus;
        localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(list));
        this.broadcast({ type: 'MATERIAL_UPDATED', payload: list[idx] });
        return list[idx];
      }
      return resData.material || null;
    } catch (err: any) {
      console.error('Error toggling material status:', err);
      throw err;
    }
  }

  public static searchMaterials(query: string, categoryFilter: string = 'all'): Material[] {
    const materials = this.getMaterials().filter((m) => m.status === 'active');
    return searchMaterialsUniversal(materials, query, categoryFilter);
  }

  /**
   * Fetch Annual Usage dynamically from public.material_usage table
   * Matches public.material_usage.material_id with public.materials.master_id
   */
  public static async getMaterialUsage(
    masterId: string | number | undefined,
    fiscalYears: string[]
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    fiscalYears.forEach((fy) => {
      result[fy] = '-';
    });

    if (masterId === undefined || masterId === null || masterId === '') {
      return result;
    }

    try {
      let numId = masterId;
      if (typeof masterId === 'string') {
        if (masterId.startsWith('MAT-')) {
          numId = parseInt(masterId.replace('MAT-', ''), 10) || masterId;
        } else if (!isNaN(Number(masterId))) {
          numId = Number(masterId);
        }
      }

      // 1. Query Supabase directly
      const { data, error } = await supabase
        .from('material_usage')
        .select('*')
        .eq('material_id', numId)
        .in('fiscal_year', fiscalYears);

      if (!error && data && data.length > 0) {
        data.forEach((row: any) => {
          if (row.fiscal_year && row.usage !== undefined && row.usage !== null) {
            result[row.fiscal_year] = String(row.usage);
          }
        });
        return result;
      }
    } catch (err) {
      console.warn('Supabase material_usage query error:', err);
    }

    // 2. Query server-side API fallback
    try {
      const res = await fetch(`/api/material-usage/${masterId}?years=${encodeURIComponent(fiscalYears.join(','))}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          fiscalYears.forEach((fy) => {
            if (data[fy] !== undefined && data[fy] !== null && data[fy] !== '-') {
              result[fy] = String(data[fy]);
            }
          });
        }
      }
    } catch (err) {
      console.warn('API material-usage fetch notice:', err);
    }

    // 3. Direct client-side materials record fallback for any remaining '-'
    fiscalYears.forEach((fy) => {
      if (result[fy] === '-' || result[fy] === undefined) {
        const numId = typeof masterId === 'string' && !isNaN(Number(masterId)) ? Number(masterId) : masterId;
        const mat = this.getMaterials().find(
          (m) => m.master_id === numId || String(m.master_id) === String(masterId) || m.id === String(masterId)
        );
        if (mat) {
          const val =
            mat[`usage${fy.replace('-', '_')}`] ||
            mat[`usage_${fy.replace('-', '_')}`] ||
            mat[fy];
          if (val !== undefined && val !== null && val !== '') {
            result[fy] = String(val);
          }
        }
      }
    });

    return result;
  }

  public static async bulkImportPartialMaterials(importedList: Partial<Material>[]): Promise<Material[]> {
    const current = this.getMaterials();
    const map = new Map<string, Material>();
    current.forEach((m) => map.set(m.code.toLowerCase().trim(), m));

    const now = new Date().toISOString();
    const updated: Material[] = [];

    importedList.forEach((item, idx) => {
      const code = (item.code || 'New').trim();
      const key = code.toLowerCase();
      const existing = map.get(key);

      const merged: Material = {
        id: existing?.id || `mat_imp_${Date.now()}_${idx}`,
        master_id: existing?.master_id || current.length + idx + 1,
        code,
        description: item.description || existing?.description || '',
        unit: item.unit || existing?.unit || 'No',
        usage20_21: item.usage20_21 || existing?.usage20_21 || '-',
        usage21_22: item.usage21_22 || existing?.usage21_22 || '-',
        usage22_23: item.usage22_23 || existing?.usage22_23 || '-',
        usage23_24: item.usage23_24 || existing?.usage23_24 || '-',
        usage24_25: item.usage24_25 || existing?.usage24_25 || '-',
        usage25_26: item.usage25_26 || existing?.usage25_26 || '-',
        storeStock: item.storeStock || existing?.storeStock || 'Nil',
        pipelineQty: item.pipelineQty || existing?.pipelineQty || '-',
        lastMrrNo: item.lastMrrNo || existing?.lastMrrNo || '',
        lastMrrDate: item.lastMrrDate || existing?.lastMrrDate || '',
        lastMrrPrice: item.lastMrrPrice || existing?.lastMrrPrice || '',
        remarks: item.remarks || existing?.remarks || '',
        category: item.category || existing?.category || 'General',
        review_flag: item.review_flag || null,
        source: 'TSP Import',
        status: 'active',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      map.set(key, merged);
      updated.push(merged);
    });

    const fullList = Array.from(map.values());
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(fullList));

    try {
      await fetch('/api/materials/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullList),
      });
    } catch (err) {
      console.warn('Backend bulk import notice:', err);
    }

    this.broadcast({ type: 'MATERIAL_UPDATED', payload: null });
    return fullList;
  }

  // --- SPR RECORDS API ---
  public static getSprRecords(): SprRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SPRS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static getSprById(id: string): SprRecord | undefined {
    const list = this.getSprRecords();
    return list.find((s) => s.id === id || s.sprNo === id);
  }

  public static generateNextSprNo(): string {
    const list = this.getSprRecords();
    const currentYear = new Date().getFullYear();
    const prefix = `SPR-${currentYear}-`;
    const yearRecords = list.filter((r) => r.sprNo && r.sprNo.startsWith(prefix));
    
    let maxNum = 125;
    yearRecords.forEach((r) => {
      const numPart = parseInt(r.sprNo.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    });

    return `${prefix}${String(maxNum + 1).padStart(5, '0')}`;
  }

  public static async saveSpr(sprData: Partial<SprRecord>): Promise<SprRecord> {
    const isEdit = Boolean(sprData.id);
    const targetId = sprData.id;

    // Recalculate item totals and grand total
    const cleanItems: SprItem[] = (sprData.items || []).map((it, idx) => {
      const qty = typeof it.requiredQty === 'string' ? parseFloat(it.requiredQty) || 0 : it.requiredQty || 0;
      const price = typeof it.unitPrice === 'string' ? parseFloat(it.unitPrice) || 0 : it.unitPrice || 0;
      const total = Math.round(qty * price * 100) / 100;
      return {
        ...it,
        sl: idx + 1,
        requiredQty: qty,
        unitPrice: price,
        total,
      };
    });

    const grandTotal = cleanItems.reduce((sum, it) => sum + (it.total || 0), 0);
    const inWords = numberToWordsEnglish(grandTotal);
    const inWordsBn = numberToWordsBengali(grandTotal);

    const payload = {
      ...sprData,
      items: cleanItems,
      grandTotal,
      inWords,
      inWordsBn,
    };

    try {
      const url = isEdit ? `/api/sprs/${targetId}` : '/api/sprs';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Failed to save SPR' }));
        throw new Error(errJson.error || 'Server error saving SPR');
      }

      const savedSpr = await res.json();
      
      // Update local cache
      const list = this.getSprRecords();
      if (isEdit) {
        const idx = list.findIndex((s) => s.id === targetId || s.sprNo === savedSpr.sprNo);
        if (idx >= 0) list[idx] = savedSpr;
        else list.unshift(savedSpr);
      } else {
        list.unshift(savedSpr);
      }
      localStorage.setItem(STORAGE_KEYS.SPRS, JSON.stringify(list));
      this.broadcast({ type: isEdit ? 'SPR_UPDATED' : 'SPR_CREATED', payload: savedSpr });

      return savedSpr;
    } catch (err: any) {
      console.error('Error saving SPR:', err);
      throw err;
    }
  }

  public static async deleteSpr(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/sprs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        let list = this.getSprRecords();
        list = list.filter((s) => s.id !== id && s.sprNo !== id);
        localStorage.setItem(STORAGE_KEYS.SPRS, JSON.stringify(list));
        this.broadcast({ type: 'SPR_DELETED', payload: { id } });
        return true;
      }
    } catch (err) {
      console.error('Error deleting SPR:', err);
    }
    return false;
  }

  public static resetToFactoryDefaults() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(TSP_254_MATERIALS));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(INITIAL_USERS[1]));
    this.broadcast({ type: 'MATERIAL_UPDATED', payload: null });
    this.broadcast({ type: 'SPR_UPDATED', payload: null });
    this.broadcast({ type: 'USER_UPDATED', payload: null });
  }
}

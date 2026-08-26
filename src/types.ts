export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'inactive';

export interface User {
  id: string;
  auth_user_id?: string; // Supabase Auth UUID (auth.users.id)
  userId: string; // e.g. USER-001, ADM-001
  username?: string; // Unique username (e.g. jalel, rubel)
  name: string;
  email: string;
  role: UserRole;
  department: string;
  designation?: string;
  status: UserStatus;
  password?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Material {
  id: string;
  master_id?: string | number;
  code: string; // e.g. 18.14.303, 9.07.053
  material_code?: string;
  description: string; // Detailed spec
  material_description?: string;
  unit: string; // No, Pkt, Kg, Mtr, Set, Pair, etc.
  usage20_21?: string;
  usage21_22?: string;
  usage22_23?: string;
  usage23_24?: string;
  usage24_25?: string;
  usage25_26?: string;
  storeStock?: string; // e.g. Nil or 12 Nos
  store_stock?: string;
  pipelineQty?: string; // Pipe line + ordered qty
  lastMrrNo?: string; // e.g. MRR-26910
  lastMrrDate?: string; // e.g. 22/10/23
  lastMrrPrice?: string; // e.g. Tk-8240/-
  unit_price?: string | number; // Direct column from public.materials
  unitPrice?: string | number;
  previous_purchase_order_date_price?: string;
  estimated_receipt_time_eba?: string;
  remarks?: string;
  category?: string;
  review_flag?: string | boolean | null;
  source?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface SprItem {
  id: string;
  sl: number;
  code: string; // Material code or "New"
  description: string;
  unit: string;
  usage20_21?: string;
  usage21_22?: string;
  usage22_23?: string;
  usage23_24?: string;
  usage24_25?: string;
  usage25_26?: string;
  usageByYear?: Record<string, string>; // Dynamic fiscal-year usage from public.material_usage
  storeStock: string; // e.g. "Nil"
  pipelineQty: string;
  requiredQty: number | string;
  unitPrice: number | string;
  total: number;
  eda?: string; // Estimated Delivery/Arrival time
  previousPurchase?: string; // e.g. MRR-26910 Date:22/10/23 Tk-8240/-
  remarks?: string;
  materialId?: string;
  [key: string]: any;
}

export interface SprRecord {
  id: string;
  sprNo: string; // e.g. SPR-2026-0001 or TSP/MPIC(PA)/2024-081
  refNo: string; // সূত্র নং: টিএসপি/এমপিআইসি (পিএণ্ড) / ...
  date: string; // e.g. 2026-08-20 or 20/08/2026
  fiscalYear: string; // e.g. ২০২৪-২০২৫ খ্রি. or 2025-2026
  procurementType: string; // স্থানীয় / বৈদেশিক (Local / Foreign)
  subject: string; // প্রসঙ্গ e.g. বৈদ্যুতিক মালামাল ক্রয়
  department: string;
  preparedBy: string; // User Name
  preparedByUserId: string; // User ID e.g. USER-001
  preparedByEmail: string;
  items: SprItem[];
  grandTotal: number;
  inWords?: string;
  inWordsBn?: string;
  status: 'draft' | 'submitted' | 'approved' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface RealtimeEvent {
  type: 'MATERIAL_ADDED' | 'MATERIAL_UPDATED' | 'MATERIAL_DELETED' | 'SPR_CREATED' | 'SPR_UPDATED' | 'SPR_DELETED' | 'USER_UPDATED';
  payload: any;
  senderId: string;
  timestamp: string;
}

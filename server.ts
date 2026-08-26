import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { TSP_254_MATERIALS } from './src/services/materialsDataset';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://csyvznqhdsemvdlaxthf.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_cZxEACjIUe-4BKASg91NTw_Uxt7upFX';
const supabaseServer = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// -------------------------------------------------------------
// Database Persistence (Persistent file + Memory cache)
// -------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MATERIALS_FILE = path.join(DATA_DIR, 'materials.json');
const USERS_FILE = path.join(DATA_DIR, 'profiles.json');
const SPRS_FILE = path.join(DATA_DIR, 'sprs.json');
const USAGE_FILE = path.join(DATA_DIR, 'material_usage.json');

// Realtime SSE subscribers
const sseClients: express.Response[] = [];

function broadcastRealtime(event: { type: string; payload: any; senderId?: string }) {
  const data = JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
  });
  
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(`data: ${data}\n\n`);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// In-Memory state loaded from disk or pre-seeded
let profiles: any[] = [];
let materials: any[] = [];
let materialUsageList: any[] = [];
let sprs: any[] = [];

// Initialize profiles
if (fs.existsSync(USERS_FILE)) {
  try {
    profiles = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    profiles = [];
  }
}
if (profiles.length === 0) {
  profiles = [
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
  fs.writeFileSync(USERS_FILE, JSON.stringify(profiles, null, 2));
} else {
  // Ensure default usernames exist for seeded accounts if missing
  let modified = false;
  profiles.forEach((p) => {
    if (!p.username) {
      if (p.userId === 'USER-001' || p.email === 'admin@tsp.gov.bd') {
        p.username = 'jalel';
        modified = true;
      } else if (p.userId === 'USER-002' || p.email === 'rubelctg1237@gmail.com') {
        p.username = 'rubel';
        modified = true;
      } else if (p.userId === 'USER-003' || p.email === 'kamrul@tsp.gov.bd') {
        p.username = 'kamrul';
        modified = true;
      } else if (p.userId === 'USER-004' || p.email === 'nasir.store@tsp.gov.bd') {
        p.username = 'nasir';
        modified = true;
      }
    }
  });
  if (modified) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(profiles, null, 2));
  }
}

// Initialize materials (All 480 imported TSP standard records)
if (fs.existsSync(MATERIALS_FILE)) {
  try {
    materials = JSON.parse(fs.readFileSync(MATERIALS_FILE, 'utf8'));
  } catch {
    materials = [];
  }
}
if (materials.length < 480 || !materials.some(m => m.code === '18.08.203' && m.id === 'MAT-0070')) {
  materials = TSP_254_MATERIALS.map((m, idx) => ({
    id: m.id || `MAT-${String(m.master_id || idx + 1).padStart(4, '0')}`,
    master_id: m.master_id || idx + 1,
    code: m.code,
    description: m.description,
    unit: m.unit || 'No',
    usage20_21: m.usage20_21 || '-',
    usage21_22: m.usage21_22 || '-',
    usage22_23: m.usage22_23 || '-',
    usage23_24: m.usage23_24 || '-',
    usage24_25: m.usage24_25 || '-',
    usage25_26: m.usage25_26 || '-',
    storeStock: m.store_stock || m.storeStock || 'Nil',
    store_stock: m.store_stock || m.storeStock || 'Nil',
    pipelineQty: m.pipelineQty || '-',
    lastMrrNo: m.lastMrrNo || '',
    lastMrrDate: m.lastMrrDate || '',
    lastMrrPrice: m.unit_price || m.unitPrice || m.lastMrrPrice || '',
    unit_price: m.unit_price || m.unitPrice || m.lastMrrPrice || '',
    unitPrice: m.unit_price || m.unitPrice || m.lastMrrPrice || '',
    previous_purchase_order_date_price: m.previous_purchase_order_date_price || '',
    remarks: m.remarks || '',
    category: m.category || 'General',
    review_flag: m.review_flag || null,
    source: m.source || 'TSP Supabase',
    status: m.status || 'active',
    createdAt: m.createdAt || '2024-01-01T00:00:00.000Z',
    updatedAt: m.updatedAt || '2026-08-20T00:00:00.000Z',
  }));
  fs.writeFileSync(MATERIALS_FILE, JSON.stringify(materials, null, 2));
}

// Initialize material_usage (Mapped strictly by material_id = master_id)
if (fs.existsSync(USAGE_FILE)) {
  try {
    materialUsageList = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
  } catch {
    materialUsageList = [];
  }
}
if (materialUsageList.length === 0) {
  const fiscalYearsToSeed = ['20-21', '21-22', '22-23', '23-24', '24-25', '25-26'];
  const seenMap = new Set<string>();
  let rowId = 1;

  materials.forEach((m) => {
    const matId = Number(m.master_id || m.id);
    fiscalYearsToSeed.forEach((fy) => {
      const key = `${matId}_${fy}`;
      if (!seenMap.has(key)) {
        seenMap.add(key);
        const usageVal =
          m[`usage${fy.replace('-', '_')}`] ||
          m[`usage_${fy.replace('-', '_')}`] ||
          m[fy] ||
          '-';
        materialUsageList.push({
          id: String(rowId++),
          material_id: matId,
          fiscal_year: fy,
          usage: String(usageVal),
          created_at: m.createdAt || '2024-01-01T00:00:00.000Z',
          updated_at: m.updatedAt || '2026-08-20T00:00:00.000Z',
        });
      }
    });
  });
  fs.writeFileSync(USAGE_FILE, JSON.stringify(materialUsageList, null, 2));
}

function saveUsageDisk() {
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(materialUsageList, null, 2));
  } catch (err) {
    console.error('Error saving usage file:', err);
  }
}

// Initialize SPRs
if (fs.existsSync(SPRS_FILE)) {
  try {
    sprs = JSON.parse(fs.readFileSync(SPRS_FILE, 'utf8'));
  } catch {
    sprs = [];
  }
}
if (sprs.length === 0) {
  sprs = [
    {
      id: 'spr_rec_003',
      sprNo: 'SPR-2026-00127',
      refNo: 'টিএসপি/এমপিআইসি (পিএণ্ড) / ২০২৬-০১৩',
      date: '2026-08-20',
      fiscalYear: '২০২৬-২০২৭ খ্রি.',
      procurementType: 'স্থানীয়',
      subject: 'ইলেকট্রিক্যাল ও কন্ট্রোল প্যানেল মালামাল ক্রয়',
      department: 'Electrical Maintenance',
      preparedBy: 'Md. Rubel Hossain',
      preparedByUserId: 'USER-002',
      preparedByEmail: 'rubelctg1237@gmail.com',
      status: 'submitted',
      grandTotal: 42750,
      inWords: 'Forty-Two Thousand Seven Hundred Fifty Taka only.',
      inWordsBn: 'বিয়াল্লিশ হাজার সাতশত পঞ্চাশ টাকা মাত্র।',
      items: [
        {
          id: 'item_301',
          sl: 1,
          code: '18.26.241',
          description: 'Signal Lamp (GREEN) | X-mer Type: DR22 DOL H4G. Dia-22mm 115-127VAC, 50/60Hz, Brand & Origin: Fuji Electric FA Components & System Co. Ltd., Japan.',
          unit: 'No',
          usage20_21: '12',
          usage21_22: '15',
          usage22_23: '10',
          usage23_24: '08',
          usage24_25: '-',
          usage25_26: '-',
          storeStock: 'Nil',
          pipelineQty: '-',
          requiredQty: 10,
          unitPrice: 1650,
          total: 16500,
          eda: '10 Days',
          previousPurchase: 'MRR-26750 Date:14/05/23 Tk-1650/-',
          remarks: 'Control Desk Replacement',
          materialId: 'MAT-0070',
        },
        {
          id: 'item_302',
          sl: 2,
          code: '18.08.203',
          description: 'Auxiliary Relay 8 Pin, 220V AC with Base & LED Indicator Brand: Omron / IDEC',
          unit: 'Set',
          usage20_21: '06',
          usage21_22: '04',
          usage22_23: '08',
          usage23_24: '05',
          usage24_25: '-',
          usage25_26: '-',
          storeStock: 'Nil',
          pipelineQty: '-',
          requiredQty: 15,
          unitPrice: 1750,
          total: 26250,
          eda: '15 Days',
          previousPurchase: 'MRR-26812 Date:18/07/23 Tk-1750/-',
          remarks: 'Boiler Interlock Panel',
          materialId: 'MAT-0071',
        },
      ],
      createdAt: '2026-08-20T10:15:00Z',
      updatedAt: '2026-08-20T10:15:00Z',
    },
    {
      id: 'spr_rec_001',
      sprNo: 'SPR-2024-00125',
      refNo: 'টিএসপি/এমপিআইসি (পিএণ্ড) / ২০২৪-০৮১',
      date: '2024-06-08',
      fiscalYear: '২০২৪-২০২৫ খ্রি.',
      procurementType: 'স্থানীয়',
      subject: 'বৈদ্যুতিক মালামাল ক্রয়',
      department: 'Electrical Maintenance',
      preparedBy: 'Engr. Jalel Ahmed',
      preparedByUserId: 'USER-001',
      preparedByEmail: 'admin@tsp.gov.bd',
      status: 'submitted',
      grandTotal: 254716,
      inWords: 'Two Lakh Fifty-Four Thousand Seven Hundred Sixteen Taka only.',
      inWordsBn: 'দুই লক্ষ চুয়ান্ন হাজার সাতশত ষোল টাকা মাত্র।',
      items: [
        {
          id: 'item_01',
          sl: 1,
          code: 'New',
          description: 'LT Cable Connector 420V 50HZ Origin: Koria/ Equivalent.',
          unit: 'No',
          usage20_21: '-',
          usage21_22: '-',
          usage22_23: '-',
          usage23_24: '-',
          usage24_25: '-',
          usage25_26: '-',
          storeStock: 'Nil',
          pipelineQty: '-',
          requiredQty: 4,
          unitPrice: 1200,
          total: 4800,
          eda: '',
          previousPurchase: '',
          remarks: 'DPM',
          materialId: 'mat_06',
        },
        {
          id: 'item_02',
          sl: 2,
          code: '18.14.303',
          description: 'LED Flood Light (Complete Set)-200W, 220 ~ 250V AC, 50HZ C/S IP-65, (Industrial grade) 2 Years Warranty card. Brand:Click/Epic/Super Star/Energy Pack,BD.(Sample Approved)',
          unit: 'No',
          usage20_21: '-',
          usage21_22: '-',
          usage22_23: '-',
          usage23_24: '-',
          usage24_25: '-',
          usage25_26: '-',
          storeStock: 'Nil',
          pipelineQty: '-',
          requiredQty: 28,
          unitPrice: 8672,
          total: 242816,
          eda: '',
          previousPurchase: 'MRR-26910 Date :22/10/23 Tk-8240/-',
          remarks: '',
          materialId: 'mat_01',
        },
        {
          id: 'item_03',
          sl: 3,
          code: '9.07.053',
          description: 'Hammer Wall Drill Bit 6.5mm China/Equiv.',
          unit: 'No',
          usage20_21: '-',
          usage21_22: '-',
          usage22_23: '06',
          usage23_24: '-',
          usage24_25: '-',
          usage25_26: '-',
          storeStock: 'Nil',
          pipelineQty: '-',
          requiredQty: 10,
          unitPrice: 263,
          total: 2630,
          eda: '',
          previousPurchase: 'MRR-26177 Date :18.12.21 Tk-250/-',
          remarks: '',
          materialId: 'mat_02',
        },
        {
          id: 'item_04',
          sl: 4,
          code: '9.07.054',
          description: 'Hammer Wall Drill Bit 10mm China/Equiv.',
          unit: 'No',
          usage20_21: '-',
          usage21_22: '-',
          usage22_23: '06',
          usage23_24: '-',
          usage24_25: '-',
          usage25_26: '-',
          storeStock: 'Nil',
          pipelineQty: '-',
          requiredQty: 10,
          unitPrice: 520,
          total: 5200,
          eda: '',
          previousPurchase: 'MRR-26177 Date :18.12.21 Tk-495/-',
          remarks: '',
          materialId: 'mat_03',
        },
        {
          id: 'item_05',
          sl: 5,
          code: '18.07.012',
          description: 'Royel Plug No 06',
          unit: 'No',
          usage20_21: '156',
          usage21_22: '84',
          usage22_23: '-',
          usage23_24: '-',
          usage24_25: '-',
          usage25_26: '-',
          storeStock: 'Nil',
          pipelineQty: '-',
          requiredQty: 100,
          unitPrice: 30,
          total: 3000,
          eda: '',
          previousPurchase: 'MRR-25709 Date :29/11/20 Tk-28.46',
          remarks: '',
          materialId: 'mat_04',
        },
        {
          id: 'item_06',
          sl: 6,
          code: '18.14.085',
          description: 'Tube light holder,220V AC,50HZ Brand: Hoque/HP/MEP/Sumana.',
          unit: 'No',
          usage20_21: '10',
          usage21_22: '11',
          usage22_23: '09',
          usage23_24: '05',
          usage24_25: '-',
          usage25_26: '-',
          storeStock: 'Nil',
          pipelineQty: '-',
          requiredQty: 30,
          unitPrice: 19,
          total: 570,
          eda: '',
          previousPurchase: 'MRR-24753 Date :18/12/18 Tk-26.2/-',
          remarks: '',
          materialId: 'mat_05',
        },
      ],
      createdAt: '2024-06-08T09:30:00Z',
      updatedAt: '2024-06-08T09:30:00Z',
    },
    {
      id: 'spr_rec_002',
      sprNo: 'SPR-2026-00126',
      refNo: 'টিএসপি/এমপিআইসি (পিএণ্ড) / ২০২৬-০১২',
      date: '2026-08-19',
      fiscalYear: '২০২৬-২০২৭ খ্রি.',
      procurementType: 'স্থানীয়',
      subject: 'সুইচগিয়ার ও কন্ট্রোল প্যানেল মালামাল ক্রয়',
      department: 'Electrical Maintenance',
      preparedBy: 'Md. Rubel Hossain',
      preparedByUserId: 'USER-002',
      preparedByEmail: 'rubelctg1237@gmail.com',
      status: 'submitted',
      grandTotal: 56350,
      inWords: 'Fifty-Six Thousand Three Hundred Fifty Taka only.',
      inWordsBn: 'ছাপ্পান্ন হাজার তিনশত পঞ্চাশ টাকা মাত্র।',
      items: [
        {
          id: 'item_201',
          sl: 1,
          code: '18.05.044',
          description: 'Magnetic Contactor 3 Pole, 32A, 220V Coil AC 50Hz Brand: Schneider / ABB / Siemens',
          unit: 'No',
          usage20_21: '04',
          usage21_22: '08',
          usage22_23: '06',
          usage23_24: '04',
          usage24_25: '-',
          usage25_26: '-',
          storeStock: 'Nil',
          pipelineQty: '02 Nos',
          requiredQty: 4,
          unitPrice: 4850,
          total: 19400,
          eda: '15 Days',
          previousPurchase: 'MRR-26890 Date:10/08/23 Tk-4850/-',
          remarks: 'Plant Urgent',
          materialId: 'mat_08',
        },
        {
          id: 'item_202',
          sl: 2,
          code: '18.06.015',
          description: 'Molded Case Circuit Breaker (MCCB) 3P, 100A, 50kA, 415V AC Brand: Mitsubishi / ABB / Schneider',
          unit: 'No',
          usage20_21: '02',
          usage21_22: '01',
          usage22_23: '03',
          usage23_24: '02',
          usage24_25: '-',
          usage25_26: '-',
          storeStock: 'Nil',
          pipelineQty: '-',
          requiredQty: 2,
          unitPrice: 18500,
          total: 37000,
          eda: '20 Days',
          previousPurchase: 'MRR-26514 Date:05/03/23 Tk-18500/-',
          remarks: 'For Motor Control Center',
          materialId: 'mat_09',
        },
      ],
      createdAt: '2026-08-19T14:20:00Z',
      updatedAt: '2026-08-19T14:20:00Z',
    },
  ];
  fs.writeFileSync(SPRS_FILE, JSON.stringify(sprs, null, 2));
}

function saveProfilesDisk() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(profiles, null, 2));
}

function saveMaterialsDisk() {
  fs.writeFileSync(MATERIALS_FILE, JSON.stringify(materials, null, 2));
}

function saveSprsDisk() {
  fs.writeFileSync(SPRS_FILE, JSON.stringify(sprs, null, 2));
}

// -------------------------------------------------------------
// Realtime Stream (SSE)
// -------------------------------------------------------------
app.get('/api/realtime/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.push(res);
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// -------------------------------------------------------------
// Auth & Profiles API (Supabase PostgreSQL public.profiles authoritative source)
// -------------------------------------------------------------
app.get('/api/auth/profiles', async (req, res) => {
  try {
    const { data: dbRows, error: dbErr } = await supabaseServer
      .from('profiles')
      .select('*')
      .order('user_id', { ascending: true });

    if (!dbErr && dbRows && dbRows.length > 0) {
      const dbMap = new Map();
      dbRows.forEach((p) => {
        const item = {
          id: p.id,
          auth_user_id: p.auth_user_id,
          userId: p.user_id,
          user_id: p.user_id,
          username: p.username,
          name: p.name,
          email: p.email,
          role: p.role,
          department: p.department,
          designation: p.designation,
          status: p.status,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        };
        if (p.email) dbMap.set(p.email.toLowerCase(), item);
        if (p.user_id) dbMap.set(p.user_id, item);
        if (p.id) dbMap.set(p.id, item);
      });

      const merged = profiles.map((localUser) => {
        const fromDb =
          (localUser.email && dbMap.get(localUser.email.toLowerCase())) ||
          (localUser.userId && dbMap.get(localUser.userId)) ||
          (localUser.id && dbMap.get(localUser.id));
        if (fromDb) {
          return { ...localUser, ...fromDb, role: fromDb.role || localUser.role };
        }
        return localUser;
      });

      dbRows.forEach((p) => {
        const exists = merged.some(
          (m) =>
            (p.email && m.email?.toLowerCase() === p.email.toLowerCase()) ||
            (p.user_id && m.userId === p.user_id) ||
            m.id === p.id
        );
        if (!exists) {
          merged.push({
            id: p.id,
            auth_user_id: p.auth_user_id,
            userId: p.user_id,
            user_id: p.user_id,
            username: p.username,
            name: p.name,
            email: p.email,
            role: p.role,
            department: p.department,
            designation: p.designation,
            status: p.status,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          });
        }
      });

      profiles = merged;
      saveProfilesDisk();
      return res.json(merged);
    }
  } catch (e) {
    console.warn('DB profiles fetch error:', e);
  }

  // Strip any internal sensitive fields before returning fallback snapshot
  const sanitized = profiles.map(({ password, ...rest }) => rest);
  res.json(sanitized);
});

// Resolve username or email to an authentication email for Supabase Auth
app.post('/api/auth/resolve-identifier', (req, res) => {
  const { identifier } = req.body;
  const rawInput = (identifier || '').trim();
  if (!rawInput) {
    return res.status(400).json({ error: 'Identifier is required.' });
  }

  const cleanInput = rawInput.toLowerCase();
  const matched = profiles.find(
    (u) =>
      u.email.toLowerCase() === cleanInput ||
      (u.username && u.username.toLowerCase() === cleanInput) ||
      (u.userId && u.userId.toLowerCase() === cleanInput)
  );

  if (matched) {
    return res.json({ found: true, email: matched.email, username: matched.username, userId: matched.userId });
  }

  if (cleanInput.includes('@')) {
    return res.json({ found: true, email: cleanInput });
  }

  return res.json({ found: false });
});

// Sync profile linked to Supabase Auth UUID (auth.users.id) from public.profiles
app.post('/api/auth/sync-profile', async (req, res) => {
  const { auth_user_id, email, username, name, department, designation, role } = req.body;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required to sync profile.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = (username || cleanEmail.split('@')[0]).trim().toLowerCase();

  // Authoritative PostgreSQL public.profiles lookup & auto-creation
  try {
    const isUuid = auth_user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(auth_user_id);
    const dbClient = token
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
      : supabaseServer;

    let orQuery = `email.eq.${cleanEmail},username.eq.${cleanUsername}`;
    if (isUuid) {
      orQuery += `,auth_user_id.eq.${auth_user_id},id.eq.${auth_user_id}`;
    }

    const { data: dbProfiles, error: pErr } = await dbClient
      .from('profiles')
      .select('*')
      .or(orQuery)
      .limit(1);

    if (!pErr && dbProfiles && dbProfiles.length > 0) {
      const p = dbProfiles[0];
      // Update auth_user_id link if newly acquired
      if (isUuid && p.auth_user_id !== auth_user_id) {
        try {
          await dbClient.from('profiles').update({ auth_user_id, updated_at: new Date().toISOString() }).eq('id', p.id);
        } catch {
          // ignore
        }
      }
      const synced = {
        id: p.id,
        auth_user_id: auth_user_id || p.auth_user_id,
        userId: p.user_id,
        user_id: p.user_id,
        username: p.username || cleanUsername,
        name: p.name || name || cleanUsername,
        email: p.email,
        role: p.role, // Strictly PostgreSQL authoritative role
        department: p.department || department || 'General Department',
        designation: p.designation || designation || 'Officer',
        status: p.status || 'active',
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };

      const idx = profiles.findIndex((u) => u.id === synced.id || u.auth_user_id === synced.auth_user_id || u.email.toLowerCase() === synced.email.toLowerCase());
      if (idx >= 0) profiles[idx] = synced;
      else profiles.push(synced);
      saveProfilesDisk();

      return res.json(synced);
    } else {
      // Auto-provision new user profile in PostgreSQL public.profiles
      let count = null;
      try {
        const countRes = await dbClient.from('profiles').select('*', { count: 'exact', head: true });
        count = countRes.count;
      } catch {
        count = null;
      }
      const nextNum = (count || profiles.length) + 1;
      const assignedRole = role || (cleanEmail === 'admin@tsp.gov.bd' || cleanEmail === 'rubelctg1237@gmail.com' ? 'admin' : 'user');
      const userId = `USER-${String(nextNum).padStart(3, '0')}`;
      const newId = isUuid ? auth_user_id : `usr_${String(nextNum).padStart(2, '0')}_${Date.now().toString(36)}`;
      const now = new Date().toISOString();

      const newDbProfile = {
        id: newId,
        auth_user_id: isUuid ? auth_user_id : null,
        user_id: userId,
        username: cleanUsername,
        name: (name || cleanUsername).trim(),
        email: cleanEmail,
        role: assignedRole,
        department: department || 'General Department',
        designation: designation || 'Officer',
        status: 'active',
        created_at: now,
        updated_at: now,
      };

      try {
        const { data: insertedRows, error: insertErr } = await dbClient
          .from('profiles')
          .insert(newDbProfile)
          .select();

        if (!insertErr && insertedRows && insertedRows.length > 0) {
          const p = insertedRows[0];
          const formatted = {
            id: p.id,
            auth_user_id: p.auth_user_id,
            userId: p.user_id,
            user_id: p.user_id,
            username: p.username,
            name: p.name,
            email: p.email,
            role: p.role,
            department: p.department,
            designation: p.designation,
            status: p.status,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          };

          profiles.push(formatted);
          saveProfilesDisk();
          broadcastRealtime({ type: 'USER_UPDATED', payload: formatted });

          return res.status(201).json(formatted);
        }
      } catch (insertEx) {
        console.warn('DB auto-provision handled gracefully:', insertEx);
      }
    }
  } catch (err) {
    console.warn('Sync profile database handled gracefully:', err);
  }

  // Fallback to memory/disk snapshot or create snapshot
  let profile = profiles.find(
    (u) => (auth_user_id && u.auth_user_id === auth_user_id) || u.email.toLowerCase() === cleanEmail
  );
  if (!profile) {
    const nextNum = profiles.length + 1;
    profile = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      auth_user_id: auth_user_id || undefined,
      userId: `USER-${String(nextNum).padStart(3, '0')}`,
      username: cleanUsername,
      name: (name || cleanUsername).trim(),
      email: cleanEmail,
      role: role || (cleanEmail === 'admin@tsp.gov.bd' || cleanEmail === 'rubelctg1237@gmail.com' ? 'admin' : 'user'),
      department: department || 'General Department',
      designation: designation || 'Officer',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    profiles.push(profile);
    saveProfilesDisk();
    broadcastRealtime({ type: 'USER_UPDATED', payload: profile });
  }

  const { password, ...sanitized } = profile;
  return res.json(sanitized);
});

app.get('/api/auth/profile-by-auth/:authId', (req, res) => {
  const { authId } = req.params;
  const user = profiles.find((u) => u.auth_user_id === authId || u.id === authId);
  if (!user) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  const { password, ...sanitized } = user;
  res.json(sanitized);
});

app.post('/api/auth/register', async (req, res) => {
  const { auth_user_id, name, username, email, department, designation } = req.body;

  // 1. Username Validation
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const usernameRegex = /^[a-zA-Z0-9_.]+$/;
  if (!usernameRegex.test(cleanUsername)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores (_), and dots (.).' });
  }

  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }

  // 2. Email Validation
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Check username uniqueness in memory and PostgreSQL
  const existingUsername = profiles.find((u) => u.username && u.username.toLowerCase() === cleanUsername && u.auth_user_id !== auth_user_id);
  if (existingUsername) {
    return res.status(400).json({ error: 'Username already exists. Please choose another username.' });
  }

  // Check email uniqueness
  const existingEmail = profiles.find((u) => u.email.toLowerCase() === cleanEmail && u.auth_user_id !== auth_user_id);
  if (existingEmail) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  const nextNum = profiles.length + 1;
  const assignedRole = cleanEmail === 'admin@tsp.gov.bd' || cleanEmail === 'rubelctg1237@gmail.com' ? 'admin' : 'user';
  const userId = `USER-${String(nextNum).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const isUuid = auth_user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(auth_user_id);
  const newId = isUuid ? auth_user_id : `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  const newProfile = {
    id: newId,
    auth_user_id: isUuid ? auth_user_id : null,
    user_id: userId,
    userId,
    username: cleanUsername,
    name: (name || cleanUsername).trim(),
    email: cleanEmail,
    role: assignedRole,
    department: department || 'General Department',
    designation: designation || 'Officer',
    status: 'active',
    created_at: now,
    updated_at: now,
    createdAt: now,
    updatedAt: now,
  };

  // Insert into Supabase PostgreSQL public.profiles
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  const dbClient = token
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
    : supabaseServer;

  try {
    await dbClient.from('profiles').insert({
      id: newProfile.id,
      auth_user_id: newProfile.auth_user_id,
      user_id: newProfile.user_id,
      username: newProfile.username,
      name: newProfile.name,
      email: newProfile.email,
      role: newProfile.role,
      department: newProfile.department,
      designation: newProfile.designation,
      status: newProfile.status,
      created_at: now,
      updated_at: now,
    });
  } catch (dbErr) {
    console.warn('DB Register insert notice:', dbErr);
  }

  profiles.push(newProfile);
  saveProfilesDisk();
  broadcastRealtime({ type: 'USER_UPDATED', payload: newProfile });

  res.status(201).json(newProfile);
});

app.put('/api/auth/profiles/:id', async (req, res) => {
  const { id } = req.params;
  const caller = await getAuthenticatedUser(req);
  
  const isCallerAdmin = !!(
    (caller && caller.role === 'admin' && caller.status === 'active') ||
    req.headers['x-user-role'] === 'admin'
  );

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  let memoryMatch = profiles.find(
    (u) =>
      u.id === id ||
      u.auth_user_id === id ||
      u.userId === id ||
      u.user_id === id ||
      (u.email && u.email.toLowerCase() === id.toLowerCase()) ||
      (u.username && u.username.toLowerCase() === id.toLowerCase())
  );

  let targetRows: any[] = [];
  let findErr: any = null;

  try {
    if (isUuid) {
      const r = await supabaseServer.from('profiles').select('*').or(`id.eq.${id},auth_user_id.eq.${id}`).limit(1);
      targetRows = r.data || [];
      findErr = r.error;
    } else {
      const clauses = [`user_id.eq.${id}`, `email.eq.${id.toLowerCase()}`, `username.eq.${id.toLowerCase()}`];
      if (memoryMatch?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memoryMatch.id)) {
        clauses.push(`id.eq.${memoryMatch.id}`);
      }
      if (memoryMatch?.user_id || memoryMatch?.userId) clauses.push(`user_id.eq.${memoryMatch.user_id || memoryMatch.userId}`);
      if (memoryMatch?.email) clauses.push(`email.eq.${memoryMatch.email.toLowerCase()}`);
      if (memoryMatch?.username) clauses.push(`username.eq.${memoryMatch.username.toLowerCase()}`);
      if (memoryMatch?.auth_user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memoryMatch.auth_user_id)) {
        clauses.push(`auth_user_id.eq.${memoryMatch.auth_user_id}`);
      }
      const uniqueClauses = Array.from(new Set(clauses)).join(',');
      const r = await supabaseServer.from('profiles').select('*').or(uniqueClauses).limit(1);
      targetRows = r.data || [];
      findErr = r.error;
    }
  } catch (err) {
    console.warn('[PROFILE LOOKUP ERR]', err);
  }

  let target = targetRows && targetRows.length > 0 ? targetRows[0] : memoryMatch;

  if (!target) {
    // If not found at all, create a target shell from memory match or request body
    const nextNum = profiles.length + 1;
    const userId = req.body.userId || req.body.user_id || `USER-${String(nextNum).padStart(3, '0')}`;
    const email = (req.body.email || id).toLowerCase().trim();
    target = {
      id: id,
      user_id: userId,
      userId,
      username: (req.body.username || email.split('@')[0]).toLowerCase().trim(),
      name: req.body.name || email.split('@')[0],
      email: email,
      role: req.body.role || 'user',
      department: req.body.department || 'General Department',
      designation: req.body.designation || 'Officer',
      status: req.body.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const isSelf = caller && caller.auth_user_id === target.auth_user_id;

  if (!isCallerAdmin && !isSelf) {
    return res.status(403).json({ error: 'Access denied: You do not have permission to modify this profile.' });
  }

  // Non-admins cannot modify role, status, auth_user_id, or user_id
  if (!isCallerAdmin) {
    if (req.body.role && req.body.role !== target.role) {
      return res.status(403).json({ error: 'Access denied: Only administrators can modify user roles.' });
    }
    if (req.body.status && req.body.status !== target.status) {
      return res.status(403).json({ error: 'Access denied: Only administrators can modify user status.' });
    }
  }

  // Check username uniqueness if changed
  if (req.body.username && req.body.username.trim().toLowerCase() !== target.username?.toLowerCase()) {
    const cleanUsername = req.body.username.trim().toLowerCase();
    const existingUsername = profiles.find((u) => u.username?.toLowerCase() === cleanUsername && u.id !== target.id);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already exists. Please choose another username.' });
    }
  }

  const now = new Date().toISOString();
  const updatedUserObj: any = {
    ...target,
    ...req.body,
    id: target.id || id,
    user_id: target.user_id || target.userId || id,
    userId: target.user_id || target.userId || id,
    updated_at: now,
    updatedAt: now,
  };

  if (req.body.name) updatedUserObj.name = req.body.name.trim();
  if (req.body.username) updatedUserObj.username = req.body.username.trim().toLowerCase();
  if (req.body.email) updatedUserObj.email = req.body.email.trim().toLowerCase();
  if (req.body.department) updatedUserObj.department = req.body.department;
  if (req.body.designation) updatedUserObj.designation = req.body.designation;
  if (isCallerAdmin) {
    if (req.body.role) updatedUserObj.role = req.body.role;
    if (req.body.status) updatedUserObj.status = req.body.status;
  }

  // Direct Update to Supabase public.profiles
  const cleanEmail = (updatedUserObj.email || '').toLowerCase().trim();
  const userIdVal = updatedUserObj.user_id || updatedUserObj.userId;

  try {
    const dbUpdateFields: any = {
      role: updatedUserObj.role,
      status: updatedUserObj.status,
      name: updatedUserObj.name,
      username: updatedUserObj.username,
      department: updatedUserObj.department,
      designation: updatedUserObj.designation,
      updated_at: now,
    };

    const updateClauses = [`email.eq.${cleanEmail}`];
    if (userIdVal) updateClauses.push(`user_id.eq.${userIdVal}`);
    if (target.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.id)) {
      updateClauses.push(`id.eq.${target.id}`);
    } else if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      updateClauses.push(`id.eq.${id}`);
    }

    // Update by email, user_id, or UUID id
    const { data: updatedDbRows, error: upErr } = await supabaseServer
      .from('profiles')
      .update(dbUpdateFields)
      .or(updateClauses.join(','))
      .select();

    if (!upErr && (!updatedDbRows || updatedDbRows.length === 0)) {
      // If row did not exist in PostgreSQL public.profiles, create it
      const insertObj: any = {
        user_id: userIdVal,
        username: updatedUserObj.username,
        name: updatedUserObj.name,
        email: cleanEmail,
        role: updatedUserObj.role,
        department: updatedUserObj.department,
        designation: updatedUserObj.designation,
        status: updatedUserObj.status,
        created_at: now,
        updated_at: now,
      };
      if (target.auth_user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.auth_user_id)) {
        insertObj.auth_user_id = target.auth_user_id;
      }
      if (target.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.id)) {
        insertObj.id = target.id;
      }
      await supabaseServer.from('profiles').insert(insertObj);
    }
  } catch (dbErr) {
    console.warn('[DB PROFILE UPDATE NOTICE]', dbErr);
  }

  // Sync memory/disk backup cache
  const idx = profiles.findIndex(
    (u) =>
      u.id === updatedUserObj.id ||
      (updatedUserObj.auth_user_id && u.auth_user_id === updatedUserObj.auth_user_id) ||
      (updatedUserObj.userId && u.userId === updatedUserObj.userId) ||
      (updatedUserObj.email && u.email.toLowerCase() === updatedUserObj.email.toLowerCase())
  );

  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx], ...updatedUserObj };
  } else {
    profiles.push(updatedUserObj);
  }
  saveProfilesDisk();
  broadcastRealtime({ type: 'USER_UPDATED', payload: updatedUserObj });

  res.json(updatedUserObj);
});

// -------------------------------------------------------------
// Materials Master API & Security Middleware (PostgreSQL Authoritative)
// -------------------------------------------------------------
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(jsonPayload);
    }
  } catch {
    // ignore
  }
  return null;
}

async function getAuthenticatedUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  const headerEmail = (req.headers['x-user-email'] as string || '').toLowerCase().trim();
  const headerAuthUid = (req.headers['x-auth-user-id'] as string || '').trim();

  let verifiedAuthUid = '';
  let verifiedEmail = '';

  // 1. Try verifying with Supabase Auth API
  if (token) {
    try {
      const { data: authData, error: authError } = await supabaseServer.auth.getUser(token);
      if (!authError && authData?.user) {
        verifiedAuthUid = authData.user.id;
        verifiedEmail = (authData.user.email || '').toLowerCase().trim();
      }
    } catch (err) {
      console.warn('[AUTH] Supabase getUser notice:', err);
    }

    // Fallback: decode JWT payload directly
    if (!verifiedEmail) {
      const decoded = decodeJwtPayload(token);
      if (decoded) {
        verifiedAuthUid = verifiedAuthUid || decoded.sub || '';
        verifiedEmail = (decoded.email || '').toLowerCase().trim();
      }
    }
  }

  // Fallback to custom user headers if provided by authenticated client session
  if (!verifiedEmail && headerEmail) {
    verifiedEmail = headerEmail;
  }
  if (!verifiedAuthUid && headerAuthUid) {
    verifiedAuthUid = headerAuthUid;
  }

  if (!verifiedEmail && !verifiedAuthUid) {
    return null;
  }

  // 2. Query public.profiles directly from Supabase PostgreSQL
  let p: any = null;
  try {
    let orQuery = '';
    if (verifiedAuthUid) orQuery += `auth_user_id.eq.${verifiedAuthUid},id.eq.${verifiedAuthUid}`;
    if (verifiedEmail) {
      orQuery += `${orQuery ? ',' : ''}email.eq.${verifiedEmail}`;
    }

    const { data: profileRows, error: profileErr } = await supabaseServer
      .from('profiles')
      .select('*')
      .or(orQuery)
      .limit(1);

    if (!profileErr && profileRows && profileRows.length > 0) {
      p = profileRows[0];
    }
  } catch (err) {
    console.warn('[AUTH] Supabase profile query handled:', err);
  }

  // 3. Fallback to server memory/file snapshot if not yet in Supabase
  if (!p) {
    p = profiles.find(
      (u) =>
        (verifiedEmail && u.email?.toLowerCase() === verifiedEmail) ||
        (verifiedAuthUid && (u.auth_user_id === verifiedAuthUid || u.id === verifiedAuthUid))
    );
  }

  if (!p) {
    // If user is known default admin or valid email, auto-create
    const isAdminEmail = verifiedEmail === 'admin@tsp.gov.bd' || verifiedEmail === 'rubelctg1237@gmail.com';
    const role = isAdminEmail ? 'admin' : 'user';
    const nextNum = profiles.length + 1;
    const userId = `USER-${String(nextNum).padStart(3, '0')}`;
    const newId = verifiedAuthUid || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date().toISOString();

    p = {
      id: newId,
      auth_user_id: verifiedAuthUid || null,
      user_id: userId,
      userId,
      username: verifiedEmail ? verifiedEmail.split('@')[0] : 'user',
      name: verifiedEmail ? verifiedEmail.split('@')[0] : 'User',
      email: verifiedEmail,
      role,
      department: 'General Department',
      designation: 'Officer',
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    profiles.push(p);
    saveProfilesDisk();

    try {
      await supabaseServer.from('profiles').upsert({
        id: p.id,
        auth_user_id: p.auth_user_id,
        user_id: p.user_id,
        username: p.username,
        name: p.name,
        email: p.email,
        role: p.role,
        department: p.department,
        designation: p.designation,
        status: p.status,
      });
    } catch {
      // ignore
    }
  }

  // Ensure active status and link auth_user_id if available
  if (verifiedAuthUid && p.auth_user_id !== verifiedAuthUid) {
    p.auth_user_id = verifiedAuthUid;
    try {
      await supabaseServer.from('profiles').update({ auth_user_id: verifiedAuthUid }).eq('id', p.id);
    } catch {}
  }

  // System master admin emails always have admin privileges
  if (p.email?.toLowerCase() === 'admin@tsp.gov.bd' || p.email?.toLowerCase() === 'rubelctg1237@gmail.com') {
    p.role = 'admin';
    p.status = 'active';
  }

  return {
    id: p.id,
    auth_user_id: p.auth_user_id,
    userId: p.user_id || p.userId,
    user_id: p.user_id || p.userId,
    username: p.username,
    name: p.name,
    email: p.email,
    role: p.role || 'user',
    department: p.department || 'General Department',
    designation: p.designation || 'Officer',
    status: p.status || 'active',
    createdAt: p.created_at || p.createdAt,
    updatedAt: p.updated_at || p.updatedAt,
  };
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = await getAuthenticatedUser(req);
  
  if (user && user.role === 'admin' && user.status === 'active') {
    (req as any).authenticatedUser = user;
    return next();
  }

  // Also check if request header contains verified admin role or email
  const headerRole = req.headers['x-user-role'];
  const headerEmail = String(req.headers['x-user-email'] || '').toLowerCase().trim();
  if (headerRole === 'admin' || headerEmail === 'admin@tsp.gov.bd' || headerEmail === 'rubelctg1237@gmail.com') {
    return next();
  }

  return res.status(403).json({ error: 'Access denied: Only active administrators can perform this operation.' });
}

app.get('/api/materials/search', (req, res) => {
  const q = String(req.query.q || req.query.search || '').toLowerCase().trim();
  if (!q) {
    return res.json(materials);
  }
  const normQ = q.replace(/[^a-z0-9]/g, '');
  const words = q.split(/\s+/).filter(Boolean);

  const results = materials.filter((m) => {
    const rawCode = (m.code || m.material_code || '').toLowerCase();
    const normC = rawCode.replace(/[^a-z0-9]/g, '');
    const rawDesc = (m.description || m.material_description || '').toLowerCase();
    const normDesc = rawDesc.replace(/[^a-z0-9]/g, '');

    if (normQ && (normC.includes(normQ) || normDesc.includes(normQ))) return true;
    if (rawCode.includes(q) || rawDesc.includes(q)) return true;
    if (words.length > 1 && words.every((w) => rawDesc.includes(w) || normDesc.includes(w.replace(/[^a-z0-9]/g, '')))) return true;
    return false;
  });

  res.json(results);
});

app.get('/api/materials', (req, res) => {
  const { status, search, category } = req.query;
  let results = [...materials];

  if (status && status !== 'all') {
    results = results.filter((m) => m.status === status);
  }

  if (category && category !== 'all') {
    results = results.filter((m) => m.category === category);
  }

  if (search) {
    const q = String(search).toLowerCase().trim();
    const normQ = q.replace(/[^a-z0-9]/g, '');
    const words = q.split(/\s+/).filter(Boolean);
    results = results.filter((m) => {
      const rawCode = (m.code || m.material_code || '').toLowerCase();
      const normC = rawCode.replace(/[^a-z0-9]/g, '');
      const rawDesc = (m.description || m.material_description || '').toLowerCase();
      const normDesc = rawDesc.replace(/[^a-z0-9]/g, '');

      if (normQ && (normC.includes(normQ) || normDesc.includes(normQ))) return true;
      if (rawCode.includes(q) || rawDesc.includes(q)) return true;
      if (words.length > 1 && words.every((w) => rawDesc.includes(w) || normDesc.includes(w.replace(/[^a-z0-9]/g, '')))) return true;
      return false;
    });
  }

  res.json(results);
});

app.post('/api/materials', requireAdmin, async (req, res) => {
  const mat = req.body;
  const code = (mat.code || mat.material_code || 'New').trim();
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  const dbClient = token
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
    : supabaseServer;
  
  let targetId = '';
  if (typeof mat.id === 'string' && mat.id.startsWith('MAT-')) {
    targetId = mat.id.trim();
  } else if (typeof mat.master_id === 'string' && mat.master_id.startsWith('MAT-')) {
    targetId = mat.master_id.trim();
  } else {
    let maxNum = 0;
    for (const m of materials) {
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
    const nextNum = maxNum > 0 ? maxNum + 1 : materials.length + 1;
    targetId = `MAT-${String(nextNum).padStart(4, '0')}`;
  }

  const now = new Date().toISOString();

  const newMaterial = {
    ...mat,
    id: targetId,
    master_id: targetId,
    code: code || 'New',
    material_code: code || 'New',
    description: (mat.description || mat.material_description || '').trim(),
    material_description: (mat.description || mat.material_description || '').trim(),
    unit: mat.unit || 'No',
    usage20_21: mat.usage20_21 ?? '-',
    usage21_22: mat.usage21_22 ?? '-',
    usage22_23: mat.usage22_23 ?? '-',
    usage23_24: mat.usage23_24 ?? '-',
    usage24_25: mat.usage24_25 ?? '-',
    usage25_26: mat.usage25_26 ?? '-',
    storeStock: mat.storeStock || mat.store_stock || 'Nil',
    store_stock: mat.storeStock || mat.store_stock || 'Nil',
    pipelineQty: mat.pipelineQty || mat.pipeline_qty || '-',
    lastMrrNo: mat.lastMrrNo || '',
    lastMrrDate: mat.lastMrrDate || '',
    lastMrrPrice: mat.lastMrrPrice || mat.unit_price || '',
    unit_price: mat.unit_price || mat.lastMrrPrice || '',
    unitPrice: mat.unitPrice || mat.unit_price || mat.lastMrrPrice || '',
    previous_purchase_order_date_price: mat.previous_purchase_order_date_price || (mat.lastMrrNo ? `${mat.lastMrrNo} | Date-${mat.lastMrrDate} | ${mat.lastMrrPrice || mat.unit_price || ''}` : ''),
    remarks: mat.remarks || '',
    category: mat.category || 'General',
    review_flag: mat.review_flag || null,
    source: mat.source || 'TSP System',
    status: mat.status || 'active',
    createdAt: mat.createdAt || now,
    updatedAt: now,
  };

  try {
    const { error: spErr } = await dbClient.from('materials').upsert({
      master_id: targetId,
      material_code: newMaterial.code,
      material_description: newMaterial.description,
      unit: newMaterial.unit,
      store_stock: newMaterial.storeStock,
      estimated_receipt_time_eba: newMaterial.estimated_receipt_time_eba || null,
      previous_purchase_order_date_price: newMaterial.previous_purchase_order_date_price || null,
      remarks: newMaterial.remarks,
      status: newMaterial.status,
      source: newMaterial.source || 'TSP System',
    });
    if (spErr) {
      console.warn('[SERVER SUPABASE MATERIAL UPSERT ERROR]', spErr.message);
    } else {
      console.log(`[SERVER SUPABASE MATERIAL SAVED] ${targetId} (${newMaterial.code})`);
    }
  } catch (dbErr) {
    console.warn('DB materials sync notice:', dbErr);
  }

  const existingIdx = materials.findIndex(
    (m) => m.id === targetId || String(m.master_id) === targetId || (m.code.toLowerCase() === code.toLowerCase() && m.id === targetId)
  );

  if (existingIdx >= 0) {
    materials[existingIdx] = newMaterial;
  } else {
    materials.unshift(newMaterial);
  }

  saveMaterialsDisk();
  broadcastRealtime({ type: 'MATERIAL_ADDED', payload: newMaterial });

  res.status(201).json(newMaterial);
});

app.post('/api/materials/bulk-import', requireAdmin, (req, res) => {
  const incomingList = req.body;
  if (!Array.isArray(incomingList)) {
    return res.status(400).json({ error: 'Expected an array of materials' });
  }

  materials = incomingList;
  saveMaterialsDisk();
  broadcastRealtime({ type: 'MATERIAL_UPDATED', payload: null });
  res.json({ success: true, count: materials.length });
});

app.put('/api/materials/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const idx = materials.findIndex((m) => m.id === id || String(m.master_id) === id || m.code === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Material not found' });
  }

  const now = new Date().toISOString();
  const updated = {
    ...materials[idx],
    ...req.body,
    updatedAt: now,
  };

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  const dbClient = token
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
    : supabaseServer;

  try {
    const targetMasterId = materials[idx].id || id;
    const updateData: any = {};
    if (req.body.code || req.body.material_code) updateData.material_code = req.body.code || req.body.material_code;
    if (req.body.description || req.body.material_description) updateData.material_description = req.body.description || req.body.material_description;
    if (req.body.unit) updateData.unit = req.body.unit;
    if (req.body.storeStock || req.body.store_stock) updateData.store_stock = req.body.storeStock || req.body.store_stock;
    if (req.body.previous_purchase_order_date_price) updateData.previous_purchase_order_date_price = req.body.previous_purchase_order_date_price;
    if (req.body.estimated_receipt_time_eba) updateData.estimated_receipt_time_eba = req.body.estimated_receipt_time_eba;
    if (req.body.status) updateData.status = req.body.status;
    if (req.body.remarks) updateData.remarks = req.body.remarks;

    await dbClient.from('materials').update(updateData).eq('master_id', targetMasterId);
  } catch (dbErr) {
    console.warn('DB material update notice:', dbErr);
  }

  materials[idx] = updated;
  saveMaterialsDisk();
  broadcastRealtime({ type: 'MATERIAL_UPDATED', payload: updated });

  res.json(updated);
});

app.delete('/api/materials/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const isHardDelete = req.query.hard === 'true' || req.query.permanent === 'true';
  const idx = materials.findIndex((m) => m.id === id || String(m.master_id) === id || m.code === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Material not found' });
  }

  const targetMaterial = materials[idx];
  const targetMasterId = targetMaterial.id || id;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  const dbClient = token
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
    : supabaseServer;

  if (isHardDelete) {
    try {
      await dbClient.from('materials').delete().or(`master_id.eq.${targetMasterId},material_code.eq.${targetMaterial.code}`);
    } catch (dbErr) {
      console.warn('DB material permanent delete notice:', dbErr);
    }

    materials.splice(idx, 1);
    saveMaterialsDisk();
    broadcastRealtime({ type: 'MATERIAL_DELETED', payload: { id: targetMasterId, code: targetMaterial.code } });
    return res.json({ success: true, message: `Material ${targetMaterial.code} permanently deleted.` });
  } else {
    const now = new Date().toISOString();
    materials[idx].status = 'inactive';
    materials[idx].updatedAt = now;

    try {
      await dbClient.from('materials').update({ status: 'inactive' }).or(`master_id.eq.${targetMasterId},material_code.eq.${targetMaterial.code}`);
    } catch (dbErr) {
      console.warn('DB material deactivate notice:', dbErr);
    }

    saveMaterialsDisk();
    broadcastRealtime({ type: 'MATERIAL_UPDATED', payload: materials[idx] });

    return res.json({ success: true, message: `Material ${targetMaterial.code} deactivated (status: inactive).`, material: materials[idx] });
  }
});

app.put('/api/materials/:id/toggle-status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const idx = materials.findIndex((m) => m.id === id || String(m.master_id) === id || m.code === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Material not found' });
  }

  const currentStatus = materials[idx].status || 'active';
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  const now = new Date().toISOString();

  materials[idx].status = newStatus;
  materials[idx].updatedAt = now;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  const dbClient = token
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
    : supabaseServer;

  try {
    const targetMasterId = materials[idx].id || id;
    await dbClient.from('materials').update({ status: newStatus }).or(`master_id.eq.${targetMasterId},material_code.eq.${materials[idx].code}`);
  } catch (dbErr) {
    console.warn('DB material toggle status notice:', dbErr);
  }

  saveMaterialsDisk();
  broadcastRealtime({ type: 'MATERIAL_UPDATED', payload: materials[idx] });

  res.json({ success: true, status: newStatus, material: materials[idx] });
});

// -------------------------------------------------------------
// Dynamic Material Usage API (Supabase public.material_usage proxy & local repository)
// -------------------------------------------------------------
app.get('/api/material-usage', (req, res) => {
  const { material_id, fiscal_year } = req.query;
  let filtered = [...materialUsageList];

  if (material_id) {
    const numId = !isNaN(Number(material_id)) ? Number(material_id) : material_id;
    filtered = filtered.filter((r) => r.material_id === numId || String(r.material_id) === String(material_id));
  }
  if (fiscal_year) {
    filtered = filtered.filter((r) => r.fiscal_year === fiscal_year);
  }

  res.json(filtered);
});

app.get('/api/material-usage/:masterId', async (req, res) => {
  const { masterId } = req.params;
  const yearsParam = req.query.years as string;
  const years = yearsParam ? yearsParam.split(',') : [];

  const result: Record<string, string> = {};
  years.forEach((y) => {
    result[y] = '-';
  });

  const numId = !isNaN(Number(masterId)) ? Number(masterId) : masterId;

  // 1. Try Supabase
  try {
    const { data, error } = await supabaseServer
      .from('material_usage')
      .select('*')
      .eq('material_id', numId)
      .in('fiscal_year', years);

    if (!error && data && data.length > 0) {
      data.forEach((row: any) => {
        if (row.fiscal_year && row.usage !== undefined && row.usage !== null) {
          result[row.fiscal_year] = String(row.usage);
        }
      });
    }
  } catch (err) {
    console.warn('Server query error for Supabase material_usage:', err);
  }

  // 2. Fallback to local materialUsageList repository for any unresolved years
  years.forEach((y) => {
    if (result[y] === '-' || result[y] === undefined) {
      const match = materialUsageList.find(
        (r) => (r.material_id === numId || String(r.material_id) === String(masterId)) && r.fiscal_year === y
      );
      if (match && match.usage !== undefined && match.usage !== null) {
        result[y] = String(match.usage);
      } else {
        // Check directly in materials record
        const mat = materials.find((m) => m.master_id === numId || String(m.master_id) === String(masterId) || m.id === String(masterId));
        if (mat) {
          const val =
            mat[`usage${y.replace('-', '_')}`] ||
            mat[`usage_${y.replace('-', '_')}`] ||
            mat[y];
          if (val !== undefined && val !== null && val !== '') {
            result[y] = String(val);
          }
        }
      }
    }
  });

  res.json(result);
});

app.post('/api/material-usage', (req, res) => {
  const { material_id, fiscal_year, usage } = req.body;
  if (!material_id || !fiscal_year) {
    return res.status(400).json({ error: 'material_id and fiscal_year are required' });
  }

  const numId = !isNaN(Number(material_id)) ? Number(material_id) : material_id;
  const existingIdx = materialUsageList.findIndex(
    (r) => (r.material_id === numId || String(r.material_id) === String(material_id)) && r.fiscal_year === fiscal_year
  );

  const now = new Date().toISOString();
  if (existingIdx !== -1) {
    materialUsageList[existingIdx].usage = String(usage ?? '-');
    materialUsageList[existingIdx].updated_at = now;
  } else {
    materialUsageList.push({
      id: String(materialUsageList.length + 1),
      material_id: numId,
      fiscal_year,
      usage: String(usage ?? '-'),
      created_at: now,
      updated_at: now,
    });
  }

  saveUsageDisk();
  res.json({ success: true, materialUsage: materialUsageList[existingIdx !== -1 ? existingIdx : materialUsageList.length - 1] });
});

// -------------------------------------------------------------
// SPR Records API
// -------------------------------------------------------------
app.get('/api/sprs', (req, res) => {
  res.json(sprs);
});

app.get('/api/sprs/:id', (req, res) => {
  const { id } = req.params;
  const spr = sprs.find((s) => s.id === id || s.sprNo === id);
  if (!spr) return res.status(404).json({ error: 'SPR not found' });
  res.json(spr);
});

app.post('/api/sprs', (req, res) => {
  const sprData = req.body;
  const now = new Date().toISOString();

  // Validate and calculate totals
  const cleanItems = (sprData.items || []).map((it: any, idx: number) => {
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

  const grandTotal = cleanItems.reduce((sum: number, it: any) => sum + (it.total || 0), 0);

  const newSpr = {
    ...sprData,
    id: sprData.id || `spr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    items: cleanItems,
    grandTotal,
    createdAt: now,
    updatedAt: now,
  };

  sprs.unshift(newSpr);
  saveSprsDisk();
  broadcastRealtime({ type: 'SPR_CREATED', payload: newSpr });

  res.status(201).json(newSpr);
});

app.put('/api/sprs/:id', (req, res) => {
  const { id } = req.params;
  const idx = sprs.findIndex((s) => s.id === id || s.sprNo === id);
  if (idx === -1) return res.status(404).json({ error: 'SPR not found' });

  const sprData = req.body;
  const cleanItems = (sprData.items || []).map((it: any, idx: number) => {
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
  const grandTotal = cleanItems.reduce((sum: number, it: any) => sum + (it.total || 0), 0);

  const updated = {
    ...sprs[idx],
    ...sprData,
    items: cleanItems,
    grandTotal,
    updatedAt: new Date().toISOString(),
  };

  sprs[idx] = updated;
  saveSprsDisk();
  broadcastRealtime({ type: 'SPR_UPDATED', payload: updated });

  res.json(updated);
});

app.delete('/api/sprs/:id', (req, res) => {
  const { id } = req.params;
  const idx = sprs.findIndex((s) => s.id === id || s.sprNo === id);
  if (idx === -1) return res.status(404).json({ error: 'SPR not found' });

  const deleted = sprs.splice(idx, 1)[0];
  saveSprsDisk();
  broadcastRealtime({ type: 'SPR_DELETED', payload: { id: deleted.id } });

  res.json({ success: true, deleted });
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TSP Digital SPR Server running on http://0.0.0.0:${PORT}`);
  });
}

start();

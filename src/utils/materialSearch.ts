import { Material } from '../types';

/**
 * Normalizes code/string by removing all non-alphanumeric characters (. - / spaces etc.)
 * and converting to lowercase for robust search comparison.
 * e.g., "18.08.203", "1808203", "18-08-203", "18 08 203" -> "1808203"
 */
export function normalizeCode(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes general text for search comparison
 */
export function normalizeSearchTerm(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Universal search function for TSP Material Catalogue.
 *
 * RULES:
 * 1. Duplicate material codes are VALID and preserved (never deduplicated or merged).
 * 2. Search matches against Material Code (ignoring formatting like . - / spaces),
 *    Master ID (e.g. MAT-0070, 70), Description (case-insensitive substring/words), and remarks.
 * 3. Returns ALL matching records across the entire materials list.
 */
export function searchMaterialsUniversal(
  materials: Material[],
  query: string,
  categoryFilter: string = 'all'
): Material[] {
  if (!materials || !Array.isArray(materials)) return [];

  let list = materials;
  if (categoryFilter && categoryFilter !== 'all') {
    list = list.filter((m) => (m.category || 'General') === categoryFilter);
  }

  const rawQ = (query || '').trim();
  if (!rawQ) {
    return list;
  }

  const lowerQ = rawQ.toLowerCase();
  const normQ = normalizeCode(rawQ);
  const words = lowerQ.split(/\s+/).filter(Boolean);

  const scored = list.map((mat) => {
    const rawCode = mat.code || mat.material_code || '';
    const lowerCode = rawCode.toLowerCase();
    const normC = normalizeCode(rawCode);

    const masterIdStr = mat.master_id !== undefined && mat.master_id !== null ? String(mat.master_id) : '';
    const idStr = String(mat.id || '');
    const normId = normalizeCode(idStr);
    const normMasterId = normalizeCode(masterIdStr);

    const rawDesc = mat.description || mat.material_description || '';
    const lowerDesc = rawDesc.toLowerCase();
    const normDesc = normalizeCode(rawDesc);

    const cat = (mat.category || '').toLowerCase();
    const unit = (mat.unit || '').toLowerCase();
    const remarks = (mat.remarks || '').toLowerCase();
    const lastMrr = (mat.lastMrrNo || '').toLowerCase();
    const allCombined = `${lowerCode} ${lowerDesc} ${cat} ${unit} ${remarks} ${lastMrr} ${masterIdStr} ${idStr.toLowerCase()}`;

    let score = 0;

    // 1. MATERIAL CODE MATCHES (Highest Priority)
    if (normQ && normC === normQ) {
      score += 3000; // Exact normalized code match ("18.08.203" === "1808203")
    } else if (lowerCode === lowerQ) {
      score += 2500;
    } else if (normQ && normC.startsWith(normQ)) {
      score += 1600; // Prefix code match ("1808" matches "18.08.203")
    } else if (lowerCode.startsWith(lowerQ)) {
      score += 1400;
    } else if (normQ && normC.includes(normQ)) {
      score += 1100; // Substring code match
    } else if (lowerCode.includes(lowerQ)) {
      score += 900;
    }

    // 2. MASTER ID MATCH (e.g. MAT-0070, 70, MAT-70)
    if (rawQ === idStr || lowerQ === idStr.toLowerCase() || (normQ && normId === normQ)) {
      score += 2200;
    } else if (masterIdStr === rawQ || (normQ && normMasterId === normQ)) {
      score += 2000;
    } else if (normQ && (normId.includes(normQ) || normMasterId.includes(normQ))) {
      score += 800;
    }

    // 3. DESCRIPTION MATCHES (Case-insensitive & Substring)
    if (lowerDesc === lowerQ) {
      score += 1800;
    } else if (lowerDesc.startsWith(lowerQ)) {
      score += 1200;
    } else if (lowerDesc.includes(lowerQ)) {
      score += 850;
    } else if (normQ.length >= 3 && normDesc.includes(normQ)) {
      score += 650;
    }

    // 4. MULTI-WORD / PARTIAL PHRASE SEARCH (e.g. "motor cooling fan", "cooling fan 32mm")
    if (words.length > 1) {
      const allWordsMatch = words.every((w) => {
        const normW = normalizeCode(w);
        return (
          allCombined.includes(w) ||
          normC.includes(normW) ||
          normDesc.includes(normW)
        );
      });

      if (allWordsMatch) {
        score += 750;
      }
    } else if (words.length === 1 && score === 0) {
      if (allCombined.includes(lowerQ)) {
        score += 150;
      }
    }

    return { mat, score };
  });

  const matchingItems = scored.filter((item) => item.score > 0);

  // If there are exact normalized code matches (score >= 3000), prioritize returning all records matching that code
  const exactCodeMatches = matchingItems.filter((item) => item.score >= 3000);
  if (exactCodeMatches.length > 0 && normQ.length >= 4) {
    return exactCodeMatches.map((item) => item.mat);
  }

  return matchingItems
    .sort((a, b) => b.score - a.score)
    .map((item) => item.mat);
}

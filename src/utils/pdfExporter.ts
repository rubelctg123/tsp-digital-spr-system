import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SprRecord } from '../types';
import { formatCurrencyBDT } from './numberToWords';
import { getDynamicFiscalYears } from './fiscalYear';

/**
 * Formats a YYYY-MM-DD or any ISO date string to DD-MM-YYYY format
 */
export function formatDateDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

/**
 * Returns authentic SVG markup for TSP Complex Ltd logo matching official seal.
 */
function getTspLogoSvg(): string {
  return `
    <svg width="56" height="56" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; margin-bottom: 2px;">
      <defs>
        <path id="pdfTspLogoArc" d="M 28 108 A 72 72 0 0 1 172 108" fill="none" />
      </defs>

      <!-- Outer White Background Circle -->
      <circle cx="100" cy="100" r="96" fill="#ffffff" />

      <!-- Outer Green Ring -->
      <circle cx="100" cy="100" r="93" stroke="#006837" stroke-width="5.5" fill="none" />

      <!-- Inner Green Border for Upper Arc -->
      <path d="M 25 110 A 75 75 0 0 1 175 110" stroke="#006837" stroke-width="3.5" fill="none" />

      <!-- Curved Top Brand Text -->
      <text font-family="'Arial Black', 'Impact', sans-serif" font-size="16.5" font-weight="900" fill="#000000" letter-spacing="1.2">
        <textPath href="#pdfTspLogoArc" startOffset="50%" text-anchor="middle">
          TSP COMPLEX LTD.
        </textPath>
      </text>

      <!-- Left Laurel / Wheat Sprigs -->
      <g fill="#006837" stroke="#006837" stroke-width="0.5">
        <path d="M 22 84 Q 28 80 34 85 Q 27 89 22 84 Z" />
        <path d="M 26 73 Q 32 68 38 74 Q 31 78 26 73 Z" />
        <path d="M 33 63 Q 39 58 45 64 Q 38 68 33 63 Z" />
        <path d="M 20 95 Q 26 92 32 97 Q 25 101 20 95 Z" />
        <path d="M 29 104 Q 34 98 40 103 Q 35 108 29 104 Z" />
        <path d="M 35 90 Q 40 84 46 89 Q 41 95 35 90 Z" />
        <path d="M 40 77 Q 45 71 51 77 Q 46 82 40 77 Z" />
      </g>

      <!-- Right Laurel / Wheat Sprigs -->
      <g fill="#006837" stroke="#006837" stroke-width="0.5">
        <path d="M 178 84 Q 172 80 166 85 Q 173 89 178 84 Z" />
        <path d="M 174 73 Q 168 68 162 74 Q 169 78 174 73 Z" />
        <path d="M 167 63 Q 161 58 155 64 Q 162 68 167 63 Z" />
        <path d="M 180 95 Q 174 92 168 97 Q 175 101 180 95 Z" />
        <path d="M 171 104 Q 166 98 160 103 Q 165 108 171 104 Z" />
        <path d="M 165 90 Q 160 84 154 89 Q 159 95 165 90 Z" />
        <path d="M 160 77 Q 155 71 149 77 Q 154 82 160 77 Z" />
      </g>

      <!-- Bottom Half Industrial Gear -->
      <path
        d="M 14 110 L 34 110 L 34 126 L 48 126 L 53 148 L 67 142 L 77 163 L 92 155 L 100 178 L 108 178 L 116 155 L 131 163 L 141 142 L 155 148 L 160 126 L 174 126 L 174 110 L 194 110 A 95 95 0 0 1 6 110 Z"
        fill="#0f172a"
        stroke="#006837"
        stroke-width="4"
        stroke-linejoin="round"
      />

      <!-- Inner Gear Outline Rim -->
      <path d="M 38 120 A 68 68 0 0 0 162 120" stroke="#006837" stroke-width="3.5" fill="none" />

      <!-- Center Inner Circle: Field & Seedling Plant -->
      <circle cx="100" cy="98" r="54" fill="#ffffff" stroke="#006837" stroke-width="4" />
      <path d="M 47 114 A 54 54 0 0 0 153 114 L 47 114 Z" fill="#006837" />

      <!-- Plant Seedling Stem -->
      <rect x="97" y="52" width="6" height="64" fill="#006837" />
      <line x1="100" y1="52" x2="100" y2="114" stroke="#ffffff" stroke-width="3.5" />

      <!-- Central Vertical Leaf -->
      <path d="M 100 38 C 91 55 91 76 100 86 C 109 76 109 55 100 38 Z" fill="#006837" stroke="#ffffff" stroke-width="2.5" />

      <!-- Left Curved Sprouting Leaf -->
      <path d="M 100 78 C 82 66 58 70 50 86 C 68 94 92 88 100 78 Z" fill="#006837" stroke="#ffffff" stroke-width="2.5" />

      <!-- Right Curved Sprouting Leaf -->
      <path d="M 100 78 C 118 66 142 70 150 86 C 132 94 108 88 100 78 Z" fill="#006837" stroke="#ffffff" stroke-width="2.5" />

      <!-- Ground Divider Line -->
      <line x1="47" y1="114" x2="153" y2="114" stroke="#ffffff" stroke-width="3" />
    </svg>
  `;
}

/**
 * Creates a clean, standard HTML string for an SPR document formatted for full-page landscape.
 * Calibrated to fill the entire page cleanly without large unused side/top margins.
 */
export function generateSprHtml(spr: SprRecord): string {
  const fiscalYears = getDynamicFiscalYears();
  const fyColWidth = 10.5 / (fiscalYears.length || 3);
  const formattedDate = formatDateDDMMYYYY(spr.date);

  const itemsRowsHtml = spr.items
    .map((item, idx) => {
      const usageCells = fiscalYears
        .map((fy) => {
          const val =
            item.usageByYear?.[fy] ??
            item[fy] ??
            item[`usage_${fy.replace('-', '_')}`] ??
            item[`usage${fy.replace('-', '_')}`] ??
            '-';
          return `<td style="border: 1px solid #0f172a; padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-size: 11px; word-break: break-all; color: #020617;">${val}</td>`;
        })
        .join('');

      return `
        <tr style="page-break-inside: avoid; break-inside: avoid;">
          <td style="border: 1px solid #0f172a; padding: 4px 2px; text-align: center; vertical-align: middle; font-weight: bold; font-size: 11.5px; color: #020617;">${item.sl || idx + 1}</td>
          <td style="border: 1px solid #0f172a; padding: 4px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: bold; font-size: 11px; color: #020617;">${item.code || '-'}</td>
          <td style="border: 1px solid #0f172a; padding: 4px 6px; text-align: left; vertical-align: middle; font-size: 11.5px; line-height: 1.35; white-space: pre-wrap; word-break: break-word; color: #020617;">${item.description || ''}</td>
          <td style="border: 1px solid #0f172a; padding: 4px 2px; text-align: center; vertical-align: middle; font-size: 11px; color: #020617;">${item.unit || 'No'}</td>
          ${usageCells}
          <td style="border: 1px solid #0f172a; padding: 4px 2px; text-align: center; vertical-align: middle; font-size: 11px; color: #020617;">${item.storeStock || 'Nil'}</td>
          <td style="border: 1px solid #0f172a; padding: 4px 2px; text-align: center; vertical-align: middle; font-size: 11px; color: #020617;">${item.pipelineQty || '-'}</td>
          <td style="border: 1px solid #0f172a; padding: 4px 2px; text-align: center; vertical-align: middle; font-weight: bold; font-size: 11.5px; color: #020617;">${item.requiredQty}</td>
          <td style="border: 1px solid #0f172a; padding: 4px 4px; text-align: right; vertical-align: middle; font-family: monospace; font-size: 11px; white-space: nowrap; color: #020617;">${formatCurrencyBDT(item.unitPrice)}/-</td>
          <td style="border: 1px solid #0f172a; padding: 4px 4px; text-align: right; vertical-align: middle; font-family: monospace; font-weight: bold; font-size: 11.5px; color: #020617; white-space: nowrap;">${formatCurrencyBDT(item.total)}/-</td>
          <td style="border: 1px solid #0f172a; padding: 4px 2px; text-align: center; vertical-align: middle; font-size: 10.5px; color: #020617;">${item.eda || ''}</td>
          <td style="border: 1px solid #0f172a; padding: 4px 4px; text-align: left; vertical-align: middle; font-family: monospace; font-size: 10px; line-height: 1.25; white-space: pre-wrap; word-break: break-word; color: #020617;">${item.previousPurchase || '-'}</td>
          <td style="border: 1px solid #0f172a; padding: 4px 2px; text-align: center; vertical-align: middle; font-size: 10.5px; color: #020617;">${item.remarks || ''}</td>
        </tr>
      `;
    })
    .join('');

  const fyHeaderCols = fiscalYears
    .map(
      (fy) =>
        `<th style="border: 1px solid #0f172a; padding: 3px 1px; font-weight: 600; font-size: 10.5px; background-color: #f1f5f9; color: #020617; text-align: center; vertical-align: middle;">${fy}</th>`
    )
    .join('');

  return `
    <div id="spr-doc-root" style="width: 1420px; background: #ffffff; color: #000000; font-family: 'Noto Serif Bengali', 'Hind Siliguri', 'Kalpurush', 'Times New Roman', Times, serif; box-sizing: border-box; padding: 8px 12px; margin: 0 auto;">
      <!-- Header -->
      <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px;">
        <tr>
          <!-- Left Reference -->
          <td style="width: 25%; vertical-align: top; font-size: 12px; line-height: 1.5;">
            <p style="font-weight: bold; margin: 0; color: #0f172a;">সূত্র নং- ${spr.refNo || 'টিএসপি/এমপিআইসি (পিএণ্ড) / ------------'}</p>
            <p style="margin: 4px 0 0 0; color: #334155; font-size: 11.5px;">SPR No: <strong style="color: #020617; font-family: monospace; font-size: 12.5px;">${spr.sprNo}</strong></p>
            <p style="margin: 2px 0 0 0; color: #334155; font-size: 11.5px;">User ID: <span style="font-family: monospace; font-weight: 600; color: #0f172a;">${spr.preparedByUserId || 'USER-001'}</span></p>
          </td>

          <!-- Center Title & BCIC Logo -->
          <td style="width: 50%; vertical-align: top; text-align: center;">
            <div>${getTspLogoSvg()}</div>
            <h1 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px; color: #020617; line-height: 1.2;">টিএসপি কমপ্লেক্স লিঃ</h1>
            <h2 style="margin: 1px 0 0 0; font-size: 14px; font-weight: bold; letter-spacing: 1px; color: #0f172a;">TSP COMPLEX LTD.</h2>
            <p style="margin: 1px 0 0 0; font-size: 11.5px; font-weight: 600; color: #334155;">A COMPANY OF BCIC</p>
            <p style="margin: 1px 0 0 0; font-size: 11px; color: #475569;">পতেঙ্গা, চট্টগ্রাম-৪২০৪</p>
            <div style="display: inline-block; margin-top: 4px; margin-bottom: 4px;">
              <span style="font-size: 15px; font-weight: bold; padding: 0 16px 4px 16px; border-bottom: 2px solid #0f172a; color: #020617; display: inline-block; line-height: 1.5;">মালামাল ক্রয়ের অধিযাচন পত্র (এসপিআর)</span>
            </div>
          </td>

          <!-- Right Reference Box -->
          <td style="width: 25%; vertical-align: top; text-align: right; font-size: 12px; line-height: 1.5;">
            <div style="display: inline-block; text-align: left; font-size: 12px; color: #0f172a;">
              <p style="margin: 0;"><strong style="color: #020617;">ক্রয়ের ধরন :</strong> ${spr.procurementType || 'স্থানীয়'}</p>
              <p style="margin: 3px 0 0 0;"><strong style="color: #020617;">বৎসর :</strong> ${spr.fiscalYear || '২০২৪-২০২৫ খ্রি.'}</p>
              <p style="margin: 3px 0 0 0;"><strong style="color: #020617;">প্রসঙ্গ :</strong> ${spr.subject || 'বৈদ্যুতিক মালামাল ক্রয়'}</p>
              <p style="margin: 3px 0 0 0;"><strong style="color: #020617;">তারিখ :</strong> ${formattedDate}</p>
            </div>
          </td>
        </tr>
      </table>

      <!-- Main SPR Table with Precise 13-Column Proportions and Clean Header Cell Structure -->
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #0f172a; font-size: 11.5px; table-layout: fixed;">
        <colgroup>
          <col style="width: 3%;" />
          <col style="width: 7.5%;" />
          <col style="width: 24%;" />
          <col style="width: 3.5%;" />
          ${fiscalYears.map(() => `<col style="width: ${fyColWidth}%;" />`).join('')}
          <col style="width: 4.5%;" />
          <col style="width: 5.5%;" />
          <col style="width: 5%;" />
          <col style="width: 6%;" />
          <col style="width: 7.5%;" />
          <col style="width: 5%;" />
          <col style="width: 12.5%;" />
          <col style="width: 6%;" />
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 5px 2px; vertical-align: middle; text-align: center; color: #020617; font-weight: bold; font-size: 11.5px;">ক্র/ নং</th>
            <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 5px 2px; vertical-align: middle; text-align: center; color: #020617; font-weight: bold; font-size: 11.5px;">কোড নং</th>
            <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 5px 6px; vertical-align: middle; text-align: left; color: #020617; font-weight: bold; font-size: 11.5px;">মালামালের বিনির্দেশ</th>
            <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 5px 2px; vertical-align: middle; text-align: center; color: #020617; font-weight: bold; font-size: 11.5px;">একক</th>
            <th colspan="${fiscalYears.length}" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 3px 2px; vertical-align: middle; text-align: center; color: #020617; font-weight: bold; font-size: 11px;">
              বাৎসরিক ব্যবহার <br/>
              <span style="font-size: 9.5px; font-weight: normal;">(অন্তত গত ৩ বৎসর)</span>
            </th>
            <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 5px 2px; vertical-align: middle; text-align: center; line-height: 1.3; color: #020617; font-weight: bold; font-size: 11px;">সম্ভারের মজুদ</th>
            <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 5px 2px; vertical-align: middle; text-align: center; line-height: 1.3; color: #020617; font-weight: bold; font-size: 11px;">পাইপ লাইন +<br/>ক্রয়াদেশ ভুক্ত</th>
            <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 5px 2px; vertical-align: middle; text-align: center; line-height: 1.3; color: #020617; font-weight: bold; font-size: 11px;">বর্তমান<br/>প্রয়োজন</th>
            <th colspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 3px 2px; vertical-align: middle; text-align: center; color: #020617; font-weight: bold; font-size: 11px;">আনুমানিক মূল্য (টাকা)</th>
            <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 5px 2px; vertical-align: middle; text-align: center; line-height: 1.3; color: #020617; font-weight: bold; font-size: 10.5px;">মালামাল গ্রহণের<br/>আনুমানিক সময়<br/>(ইডিএ)</th>
            <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 5px 2px; vertical-align: middle; text-align: center; line-height: 1.3; color: #020617; font-weight: bold; font-size: 10.5px;">বিগত ক্রয়াদেশ নং,<br/>তাং ও মূল্য (টাকা)</th>
            <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 5px 2px; vertical-align: middle; text-align: center; line-height: 1.3; color: #020617; font-weight: bold; font-size: 10.5px;">মন্তব্য<br/>(যদি থাকে)</th>
          </tr>
          <tr>
            ${fyHeaderCols}
            <th style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 3px 2px; font-weight: 600; font-size: 10.5px; vertical-align: middle; text-align: center; color: #020617;">একক মূল্য (টাকা)</th>
            <th style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 3px 2px; font-weight: 600; font-size: 10.5px; vertical-align: middle; text-align: center; color: #020617;">মোট মূল্য (টাকা)</th>
          </tr>
          <!-- Reference Column Row (১ - ১৩) Middle aligned and Center aligned -->
          <tr style="background-color: #e2e8f0; color: #0f172a; font-weight: bold; text-align: center; font-size: 11px; height: 22px;">
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">১</th>
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">২</th>
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৩</th>
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৪</th>
            <th colspan="${fiscalYears.length}" style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৫</th>
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৬</th>
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৭</th>
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৮</th>
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৯</th>
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">১০</th>
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">১১</th>
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">১২</th>
            <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">১৩</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}

          <!-- Grand Total Row: Middle aligned vertically and Right aligned horizontally -->
          <tr style="font-weight: bold; background-color: #f8fafc; height: 32px;">
            <td colspan="10" style="border: 1px solid #0f172a; padding: 5px 16px; text-align: right; vertical-align: middle; text-transform: uppercase; font-size: 12px; color: #0f172a; letter-spacing: 0.5px;">
              TOTAL = (WITH VAT &amp; TAX)
            </td>
            <td colspan="3" style="border: 1px solid #0f172a; padding: 5px 16px; text-align: right; vertical-align: middle; font-family: monospace; font-size: 13.5px; color: #020617;">
              ৳ ${formatCurrencyBDT(spr.grandTotal)}/-
            </td>
          </tr>
          <!-- In Words Row -->
          <tr>
            <td colspan="13" style="border: 1px solid #0f172a; padding: 6px 12px; font-size: 12px; background-color: #ffffff; line-height: 1.4;">
              <div style="margin-bottom: 2px;">
                <strong style="color: #020617;">In words :</strong> <span style="font-style: italic; color: #0f172a; font-weight: 500;">${spr.inWords || 'Zero Taka only.'}</span>
              </div>
              ${
                spr.inWordsBn
                  ? `<div><strong style="color: #020617;">কথায় :</strong> <span style="color: #1e293b;">${spr.inWordsBn}</span></div>`
                  : ''
              }
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 7-Box Signatures Table (Standard BCIC layout) with middle-aligned headings and centered labels -->
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #0f172a; margin-top: 10px; text-align: center; font-size: 11px; table-layout: fixed; font-weight: 600;">
        <tr>
          <!-- Box 1: Prepared By -->
          <td style="border: 1.5px solid #0f172a; height: 105px; vertical-align: top; padding: 0; width: 14.28%;">
            <div style="height: 105px; display: flex; flex-direction: column; justify-content: space-between; padding: 5px 4px 4px 4px; box-sizing: border-box;">
              <div style="font-weight: bold; font-size: 11px; color: #020617; text-align: center;">প্রস্তুতকারীর সহি</div>
              <div style="font-size: 10px; font-weight: normal; color: #1e293b; line-height: 1.25; text-align: center;">
                <p style="font-weight: bold; color: #020617; margin: 0; font-size: 10px;">${spr.preparedBy || 'Md. Jalel Ahmed'} (${spr.preparedByUserId || 'USER-001'})</p>
                <p style="margin: 2px 0 0 0; font-size: 9.5px; color: #334155;">তাং- ${formattedDate}</p>
              </div>
            </div>
          </td>

          <!-- Box 2: User Dept Head -->
          <td style="border: 1.5px solid #0f172a; height: 105px; vertical-align: top; padding: 0; width: 14.28%;">
            <div style="height: 105px; display: flex; flex-direction: column; justify-content: space-between; padding: 5px 4px 4px 4px; box-sizing: border-box;">
              <div style="font-weight: bold; font-size: 11px; color: #020617; text-align: center;">ব্যবহারকারী বিভাগীয় প্রধানের সহি</div>
              <div style="font-size: 10px; font-weight: normal; color: #64748b; text-align: center;">স্বাক্ষর ও সীল</div>
            </div>
          </td>

          <!-- Box 3: Store Manager (Middle Aligned and Centered) -->
          <td style="border: 1.5px solid #0f172a; height: 105px; vertical-align: top; padding: 0; width: 14.28%;">
            <div style="border-bottom: 1.5px solid #0f172a; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #020617; text-align: center;">ব্যবস্থাপক (ভান্ডার)</div>
            <div style="display: flex; height: 79px;">
              <div style="flex: 1; border-right: 1.5px solid #0f172a; padding: 4px 2px; display: flex; flex-direction: column; justify-content: space-between; text-align: center; box-sizing: border-box;">
                <div style="font-size: 10px; font-weight: 600; color: #0f172a; text-align: center;">স্টোর কিপার</div>
                <div style="font-size: 9.5px; font-weight: normal; color: #64748b; text-align: center;">স্বাক্ষর</div>
              </div>
              <div style="flex: 1; padding: 4px 2px; display: flex; flex-direction: column; justify-content: space-between; text-align: center; box-sizing: border-box;">
                <div style="font-size: 10px; font-weight: 600; color: #0f172a; text-align: center;">সম্ভার কর্মকর্তা</div>
                <div style="font-size: 9.5px; font-weight: normal; color: #64748b; text-align: center;">স্বাক্ষর</div>
              </div>
            </div>
          </td>

          <!-- Box 4: MPIC Sub-divisional Head -->
          <td style="border: 1.5px solid #0f172a; height: 105px; vertical-align: top; padding: 0; width: 14.28%;">
            <div style="height: 105px; display: flex; flex-direction: column; justify-content: space-between; padding: 5px 4px 4px 4px; box-sizing: border-box;">
              <div style="font-weight: bold; font-size: 11px; color: #020617; text-align: center;">এমপিআইসি অনুবিভাগীয় প্রধান</div>
              <div style="font-size: 10px; font-weight: normal; color: #64748b; text-align: center;">স্বাক্ষর ও সীল</div>
            </div>
          </td>

          <!-- Box 5: Commercial Dept Head -->
          <td style="border: 1.5px solid #0f172a; height: 105px; vertical-align: top; padding: 0; width: 14.28%;">
            <div style="height: 105px; display: flex; flex-direction: column; justify-content: space-between; padding: 5px 4px 4px 4px; box-sizing: border-box;">
              <div style="font-weight: bold; font-size: 11px; color: #020617; text-align: center;">বাণিজ্যিক বিভাগীয় প্রধান</div>
              <div style="font-size: 10px; font-weight: normal; color: #64748b; text-align: center;">স্বাক্ষর ও সীল</div>
            </div>
          </td>

          <!-- Box 6: Accounts Dept Head -->
          <td style="border: 1.5px solid #0f172a; height: 105px; vertical-align: top; padding: 0; width: 14.28%;">
            <div style="height: 105px; display: flex; flex-direction: column; justify-content: space-between; padding: 5px 4px 4px 4px; box-sizing: border-box;">
              <div style="font-weight: bold; font-size: 11px; color: #020617; text-align: center;">হিসাব বিভাগীয় প্রধান</div>
              <div style="font-size: 10px; font-weight: normal; color: #64748b; text-align: center;">স্বাক্ষর ও সীল</div>
            </div>
          </td>

          <!-- Box 7: Managing Director -->
          <td style="border: 1.5px solid #0f172a; height: 105px; vertical-align: top; padding: 0; width: 14.28%; background-color: #f8fafc;">
            <div style="height: 105px; display: flex; flex-direction: column; justify-content: space-between; padding: 5px 4px 4px 4px; box-sizing: border-box;">
              <div style="font-weight: bold; font-size: 11px; color: #020617; text-align: center;">ম্যানেজিং ডিরেক্টর</div>
              <div style="font-size: 10.5px; color: #475569; font-weight: 600; text-align: center;">অনুমোদন</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Footer -->
      <table style="width: 100%; margin-top: 6px; font-family: monospace; font-size: 10.5px; color: #64748b;">
        <tr>
          <td style="text-align: left;">TSP COMPLEX LTD. • SYSTEM GENERATED SPR DOCUMENT</td>
          <td style="text-align: right;">Printed on: ${new Date().toLocaleDateString('en-GB')}</td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Captures an HTML string to an html2canvas canvas inside an isolated iframe
 * completely detached from Tailwind's CSS variable environment (no oklch color conflicts).
 */
async function captureSprHtmlToCanvas(htmlContent: string): Promise<HTMLCanvasElement> {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = '1480px';
  iframe.style.height = '1050px';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      throw new Error('Could not access iframe document');
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="bn">
        <head>
          <meta charset="utf-8">
          <title>SPR Document Export</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              background-color: #ffffff; 
              color: #000000; 
              font-family: 'Noto Serif Bengali', 'Hind Siliguri', 'Kalpurush', 'Times New Roman', Times, serif; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 0;
              padding: 0;
            }
            table { border-collapse: collapse; }
            th, td { vertical-align: middle; }
          </style>
        </head>
        <body style="background: #ffffff; margin: 0; padding: 0;">
          ${htmlContent}
        </body>
      </html>
    `);
    doc.close();

    // Give browser time to layout fonts and DOM elements inside the iframe
    await new Promise((resolve) => setTimeout(resolve, 150));

    const targetEl = doc.getElementById('spr-doc-root') || doc.body;

    const canvas = await html2canvas(targetEl as HTMLElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1480,
      windowHeight: 1050,
    });

    return canvas;
  } finally {
    if (iframe.parentElement) {
      document.body.removeChild(iframe);
    }
  }
}

/**
 * Converts a captured canvas into a high quality, compressed Standard Document (A4 landscape) PDF and downloads it.
 * Calibrated with tight 4mm margin so the table expands to fill the entire paper width and height cleanly.
 */
function saveCanvasAsStandardPdf(canvas: HTMLCanvasElement, filename: string): void {
  // Standard Document / A4 Paper Dimensions in landscape: 297 mm x 210 mm
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 4; // 4mm tight margin to fill the sheet

  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
  // Use high-quality JPEG for compact file size and sharp text
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  if (imgHeight <= pageHeight - margin * 2) {
    const topOffset = Math.max(3, (pageHeight - imgHeight) / 2);
    pdf.addImage(imgData, 'JPEG', margin, topOffset, imgWidth, imgHeight);
  } else {
    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);

    while (heightLeft > 0) {
      position = position - pageHeight + margin;
      pdf.addPage('a4', 'landscape');
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
    }
  }

  pdf.save(filename);
}

/**
 * Generates a complete, self-contained HTML page specifically engineered for Legal paper Landscape printing (14in x 8.5in).
 * Includes @page { size: 14in 8.5in; margin: 7mm; }, standard typography, authentic SVG logo,
 * full 13-column SPR table, total, in-words, and 7-box signatures.
 */
export function generatePrintableSprDocument(spr: SprRecord): string {
  const fiscalYears = getDynamicFiscalYears();
  const fyColWidth = 10.5 / (fiscalYears.length || 3);
  const formattedDate = formatDateDDMMYYYY(spr.date);

  const itemsRowsHtml = spr.items
    .map((item, idx) => {
      const usageCells = fiscalYears
        .map((fy) => {
          const val =
            item.usageByYear?.[fy] ??
            item[fy] ??
            item[`usage_${fy.replace('-', '_')}`] ??
            item[`usage${fy.replace('-', '_')}`] ??
            '-';
          return `<td style="border: 1px solid #0f172a; padding: 3px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-size: 9.5px; word-break: break-all; color: #020617;">${val}</td>`;
        })
        .join('');

      return `
        <tr style="page-break-inside: avoid; break-inside: avoid;">
          <td style="border: 1px solid #0f172a; padding: 3px 2px; text-align: center; vertical-align: middle; font-weight: bold; font-size: 10px; color: #020617;">${item.sl || idx + 1}</td>
          <td style="border: 1px solid #0f172a; padding: 3px 2px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: bold; font-size: 9.5px; color: #020617;">${item.code || '-'}</td>
          <td style="border: 1px solid #0f172a; padding: 3px 5px; text-align: left; vertical-align: middle; font-size: 10px; line-height: 1.35; white-space: pre-wrap; word-break: break-word; color: #020617;">${item.description || ''}</td>
          <td style="border: 1px solid #0f172a; padding: 3px 2px; text-align: center; vertical-align: middle; font-size: 9.5px; color: #020617;">${item.unit || 'No'}</td>
          ${usageCells}
          <td style="border: 1px solid #0f172a; padding: 3px 2px; text-align: center; vertical-align: middle; font-size: 9.5px; color: #020617;">${item.storeStock || 'Nil'}</td>
          <td style="border: 1px solid #0f172a; padding: 3px 2px; text-align: center; vertical-align: middle; font-size: 9.5px; color: #020617;">${item.pipelineQty || '-'}</td>
          <td style="border: 1px solid #0f172a; padding: 3px 2px; text-align: center; vertical-align: middle; font-weight: bold; font-size: 10px; color: #020617;">${item.requiredQty}</td>
          <td style="border: 1px solid #0f172a; padding: 3px 3px; text-align: right; vertical-align: middle; font-family: monospace; font-size: 9.5px; white-space: nowrap; color: #020617;">${formatCurrencyBDT(item.unitPrice)}/-</td>
          <td style="border: 1px solid #0f172a; padding: 3px 3px; text-align: right; vertical-align: middle; font-family: monospace; font-weight: bold; font-size: 10px; color: #020617; white-space: nowrap;">${formatCurrencyBDT(item.total)}/-</td>
          <td style="border: 1px solid #0f172a; padding: 3px 2px; text-align: center; vertical-align: middle; font-size: 9px; color: #020617;">${item.eda || ''}</td>
          <td style="border: 1px solid #0f172a; padding: 3px 4px; text-align: left; vertical-align: middle; font-family: monospace; font-size: 9px; line-height: 1.25; white-space: pre-wrap; word-break: break-word; color: #020617;">${item.previousPurchase || '-'}</td>
          <td style="border: 1px solid #0f172a; padding: 3px 2px; text-align: center; vertical-align: middle; font-size: 9px; color: #020617;">${item.remarks || ''}</td>
        </tr>
      `;
    })
    .join('');

  const fyHeaderCols = fiscalYears
    .map(
      (fy) =>
        `<th style="border: 1px solid #0f172a; padding: 2px 1px; font-weight: 600; font-size: 9px; background-color: #f1f5f9; color: #020617; text-align: center; vertical-align: middle;">${fy}</th>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <title>${spr.sprNo} - TSP COMPLEX LTD - SPR Document</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: 14in 8.5in;
      margin: 7mm;
    }
    
    @media print {
      @page {
        size: 14in 8.5in;
        margin: 7mm;
      }
      html, body {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-document,
      .spr-doc-wrapper {
        width: 100% !important;
        max-width: none !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        overflow: visible !important;
      }
      .no-print {
        display: none !important;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #ffffff;
      color: #000000;
      font-family: 'Noto Serif Bengali', 'Hind Siliguri', 'Kalpurush', 'Times New Roman', Times, serif;
      padding: 0;
      margin: 0;
      width: 100%;
      height: auto;
      min-height: 0;
      overflow: visible;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .print-document,
    .spr-doc-wrapper {
      width: 100%;
      max-width: none;
      height: auto;
      min-height: 0;
      margin: 0 auto;
      background: #ffffff;
      color: #000000;
      padding: 0;
      box-sizing: border-box;
      overflow: visible;
    }

    table {
      border-collapse: collapse;
      width: 100%;
    }

    .spr-main-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      page-break-inside: auto;
      break-inside: auto;
      border: 1.5px solid #0f172a;
      font-size: 10px;
    }

    .spr-main-table thead {
      display: table-header-group;
    }

    .spr-main-table tbody tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .spr-signatures-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #0f172a;
      margin-top: 8px;
      text-align: center;
      font-size: 9.5px;
      table-layout: fixed;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    th, td {
      border: 1px solid #0f172a;
      vertical-align: middle;
    }

    th {
      background-color: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .signature-box {
      height: 74px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 3px 2px;
      box-sizing: border-box;
      text-align: center;
    }
  </style>
  <script>
    (function() {
      var isClosed = false;
      function autoClose() {
        if (!isClosed) {
          isClosed = true;
          try {
            window.close();
          } catch(e) {
            console.warn('Could not auto-close print window:', e);
          }
        }
      }

      // Automatically close the temporary window after printing or cancelling
      window.addEventListener('afterprint', function() {
        autoClose();
      });
      window.onafterprint = function() {
        autoClose();
      };

      function doPrint() {
        window.focus();
        try {
          window.print();
        } catch(e) {
          console.warn('Print error:', e);
        }
        // When print() returns (after user prints or cancels), close the window
        setTimeout(function() {
          autoClose();
        }, 300);
      }

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          setTimeout(doPrint, 250);
        });
      } else if (document.readyState === 'complete') {
        setTimeout(doPrint, 250);
      } else {
        window.addEventListener('load', function() {
          setTimeout(doPrint, 250);
        });
      }
    })();
  </script>
</head>
<body>
  <div class="print-document spr-doc-wrapper">
    <!-- Header -->
    <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #0f172a; padding-bottom: 5px; margin-bottom: 6px;">
      <tr>
        <!-- Left Reference -->
        <td style="width: 25%; vertical-align: top; font-size: 11px; line-height: 1.45; border: none;">
          <p style="font-weight: bold; margin: 0; color: #0f172a;">সূত্র নং- ${spr.refNo || 'টিএসপি/এমপিআইসি (পিএণ্ড) / ------------'}</p>
          <p style="margin: 3px 0 0 0; color: #334155; font-size: 10.5px;">SPR No: <strong style="color: #020617; font-family: monospace; font-size: 11.5px;">${spr.sprNo}</strong></p>
          <p style="margin: 2px 0 0 0; color: #334155; font-size: 10.5px;">User ID: <span style="font-family: monospace; font-weight: 600; color: #0f172a;">${spr.preparedByUserId || 'USER-001'}</span></p>
        </td>

        <!-- Center Title & Authentic BCIC Logo -->
        <td style="width: 50%; vertical-align: top; text-align: center; border: none;">
          <div style="margin-bottom: 2px;">${getTspLogoSvg()}</div>
          <h1 style="margin: 0; font-size: 17px; font-weight: bold; letter-spacing: 0.5px; color: #020617; line-height: 1.2;">টিএসপি কমপ্লেক্স লিঃ</h1>
          <h2 style="margin: 1px 0 0 0; font-size: 12.5px; font-weight: bold; letter-spacing: 0.8px; color: #0f172a;">TSP COMPLEX LTD.</h2>
          <p style="margin: 1px 0 0 0; font-size: 10px; font-weight: 600; color: #334155;">A COMPANY OF BCIC</p>
          <p style="margin: 1px 0 0 0; font-size: 9.5px; color: #475569;">পতেঙ্গা, চট্টগ্রাম-৪২০৪</p>
          <div style="display: inline-block; margin-top: 2px; margin-bottom: 2px;">
            <span style="font-size: 13px; font-weight: bold; padding: 0 14px 2px 14px; border-bottom: 2px solid #0f172a; color: #020617; display: inline-block; line-height: 1.35;">মালামাল ক্রয়ের অধিযাচন পত্র (এসপিআর)</span>
          </div>
        </td>

        <!-- Right Reference Box -->
        <td style="width: 25%; vertical-align: top; text-align: right; font-size: 10.5px; line-height: 1.45; border: none;">
          <div style="display: inline-block; text-align: left; font-size: 10.5px; color: #0f172a;">
            <p style="margin: 0;"><strong style="color: #020617;">ক্রয়ের ধরন :</strong> ${spr.procurementType || 'স্থানীয়'}</p>
            <p style="margin: 2px 0 0 0;"><strong style="color: #020617;">বৎসর :</strong> ${spr.fiscalYear || '২০২৪-২০২৫ খ্রি.'}</p>
            <p style="margin: 2px 0 0 0;"><strong style="color: #020617;">প্রসঙ্গ :</strong> ${spr.subject || 'বৈদ্যুতিক মালামাল ক্রয়'}</p>
            <p style="margin: 2px 0 0 0;"><strong style="color: #020617;">তারিখ :</strong> ${formattedDate}</p>
          </div>
        </td>
      </tr>
    </table>

    <!-- Main SPR Table with 13 Columns on Legal Paper (Landscape) -->
    <table class="spr-main-table">
      <colgroup>
        <col style="width: 3%;" />
        <col style="width: 6.5%;" />
        <col style="width: 25%;" />
        <col style="width: 3.5%;" />
        ${fiscalYears.map(() => `<col style="width: ${fyColWidth}%;" />`).join('')}
        <col style="width: 4.5%;" />
        <col style="width: 4.5%;" />
        <col style="width: 4.5%;" />
        <col style="width: 6.5%;" />
        <col style="width: 7.5%;" />
        <col style="width: 4.5%;" />
        <col style="width: 13.5%;" />
        <col style="width: 6%;" />
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 4px 1px; vertical-align: middle; text-align: center; color: #020617; font-weight: bold; font-size: 9.5px;">ক্র/ নং</th>
          <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 4px 1px; vertical-align: middle; text-align: center; color: #020617; font-weight: bold; font-size: 9.5px;">কোড নং</th>
          <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 4px 4px; vertical-align: middle; text-align: left; color: #020617; font-weight: bold; font-size: 9.5px;">মালামালের বিনির্দেশ</th>
          <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 4px 1px; vertical-align: middle; text-align: center; color: #020617; font-weight: bold; font-size: 9.5px;">একক</th>
          <th colspan="${fiscalYears.length}" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 2px 1px; vertical-align: middle; text-align: center; color: #020617; font-weight: bold; font-size: 9px;">
            বাৎসরিক ব্যবহার <br/>
            <span style="font-size: 8px; font-weight: normal;">(অন্তত গত ৩ বৎসর)</span>
          </th>
          <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 4px 1px; vertical-align: middle; text-align: center; line-height: 1.2; color: #020617; font-weight: bold; font-size: 9px;">সম্ভারের মজুদ</th>
          <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 4px 1px; vertical-align: middle; text-align: center; line-height: 1.2; color: #020617; font-weight: bold; font-size: 9px;">পাইপ লাইন +<br/>ক্রয়াদেশ ভুক্ত</th>
          <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 4px 1px; vertical-align: middle; text-align: center; line-height: 1.2; color: #020617; font-weight: bold; font-size: 9px;">বর্তমান<br/>প্রয়োজন</th>
          <th colspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 2px 1px; vertical-align: middle; text-align: center; color: #020617; font-weight: bold; font-size: 9px;">আনুমানিক মূল্য (টাকা)</th>
          <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 4px 1px; vertical-align: middle; text-align: center; line-height: 1.2; color: #020617; font-weight: bold; font-size: 8.5px;">মালামাল গ্রহণের<br/>আনুমানিক সময়<br/>(ইডিএ)</th>
          <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 4px 1px; vertical-align: middle; text-align: center; line-height: 1.2; color: #020617; font-weight: bold; font-size: 8.5px;">বিগত ক্রয়াদেশ নং,<br/>তাং ও মূল্য (টাকা)</th>
          <th rowspan="2" style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 4px 1px; vertical-align: middle; text-align: center; line-height: 1.2; color: #020617; font-weight: bold; font-size: 8.5px;">মন্তব্য<br/>(যদি থাকে)</th>
        </tr>
        <tr>
          ${fyHeaderCols}
          <th style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 2px 1px; font-weight: 600; font-size: 8.5px; vertical-align: middle; text-align: center; color: #020617;">একক মূল্য (টাকা)</th>
          <th style="border: 1px solid #0f172a; background-color: #f1f5f9; padding: 2px 1px; font-weight: 600; font-size: 8.5px; vertical-align: middle; text-align: center; color: #020617;">মোট মূল্য (টাকা)</th>
        </tr>
        <!-- Reference Column Row (১ - ১৩) Middle aligned and Center aligned -->
        <tr style="background-color: #e2e8f0; color: #0f172a; font-weight: bold; text-align: center; font-size: 9.5px; height: 18px;">
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">১</th>
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">২</th>
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৩</th>
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৪</th>
          <th colspan="${fiscalYears.length}" style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৫</th>
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৬</th>
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৭</th>
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৮</th>
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">৯</th>
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">১০</th>
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">১১</th>
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">১২</th>
          <th style="border: 1px solid #0f172a; padding: 2px 0; vertical-align: middle; text-align: center; line-height: 1; font-weight: bold; color: #0f172a;">১৩</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}

        <!-- Grand Total Row: Middle aligned vertically and Right aligned horizontally -->
        <tr style="font-weight: bold; background-color: #f8fafc; height: 28px;">
          <td colspan="10" style="border: 1px solid #0f172a; padding: 4px 12px; text-align: right; vertical-align: middle; text-transform: uppercase; font-size: 10.5px; color: #0f172a; letter-spacing: 0.5px;">
            TOTAL = (WITH VAT &amp; TAX)
          </td>
          <td colspan="3" style="border: 1px solid #0f172a; padding: 4px 12px; text-align: right; vertical-align: middle; font-family: monospace; font-size: 11.5px; color: #020617;">
            ৳ ${formatCurrencyBDT(spr.grandTotal)}/-
          </td>
        </tr>
        <!-- In Words Row -->
        <tr>
          <td colspan="13" style="border: 1px solid #0f172a; padding: 4px 8px; font-size: 10.5px; background-color: #ffffff; line-height: 1.35;">
            <div style="margin-bottom: 2px;">
              <strong style="color: #020617;">In words :</strong> <span style="font-style: italic; color: #0f172a; font-weight: 500;">${spr.inWords || 'Zero Taka only.'}</span>
            </div>
            ${
              spr.inWordsBn
                ? `<div><strong style="color: #020617;">কথায় :</strong> <span style="color: #1e293b;">${spr.inWordsBn}</span></div>`
                : ''
            }
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 7-Box Signatures Table (Standard BCIC layout) -->
    <table class="spr-signatures-table">
      <tr>
        <!-- Box 1: Prepared By -->
        <td style="border: 1.5px solid #0f172a; height: 80px; vertical-align: top; padding: 0; width: 14.28%;">
          <div class="signature-box">
            <div style="font-weight: bold; font-size: 10px; color: #020617;">প্রস্তুতকারীর সহি</div>
            <div style="font-size: 9px; font-weight: normal; color: #1e293b; line-height: 1.25;">
              <p style="font-weight: bold; color: #020617; margin: 0; font-size: 9px;">${spr.preparedBy || 'Md. Jalel Ahmed'} (${spr.preparedByUserId || 'USER-001'})</p>
              <p style="margin: 2px 0 0 0; font-size: 8.5px; color: #334155;">তাং- ${formattedDate}</p>
            </div>
          </div>
        </td>

        <!-- Box 2: User Dept Head -->
        <td style="border: 1.5px solid #0f172a; height: 80px; vertical-align: top; padding: 0; width: 14.28%;">
          <div class="signature-box">
            <div style="font-weight: bold; font-size: 10px; color: #020617;">ব্যবহারকারী বিভাগীয় প্রধানের সহি</div>
            <div style="font-size: 9px; font-weight: normal; color: #64748b;">স্বাক্ষর ও সীল</div>
          </div>
        </td>

        <!-- Box 3: Store Manager (Subdivided into Store Keeper & Store Officer) -->
        <td style="border: 1.5px solid #0f172a; height: 80px; vertical-align: top; padding: 0; width: 14.28%;">
          <div style="border-bottom: 1.5px solid #0f172a; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; color: #020617;">ব্যবস্থাপক (ভান্ডার)</div>
          <div style="display: flex; height: 58px;">
            <div style="flex: 1; border-right: 1.5px solid #0f172a; padding: 2px 2px; display: flex; flex-direction: column; justify-content: space-between; text-align: center; box-sizing: border-box;">
              <div style="font-size: 9px; font-weight: 600; color: #0f172a;">স্টোর কিপার</div>
              <div style="font-size: 8.5px; font-weight: normal; color: #64748b;">স্বাক্ষর</div>
            </div>
            <div style="flex: 1; padding: 2px 2px; display: flex; flex-direction: column; justify-content: space-between; text-align: center; box-sizing: border-box;">
              <div style="font-size: 9px; font-weight: 600; color: #0f172a;">সম্ভার কর্মকর্তা</div>
              <div style="font-size: 8.5px; font-weight: normal; color: #64748b;">স্বাক্ষর</div>
            </div>
          </div>
        </td>

        <!-- Box 4: MPIC Sub-divisional Head -->
        <td style="border: 1.5px solid #0f172a; height: 80px; vertical-align: top; padding: 0; width: 14.28%;">
          <div class="signature-box">
            <div style="font-weight: bold; font-size: 10px; color: #020617;">এমপিআইসি অনুবিভাগীয় প্রধান</div>
            <div style="font-size: 9px; font-weight: normal; color: #64748b;">স্বাক্ষর ও সীল</div>
          </div>
        </td>

        <!-- Box 5: Commercial Dept Head -->
        <td style="border: 1.5px solid #0f172a; height: 80px; vertical-align: top; padding: 0; width: 14.28%;">
          <div class="signature-box">
            <div style="font-weight: bold; font-size: 10px; color: #020617;">বাণিজ্যিক বিভাগীয় প্রধান</div>
            <div style="font-size: 9px; font-weight: normal; color: #64748b;">স্বাক্ষর ও সীল</div>
          </div>
        </td>

        <!-- Box 6: Accounts Dept Head -->
        <td style="border: 1.5px solid #0f172a; height: 80px; vertical-align: top; padding: 0; width: 14.28%;">
          <div class="signature-box">
            <div style="font-weight: bold; font-size: 10px; color: #020617;">হিসাব বিভাগীয় প্রধান</div>
            <div style="font-size: 9px; font-weight: normal; color: #64748b;">স্বাক্ষর ও সীল</div>
          </div>
        </td>

        <!-- Box 7: Managing Director -->
        <td style="border: 1.5px solid #0f172a; height: 80px; vertical-align: top; padding: 0; width: 14.28%; background-color: #f8fafc;">
          <div class="signature-box">
            <div style="font-weight: bold; font-size: 10px; color: #020617;">ম্যানেজিং ডিরেক্টর</div>
            <div style="font-size: 9.5px; color: #475569; font-weight: 600;">অনুমোদন</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <table style="width: 100%; margin-top: 4px; font-family: monospace; font-size: 9px; color: #64748b; border: none;">
      <tr>
        <td style="text-align: left; border: none;">TSP COMPLEX LTD. • SYSTEM GENERATED SPR DOCUMENT</td>
        <td style="text-align: right; border: none;">Printed on: ${new Date().toLocaleDateString('en-GB')}</td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Downloads a single SPR as a standard document sized PDF.
 * Uses isolated iframe capture to completely avoid Tailwind v4 oklch CSS color parsing errors.
 */
export async function downloadSprPdf(spr: SprRecord): Promise<void> {
  const safeSprNo = spr.sprNo.replace(/[/\\?%*:|"<>]/g, '-');
  const filename = `${safeSprNo}_TSP_SPR.pdf`;

  const html = generateSprHtml(spr);
  const canvas = await captureSprHtmlToCanvas(html);
  saveCanvasAsStandardPdf(canvas, filename);
}

/**
 * Reliable, failsafe Print function that always triggers the browser's native print dialog
 * formatted strictly for Legal paper with 8mm margins.
 * 
 * Works across desktop browsers, mobile, and iframe/preview sandboxes by:
 * 1. Synchronously attempting window.open() on user click.
 * 2. Writing the standalone Legal print document with preloaded fonts and SVG logo.
 * 3. Falling back to an isolated dynamic print iframe if popup blocker intervenes.
 * 4. Falling back to window.print() if needed.
 */
export function printSprDocument(spr: SprRecord): boolean {
  const printableHtml = generatePrintableSprDocument(spr);

  // 1. Try opening dedicated print window synchronously from the user's click event
  let printWindow: Window | null = null;
  try {
    printWindow = window.open('', '_blank', 'width=1100,height=900,menubar=yes,toolbar=yes,location=no,status=no,titlebar=yes,scrollbars=yes');
  } catch (err) {
    console.warn('Could not open print window synchronously:', err);
  }

  if (printWindow && !printWindow.closed) {
    try {
      printWindow.document.open();
      printWindow.document.write(printableHtml);
      printWindow.document.close();

      const closePrintWin = () => {
        try {
          if (printWindow && !printWindow.closed) {
            printWindow.close();
          }
        } catch {
          // ignore
        }
      };

      try {
        printWindow.addEventListener('afterprint', closePrintWin);
        printWindow.onafterprint = closePrintWin;
      } catch {
        // ignore cross-origin restrictions if any
      }

      return true;
    } catch (writeErr) {
      console.warn('Error writing printable document to new window:', writeErr);
    }
  }

  // 2. Fallback: Create an isolated hidden printing iframe in the document body
  try {
    const existingFrame = document.getElementById('tsp-print-frame');
    if (existingFrame && existingFrame.parentElement) {
      existingFrame.parentElement.removeChild(existingFrame);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'tsp-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(printableHtml);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (iframeErr) {
          console.warn('Iframe print failed, falling back to window.print():', iframeErr);
          window.print();
        } finally {
          setTimeout(() => {
            if (iframe.parentElement) {
              document.body.removeChild(iframe);
            }
          }, 6000);
        }
      }, 300);
      return true;
    }
  } catch (err) {
    console.warn('Iframe printing setup failed:', err);
  }

  // 3. Fallback: Direct window.print()
  try {
    window.print();
    return true;
  } catch (fallbackErr) {
    console.error('All print mechanisms failed:', fallbackErr);
    alert('Unable to open the browser print dialog. Please check your browser popup or print permissions, or use "Save as PDF".');
    return false;
  }
}

/**
 * Exports ALL SPR records into a single multi-page standard document (A4 landscape) PDF.
 * Lightweight, fast, and optimized with tight 4mm margins.
 */
export async function exportAllSprsToPdf(
  sprList: SprRecord[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (!sprList || sprList.length === 0) {
    alert('No SPR records to export.');
    return;
  }

  const total = sprList.length;
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 4;

  for (let i = 0; i < total; i++) {
    const spr = sprList[i];
    if (onProgress) {
      onProgress(i + 1, total);
    }

    const html = generateSprHtml(spr);
    const canvas = await captureSprHtmlToCanvas(html);

    if (i > 0) {
      pdf.addPage('a4', 'landscape');
    }

    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.94);

    if (imgHeight <= pageHeight - margin * 2) {
      const topOffset = Math.max(3, (pageHeight - imgHeight) / 2);
      pdf.addImage(imgData, 'JPEG', margin, topOffset, imgWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = position - pageHeight + margin;
        pdf.addPage('a4', 'landscape');
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }
    }
  }

  const timestamp = new Date().toISOString().split('T')[0];
  pdf.save(`TSP_All_SPR_Records_${timestamp}.pdf`);
}

import * as XLSX from 'xlsx';
import { SprRecord } from '../types';
import { formatCurrencyBDT } from './numberToWords';
import { getDynamicFiscalYears } from './fiscalYear';

export function exportSprToExcel(spr: SprRecord) {
  const fiscalYears = getDynamicFiscalYears();

  // Construct formatted tabular data
  const titleRow = ['টিএসপি কমপ্লেক্স লিঃ (TSP COMPLEX LTD.) - A COMPANY OF BCIC'];
  const subTitleRow = ['মালামাল ক্রয়ের অধিযাচন পত্র (এসপিআর) / STORE PURCHASE REQUISITION'];
  const emptyRow = [''];
  
  const headerInfo1 = [
    `SPR No: ${spr.sprNo}`,
    '',
    `Date: ${spr.date}`,
    '',
    `Department: ${spr.department}`,
  ];
  const headerInfo2 = [
    `Ref No: ${spr.refNo}`,
    '',
    `Fiscal Year: ${spr.fiscalYear}`,
    '',
    `Prepared By: ${spr.preparedBy} (${spr.preparedByUserId})`,
  ];
  const headerInfo3 = [
    `Procurement Type: ${spr.procurementType}`,
    '',
    `Subject: ${spr.subject}`,
    '',
    `Status: ${spr.status.toUpperCase()}`,
  ];

  const tableHeaders = [
    'SL (ক্র/নং)',
    'Code (কোড নং)',
    'Material Description (মালামালের বিনির্দেশ)',
    'Unit (একক)',
    ...fiscalYears.map((fy) => `Usage ${fy}`),
    'Store Stock (সম্ভারের মজুদ)',
    'Pipeline Qty (পাইপ লাইন)',
    'Required Qty (বর্তমান প্রয়োজন)',
    'Unit Price (টাকা)',
    'Total (টাকা)',
    'EDA (আনুমানিক সময়)',
    'Previous Purchase Ref (বিগত ক্রয়াদেশ নং/তাং/মূল্য)',
    'Remarks (মন্তব্য)'
  ];

  const dataRows = spr.items.map((item, idx) => [
    idx + 1,
    item.code || '',
    item.description || '',
    item.unit || '',
    ...fiscalYears.map((fy) => item.usageByYear?.[fy] ?? item[fy] ?? item[`usage_${fy.replace('-', '_')}`] ?? item[`usage${fy.replace('-', '_')}`] ?? '-'),
    item.storeStock || 'Nil',
    item.pipelineQty || '-',
    item.requiredQty,
    item.unitPrice,
    item.total,
    item.eda || '',
    item.previousPurchase || '',
    item.remarks || '',
  ]);

  const grandTotalRow = [
    '',
    '',
    'GRAND TOTAL (with vat & tax)',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    spr.grandTotal,
    '',
    '',
    ''
  ];

  const inWordsRow = [
    'In Words:',
    spr.inWords || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ];

  const worksheetData = [
    titleRow,
    subTitleRow,
    emptyRow,
    headerInfo1,
    headerInfo2,
    headerInfo3,
    emptyRow,
    tableHeaders,
    ...dataRows,
    grandTotalRow,
    inWordsRow,
    emptyRow,
    ['Signatures:'],
    ['Prepared By: ' + spr.preparedBy, 'Head of Dept', 'Store Keeper / Officer', 'Head of MPIC', 'Head of Commercial', 'Head of Accounts', 'Managing Director']
  ];

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths for clean readability in Excel
  ws['!cols'] = [
    { wch: 6 },  // SL
    { wch: 14 }, // Code
    { wch: 45 }, // Description
    { wch: 8 },  // Unit
    { wch: 7 },  // 20-21
    { wch: 7 },  // 21-22
    { wch: 7 },  // 22-23
    { wch: 7 },  // 23-24
    { wch: 12 }, // Store Stock
    { wch: 12 }, // Pipeline
    { wch: 14 }, // Required
    { wch: 14 }, // Unit Price
    { wch: 16 }, // Total
    { wch: 12 }, // EDA
    { wch: 30 }, // Previous Purchase
    { wch: 15 }, // Remarks
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SPR_Document');

  // Generate file name
  const safeSprNo = spr.sprNo.replace(/[/\\?%*:|"<>]/g, '-');
  XLSX.writeFile(wb, `${safeSprNo}_TSP_SPR.xlsx`);
}

export function exportAllSprsToExcel(sprList: SprRecord[]) {
  const headers = [
    'SL',
    'SPR No',
    'Ref No',
    'Date',
    'Fiscal Year',
    'Department',
    'Prepared By',
    'User ID',
    'Items Count',
    'Grand Total (BDT)',
    'Status'
  ];

  const rows = sprList.map((s, idx) => [
    idx + 1,
    s.sprNo,
    s.refNo,
    s.date,
    s.fiscalYear,
    s.department,
    s.preparedBy,
    s.preparedByUserId,
    s.items.length,
    s.grandTotal,
    s.status
  ]);

  const ws = XLSX.utils.aoa_to_sheet([['TSP COMPLEX LTD. - All SPR Records Summary'], [], headers, ...rows]);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 25 },
    { wch: 12 },
    { wch: 14 },
    { wch: 22 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SPR_Summary');
  XLSX.writeFile(wb, `TSP_All_SPRs_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}

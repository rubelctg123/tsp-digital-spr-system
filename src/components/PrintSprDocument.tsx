import React, { useMemo, useState } from 'react';
import { SprRecord } from '../types';
import { TspLogo } from './TspLogo';
import { formatCurrencyBDT } from '../utils/numberToWords';
import { Printer, Download, ArrowLeft, Loader2 } from 'lucide-react';
import { getDynamicFiscalYears } from '../utils/fiscalYear';
import { downloadSprPdf, printSprDocument, formatDateDDMMYYYY } from '../utils/pdfExporter';

interface PrintSprDocumentProps {
  spr: SprRecord;
  onBack?: () => void;
  isStandalone?: boolean;
}

export const PrintSprDocument: React.FC<PrintSprDocumentProps> = ({ spr, onBack }) => {
  const fiscalYears = useMemo(() => getDynamicFiscalYears(), []);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const formattedDate = formatDateDDMMYYYY(spr.date);

  const handlePrint = () => {
    printSprDocument(spr);
  };

  const handleSaveAsPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await downloadSprPdf(spr);
    } catch (err) {
      console.error('Error saving PDF:', err);
      alert('Failed to generate PDF. Please use the Print button to print or save as PDF via your browser.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center pb-12 px-2 sm:px-4">
      {/* Top Action Bar (hidden when printing) */}
      <div className="w-full max-w-[1540px] mb-4 flex flex-wrap items-center justify-between gap-3 px-1 no-print">
        {onBack && (
          <button
            id="spr-back-btn"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Records
          </button>
        )}
        
        <div className="flex items-center gap-3 ml-auto">
          <button
            id="spr-save-pdf-btn"
            onClick={handleSaveAsPdf}
            disabled={isGeneratingPdf}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Save as PDF
              </>
            )}
          </button>
          <button
            id="spr-print-action-btn"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            Print
          </button>
        </div>
      </div>

      {/* The Authentic Document Layout matching Word document on Legal / A4 Paper */}
      <div
        id="spr-print-container"
        className="w-full max-w-[1540px] bg-white p-5 sm:p-7 md:p-8 border border-slate-300 rounded-lg shadow-md text-slate-900 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none"
        style={{ fontFamily: "'Noto Serif Bengali', 'Times New Roman', Times, serif" }}
      >
        {/* Document Top Header */}
        <div className="grid grid-cols-12 items-start border-b-2 border-slate-800 pb-2.5 mb-2.5">
          {/* Left Reference */}
          <div className="col-span-3 text-xs sm:text-sm leading-relaxed">
            <p className="font-bold text-slate-900">
              সূত্র নং- {spr.refNo || 'টিএসপি/এমপিআইসি (পিএণ্ড) / ------------'}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              SPR No: <span className="font-bold text-slate-950 font-mono text-sm">{spr.sprNo}</span>
            </p>
            <p className="text-xs text-slate-600">
              User ID: <span className="font-mono font-semibold text-slate-800">{spr.preparedByUserId || 'USER-001'}</span>
            </p>
          </div>

          {/* Center Title & BCIC Logo */}
          <div className="col-span-6 flex flex-col items-center text-center">
            <TspLogo size={56} className="mb-1" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-slate-950 leading-tight">
              টিএসপি কমপ্লেক্স লিঃ
            </h1>
            <h2 className="text-sm sm:text-base font-bold tracking-wider text-slate-900">
              TSP COMPLEX LTD.
            </h2>
            <p className="text-xs font-semibold text-slate-700 tracking-wide">
              A COMPANY OF BCIC
            </p>
            <p className="text-xs text-slate-600">
              পতেঙ্গা, চট্টগ্রাম-৪২০৪
            </p>
            <div className="my-1.5 inline-block">
              <span className="text-sm sm:text-base font-bold text-slate-950 px-4 pb-1 border-b-2 border-slate-900 inline-block leading-relaxed">
                মালামাল ক্রয়ের অধিযাচন পত্র (এসপিআর)
              </span>
            </div>
          </div>

          {/* Right Reference Box */}
          <div className="col-span-3 text-right text-xs sm:text-sm leading-relaxed">
            <div className="inline-block text-left text-xs sm:text-[13px] space-y-1">
              <p>
                <span className="font-bold text-slate-900">ক্রয়ের ধরন :</span> {spr.procurementType || 'স্থানীয়'}
              </p>
              <p>
                <span className="font-bold text-slate-900">বৎসর :</span> {spr.fiscalYear || '২০২৪-২০২৫ খ্রি.'}
              </p>
              <p>
                <span className="font-bold text-slate-900">প্রসঙ্গ :</span> {spr.subject || 'বৈদ্যুতিক মালামাল ক্রয়'}
              </p>
              <p>
                <span className="font-bold text-slate-900">তারিখ :</span> {formattedDate}
              </p>
            </div>
          </div>
        </div>

        {/* Main 13-Column SPR Table with Guaranteed Column Proportions */}
        <div className="overflow-x-auto my-2">
          <table className="spr-table w-full border-collapse border border-slate-900 text-xs sm:text-[12.5px]">
            <colgroup>
              <col style={{ width: '3%' }} />
              <col style={{ width: '7.5%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '3.5%' }} />
              {fiscalYears.map((_, i) => (
                <col key={i} style={{ width: `${10.5 / fiscalYears.length}%` }} />
              ))}
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '5.5%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '7.5%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '12.5%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-100 text-slate-950 font-bold text-center">
                <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 align-middle">ক্র/ নং</th>
                <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 align-middle">কোড নং</th>
                <th rowSpan={2} className="border border-slate-900 py-1.5 px-2 text-left align-middle">মালামালের বিনির্দেশ</th>
                <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 align-middle">একক</th>
                <th colSpan={fiscalYears.length} className="border border-slate-900 py-1 px-1 text-center align-middle">
                  বাৎসরিক ব্যবহার <br />
                  <span className="text-[10px] font-normal">(অন্তত গত ৩ বৎসর)</span>
                </th>
                <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 align-middle">সম্ভারের মজুদ</th>
                <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 leading-tight align-middle">পাইপ লাইন +<br />ক্রয়াদেশ ভুক্ত</th>
                <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 leading-tight align-middle">বর্তমান<br />প্রয়োজন</th>
                <th colSpan={2} className="border border-slate-900 py-1 px-1 text-center align-middle">আনুমানিক মূল্য (টাকা)</th>
                <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 leading-tight align-middle">মালামাল গ্রহণের<br />আনুমানিক সময়<br />(ইডিএ)</th>
                <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 leading-tight align-middle">বিগত ক্রয়াদেশ নং,<br />তাং ও মূল্য (টাকা)</th>
                <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 leading-tight align-middle">মন্তব্য<br />(যদি থাকে)</th>
              </tr>
              <tr className="bg-slate-100 text-slate-950 font-bold text-center">
                {fiscalYears.map((fy) => (
                  <th key={fy} className="border border-slate-900 font-semibold text-[11px] py-1 px-0.5 align-middle">
                    {fy}
                  </th>
                ))}
                <th className="border border-slate-900 font-semibold text-[11px] py-1 px-1 align-middle">একক মূল্য (টাকা)</th>
                <th className="border border-slate-900 font-semibold text-[11px] py-1 px-1 align-middle">মোট মূল্য (টাকা)</th>
              </tr>
              {/* Reference Bengali Column Numbering (Middle and Center aligned) */}
              <tr className="text-[11px] text-slate-800 bg-slate-200/90 font-mono text-center font-bold h-6">
                <th className="border border-slate-900 py-1 text-center align-middle">১</th>
                <th className="border border-slate-900 py-1 text-center align-middle">২</th>
                <th className="border border-slate-900 py-1 text-center align-middle">৩</th>
                <th className="border border-slate-900 py-1 text-center align-middle">৪</th>
                <th colSpan={fiscalYears.length} className="border border-slate-900 py-1 text-center align-middle">৫</th>
                <th className="border border-slate-900 py-1 text-center align-middle">৬</th>
                <th className="border border-slate-900 py-1 text-center align-middle">৭</th>
                <th className="border border-slate-900 py-1 text-center align-middle">৮</th>
                <th className="border border-slate-900 py-1 text-center align-middle">৯</th>
                <th className="border border-slate-900 py-1 text-center align-middle">১০</th>
                <th className="border border-slate-900 py-1 text-center align-middle">১১</th>
                <th className="border border-slate-900 py-1 text-center align-middle">১২</th>
                <th className="border border-slate-900 py-1 text-center align-middle">১৩</th>
              </tr>
            </thead>
            <tbody>
              {spr.items.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50/70">
                  <td className="border border-slate-900 text-center font-bold text-xs sm:text-[12.5px] py-1.5 px-1 align-middle">{item.sl || idx + 1}</td>
                  <td className="border border-slate-900 text-center font-mono font-bold text-xs sm:text-[12.5px] py-1.5 px-1 text-slate-950 align-middle">{item.code || '-'}</td>
                  <td className="border border-slate-900 text-left py-1.5 px-2.5 align-middle">
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-950 font-normal text-xs sm:text-[12.5px]">
                      {item.description}
                    </div>
                  </td>
                  <td className="border border-slate-900 text-center text-xs sm:text-[12.5px] py-1.5 px-1 align-middle">{item.unit || 'No'}</td>
                  {fiscalYears.map((fy) => (
                    <td key={fy} className="border border-slate-900 text-center text-xs sm:text-[12px] font-mono py-1.5 px-0.5 align-middle">
                      {item.usageByYear?.[fy] ?? item[fy] ?? item[`usage_${fy.replace('-', '_')}`] ?? item[`usage${fy.replace('-', '_')}`] ?? '-'}
                    </td>
                  ))}
                  <td className="border border-slate-900 text-center text-xs sm:text-[12px] py-1.5 px-1 align-middle">{item.storeStock || 'Nil'}</td>
                  <td className="border border-slate-900 text-center text-xs sm:text-[12px] py-1.5 px-1 align-middle">{item.pipelineQty || '-'}</td>
                  <td className="border border-slate-900 text-center font-bold text-xs sm:text-[12.5px] py-1.5 px-1 text-slate-950 align-middle">{item.requiredQty}</td>
                  <td className="border border-slate-900 text-right font-mono text-xs sm:text-[12.5px] py-1.5 px-2 align-middle">{formatCurrencyBDT(item.unitPrice)}/-</td>
                  <td className="border border-slate-900 text-right font-mono font-bold text-xs sm:text-[12.5px] py-1.5 px-2 text-slate-950 align-middle">{formatCurrencyBDT(item.total)}/-</td>
                  <td className="border border-slate-900 text-center text-[11px] sm:text-xs py-1.5 px-1 align-middle">{item.eda || ''}</td>
                  <td className="border border-slate-900 text-left text-[11px] sm:text-xs leading-normal px-2 py-1.5 font-mono whitespace-pre-wrap align-middle">
                    {item.previousPurchase || '-'}
                  </td>
                  <td className="border border-slate-900 text-center text-[11px] sm:text-xs py-1.5 px-1 align-middle">{item.remarks || ''}</td>
                </tr>
              ))}

              {/* Total Row: Right Aligned and Middle Aligned */}
              <tr className="font-bold bg-slate-50 h-8">
                <td colSpan={10} className="border border-slate-900 text-right pr-4 align-middle uppercase text-xs sm:text-sm py-1.5 text-slate-900 tracking-wide">
                  TOTAL = (WITH VAT &amp; TAX)
                </td>
                <td colSpan={3} className="border border-slate-900 text-right pr-4 align-middle font-mono text-sm sm:text-base text-slate-950 py-1.5">
                  ৳ {formatCurrencyBDT(spr.grandTotal)}/-
                </td>
              </tr>

              {/* In Words Row */}
              <tr>
                <td colSpan={13} className="border border-slate-900 py-2.5 px-4 text-xs sm:text-sm bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                    <span className="font-bold text-slate-950 whitespace-nowrap">In words :</span>
                    <span className="italic font-medium text-slate-900">{spr.inWords || 'Zero Taka only.'}</span>
                  </div>
                  {spr.inWordsBn && (
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 mt-0.5 text-slate-800">
                      <span className="font-bold text-slate-950 whitespace-nowrap">কথায় :</span>
                      <span>{spr.inWordsBn}</span>
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 7-Box Official Signature Section matching authentic BCIC standard */}
        <div className="spr-signature-section mt-3.5 pt-2.5 border-t-2 border-slate-800">
          <div className="grid grid-cols-7 border-2 border-slate-900 text-center text-xs font-semibold text-slate-950 divide-x-2 divide-slate-900">
            {/* Box 1: Prepared By */}
            <div className="flex flex-col justify-between h-28 p-1.5 pb-1">
              <span className="text-[11px] leading-tight font-bold">প্রস্তুতকারীর সহি</span>
              <div className="text-[10px] text-slate-800 font-normal leading-tight mt-auto pb-0.5">
                <p className="font-bold text-slate-950">{spr.preparedBy || 'Md. Jalel Ahmed'} ({spr.preparedByUserId || 'USER-001'})</p>
                <p className="text-[9.5px] mt-0.5 text-slate-600">তাং- {formattedDate}</p>
              </div>
            </div>

            {/* Box 2: User Dept Head */}
            <div className="flex flex-col justify-between h-28 p-1.5 pb-1">
              <span className="text-[11px] leading-tight font-bold">ব্যবহারকারী বিভাগীয় প্রধানের সহি</span>
              <div className="text-[10px] text-slate-500 font-normal mt-auto pb-0.5">
                স্বাক্ষর ও সীল
              </div>
            </div>

            {/* Box 3: Store Manager (Subdivided into Store Keeper & Store Officer) */}
            <div className="flex flex-col h-28">
              <div className="border-b-2 border-slate-900 h-7 flex items-center justify-center text-[11px] font-bold text-center">
                ব্যবস্থাপক (ভান্ডার)
              </div>
              <div className="grid grid-cols-2 flex-1 divide-x-2 divide-slate-900 text-[10.5px] h-full">
                <div className="flex flex-col justify-between p-1 pb-1 text-center">
                  <span className="font-semibold text-[10px]">স্টোর কিপার</span>
                  <span className="text-[9.5px] text-slate-500 mt-auto pb-0.5">স্বাক্ষর</span>
                </div>
                <div className="flex flex-col justify-between p-1 pb-1 text-center">
                  <span className="font-semibold text-[10px]">সম্ভার কর্মকর্তা</span>
                  <span className="text-[9.5px] text-slate-500 mt-auto pb-0.5">স্বাক্ষর</span>
                </div>
              </div>
            </div>

            {/* Box 4: MPIC Sub-divisional Head */}
            <div className="flex flex-col justify-between h-28 p-1.5 pb-1">
              <span className="text-[11px] leading-tight font-bold">এমপিআইসি অনুবিভাগীয় প্রধান</span>
              <div className="text-[10px] text-slate-500 font-normal mt-auto pb-0.5">
                স্বাক্ষর ও সীল
              </div>
            </div>

            {/* Box 5: Commercial Dept Head */}
            <div className="flex flex-col justify-between h-28 p-1.5 pb-1">
              <span className="text-[11px] leading-tight font-bold">বাণিজ্যিক বিভাগীয় প্রধান</span>
              <div className="text-[10px] text-slate-500 font-normal mt-auto pb-0.5">
                স্বাক্ষর ও সীল
              </div>
            </div>

            {/* Box 6: Accounts Dept Head */}
            <div className="flex flex-col justify-between h-28 p-1.5 pb-1">
              <span className="text-[11px] leading-tight font-bold">হিসাব বিভাগীয় প্রধান</span>
              <div className="text-[10px] text-slate-500 font-normal mt-auto pb-0.5">
                স্বাক্ষর ও সীল
              </div>
            </div>

            {/* Box 7: Managing Director */}
            <div className="flex flex-col justify-between h-28 p-1.5 pb-1 bg-slate-50/80">
              <span className="text-[11px] leading-tight font-bold text-slate-950">ম্যানেজিং ডিরেক্টর</span>
              <div className="text-[10.5px] text-slate-600 font-semibold mt-auto pb-0.5">
                অনুমোদন
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 font-mono">
          <span>TSP COMPLEX LTD. • SYSTEM GENERATED SPR DOCUMENT</span>
          <span>Printed on: {new Date().toLocaleDateString('en-GB')}</span>
        </div>
      </div>
    </div>
  );
};

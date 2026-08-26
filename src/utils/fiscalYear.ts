/**
 * Dynamic Fiscal Year Utilities for Store Purchase Requisitions (SPR)
 * Rule: For current calendar year Y:
 * 1. (Y-3)-(Y-2)
 * 2. (Y-2)-(Y-1)
 * 3. (Y-1)-Y
 * 
 * Example:
 * 2026 -> ['23-24', '24-25', '25-26']
 * 2027 -> ['24-25', '25-26', '26-27']
 * 2028 -> ['25-26', '26-27', '27-28']
 */

export function getDynamicFiscalYears(baseYear?: number): string[] {
  const currentYear = baseYear || new Date().getFullYear();
  
  const y1Start = (currentYear - 3) % 100;
  const y1End = (currentYear - 2) % 100;
  
  const y2Start = (currentYear - 2) % 100;
  const y2End = (currentYear - 1) % 100;
  
  const y3Start = (currentYear - 1) % 100;
  const y3End = currentYear % 100;

  const pad = (n: number) => String(n).padStart(2, '0');

  return [
    `${pad(y1Start)}-${pad(y1End)}`,
    `${pad(y2Start)}-${pad(y2End)}`,
    `${pad(y3Start)}-${pad(y3End)}`,
  ];
}

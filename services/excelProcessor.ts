import * as XLSX from 'xlsx';
import { CONFIG, ProcessedInvoice } from '../types';

export const processExcelFile = async (file: File): Promise<ProcessedInvoice[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        // 1. Check Sheets
        if (!workbook.SheetNames.includes(CONFIG.MAIN_SHEET)) {
          reject(new Error(`Sheet '${CONFIG.MAIN_SHEET}' not found.`));
          return;
        }

        // 2. Load Reference Data (Vendor Categories)
        const vendorTypeMap = new Map<string, string>();
        if (workbook.SheetNames.includes(CONFIG.REF_SHEET)) {
          const refSheet = workbook.Sheets[CONFIG.REF_SHEET];
          const refData = XLSX.utils.sheet_to_json<any[]>(refSheet, { header: 1 });
          // Format: Vendor_TaxID (0), Vendor_Category (5)
          refData.forEach((row) => {
            if (row[0] && row[5]) {
              vendorTypeMap.set(String(row[0]).trim().toUpperCase(), String(row[5]));
            }
          });
        }

        // 3. Load Country Data
        const countryMap = new Map<string, string>();
        if (workbook.SheetNames.includes(CONFIG.COUNTRY_SHEET)) {
          const countrySheet = workbook.Sheets[CONFIG.COUNTRY_SHEET];
          const countryData = XLSX.utils.sheet_to_json<any[]>(countrySheet, { header: 1 });
          // Format: Vendor_TaxID (0), Country (6)
          countryData.forEach((row) => {
            if (row[0] && row[6]) {
              countryMap.set(String(row[0]).trim().toUpperCase(), String(row[6]));
            }
          });
        }

        // 4. Load Main Sheet
        const mainSheet = workbook.Sheets[CONFIG.MAIN_SHEET];
        const mainData = XLSX.utils.sheet_to_json<any[]>(mainSheet, { header: 1 });

        // Header Detection (Look for "VENDOR" in column A)
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(100, mainData.length); i++) {
            const val = String(mainData[i][0] || '').toUpperCase();
            if (val.includes('VENDOR')) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            reject(new Error("Header 'VENDOR' not found in column A."));
            return;
        }

        // Map Headers for dynamic BS/BA finding
        const headerRow = mainData[headerRowIndex];
        const colMap: Record<string, number> = {};
        headerRow.forEach((cell, idx) => {
            if (typeof cell === 'string') {
                colMap[cell.trim().toUpperCase()] = idx;
            }
        });

        // Heuristic BS/BA Index finding
        let bsIdx = 50; // Default fallback
        let baIdx = 51; // Default fallback
        
        Object.keys(colMap).forEach(key => {
            if (key.includes("BS") && !key.includes("FUNC")) bsIdx = colMap[key];
            if (key.includes("BA")) baIdx = colMap[key];
        });

        // 5. Process Rows
        const processedRows: ProcessedInvoice[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        const badPatterns = /total|saldo|asiento|header|proveedor|unnamed|vendor|facturas|periodo|sum|importe|grand total/i;

        for (let i = headerRowIndex + 1; i < mainData.length; i++) {
            const row = mainData[i];
            if (!row || row.length === 0) continue;

            const vendorName = row[CONFIG.MAIN_COLS_INDICES[0]];
            
            // Skip invalid rows based on vendor name check
            if (!vendorName || badPatterns.test(String(vendorName))) continue;

            // Extract core fields
            const rawDueDate = row[CONFIG.MAIN_COLS_INDICES[2]];
            const openAmount = row[CONFIG.MAIN_COLS_INDICES[3]];
            const vatId = String(row[CONFIG.MAIN_COLS_INDICES[1]] || '');

            // Validation
            if (!rawDueDate || !openAmount) continue;
            const amountNum = typeof openAmount === 'number' ? openAmount : parseFloat(openAmount);
            if (isNaN(amountNum) || amountNum <= 0) continue;

            // Date Parsing
            let dueDate: Date;
            if (rawDueDate instanceof Date) {
                dueDate = rawDueDate;
            } else {
                // Handle potential string dates if cellDates:true failed or mixed types
                dueDate = new Date(rawDueDate);
            }
            if (isNaN(dueDate.getTime())) continue; // Skip invalid dates

            // Normalize Strings
            const vatIdClean = vatId.trim().toUpperCase();
            
            // Normalize BS
            const rawBS = String(row[bsIdx] || '').trim().toUpperCase();
            let bsStatus = "Other Block Status";
            if (["", "OK", "FREE", "0", "FREE FOR PAYMENT", "0.0"].includes(rawBS)) {
                bsStatus = "Free for Payment";
            } else if (rawBS.includes("BLOCK") || ["1", "BFP", "1.0"].includes(rawBS)) {
                bsStatus = "Blocked for Payment";
            }

            // Normalize Yes/No Flags
            const normalizeFlag = (idx: number) => {
                const val = String(row[idx] || '').trim().toLowerCase();
                return ['yes', 'y'].includes(val) ? 'Yes' : 'No';
            };
            
            const colAF = normalizeFlag(CONFIG.MAIN_COLS_INDICES[6]);
            const colAH = normalizeFlag(CONFIG.MAIN_COLS_INDICES[7]);
            const colAJ = normalizeFlag(CONFIG.MAIN_COLS_INDICES[8]);
            const colAN = normalizeFlag(CONFIG.MAIN_COLS_INDICES[9]);

            // Merges
            const vendorType = vendorTypeMap.get(vatIdClean) || "Uncategorized";
            const country = countryMap.get(vatIdClean) || "Unknown";
            
            let countryType: 'Spain' | 'Foreign' | 'Unknown' = "Unknown";
            const countryLower = country.toLowerCase();
            if (countryLower.includes("spain")) countryType = "Spain";
            else if (country !== "" && countryLower !== "unknown") countryType = "Foreign";

            // Overdue Logic
            const isOverdue = dueDate < today;
            const daysOverdue = isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24)) : 0;

            processedRows.push({
                id: `row-${i}`,
                Vendor_Name: String(vendorName),
                VAT_ID: vatId,
                VAT_ID_clean: vatIdClean,
                Due_Date: dueDate,
                Open_Amount: amountNum,
                Vendor_Email: String(row[CONFIG.MAIN_COLS_INDICES[4]] || ''),
                Account_Email: String(row[CONFIG.MAIN_COLS_INDICES[5]] || ''),
                Col_AF: colAF,
                Col_AH: colAH,
                Col_AJ: colAJ,
                Col_AN: colAN,
                Col_BS: bsStatus,
                Business_Area: String(row[baIdx] || ''),
                Vendor_Type: vendorType,
                Country: country,
                Country_Type: countryType,
                Status: isOverdue ? 'Overdue' : 'Not Overdue',
                Days_Overdue: daysOverdue,
            });
        }

        resolve(processedRows);

      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
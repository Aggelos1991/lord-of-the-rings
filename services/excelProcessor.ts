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

        // 2. Load Reference Data (Vendor Types from VR CHECK_Special vendors list)
        // Column A = T.R.N. (key), Column G = TYPE (value)
        const vendorTypeMap = new Map<string, string>();
        if (workbook.SheetNames.includes(CONFIG.REF_SHEET)) {
          const refSheet = workbook.Sheets[CONFIG.REF_SHEET];
          const refData = XLSX.utils.sheet_to_json<any[]>(refSheet, { header: 1 });
          // Format: Vendor_TaxID (col A = 0), Vendor_Category (col G = 6)
          refData.forEach((row) => {
            if (row[0] && row[6]) {
              vendorTypeMap.set(String(row[0]).trim().toUpperCase(), String(row[6]));
            }
          });
        }

        // 3. Load Country Data (from VENDOR LIST sheet)
        // Primary key: Column A (Code), Fallback key: Column D (T.R.N.), Value: Column G (Country)
        const countryMapByCode = new Map<string, string>();  // Col A -> Country
        const countryMapByTRN = new Map<string, string>();   // Col D -> Country
        if (workbook.SheetNames.includes(CONFIG.COUNTRY_SHEET)) {
          const countrySheet = workbook.Sheets[CONFIG.COUNTRY_SHEET];
          const countryData = XLSX.utils.sheet_to_json<any[]>(countrySheet, { header: 1 });
          countryData.forEach((row) => {
            const country = row[6] ? String(row[6]).trim() : '';
            if (!country) return;
            // Column A = Code (primary key)
            if (row[0]) {
              countryMapByCode.set(String(row[0]).trim().toUpperCase(), country);
            }
            // Column D = T.R.N. (fallback key)
            if (row[3]) {
              countryMapByTRN.set(String(row[3]).trim().toUpperCase(), country);
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

        // Column BT = index 71 (Block Status: BFP / Free for Payment)
        const btIdx = 71;

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

            // Normalize BT (Block Status)
            const rawBT = String(row[btIdx] || '').trim();
            let bsStatus: string;
            const rawBTUpper = rawBT.toUpperCase();
            if (rawBTUpper === 'BFP' || rawBTUpper.includes('BLOCK')) {
                bsStatus = "Blocked for Payment";
            } else if (rawBTUpper === '' || rawBTUpper === 'FREE FOR PAYMENT' || rawBTUpper === 'FREE' || rawBTUpper === 'OK') {
                bsStatus = "Free for Payment";
            } else {
                // Show raw value as-is for any other status
                bsStatus = rawBT;
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

            // Hard-filter: only keep rows where AF, AH, AJ, AN are all "Yes"
            if (colAF !== 'Yes' || colAH !== 'Yes' || colAJ !== 'Yes' || colAN !== 'Yes') continue;

            // Hard-filter: only keep rows where AY (col index 50) = 0
            const ayIdx = 50;
            const rawAY = row[ayIdx];
            const ayVal = typeof rawAY === 'number' ? rawAY : parseFloat(String(rawAY || ''));
            if (isNaN(ayVal) || ayVal !== 0) continue;

            // Merges
            const vendorType = vendorTypeMap.get(vatIdClean) || "Uncategorized";
            // Country lookup: try Column A (Code) first, then Column D (T.R.N.)
            const country = countryMapByCode.get(vatIdClean) || countryMapByTRN.get(vatIdClean) || "Unknown";

            let countryType: 'Spain' | 'Foreign' | 'Unknown' = "Unknown";
            const countryLower = country.toLowerCase().trim();
            if (countryLower === "spain" || countryLower === "españa" || countryLower === "es") {
              countryType = "Spain";
            } else if (country !== "" && countryLower !== "unknown") {
              countryType = "Foreign";
            }

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
                Invoice_Number: String(row[10] || ''), // Column K = index 10
                Vendor_Email: String(row[CONFIG.MAIN_COLS_INDICES[4]] || ''),
                Account_Email: String(row[CONFIG.MAIN_COLS_INDICES[5]] || ''),
                Col_AF: colAF,
                Col_AH: colAH,
                Col_AJ: colAJ,
                Col_AN: colAN,
                Col_BS: bsStatus,
                Business_Area: '',
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

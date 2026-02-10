import * as XLSX from 'xlsx';
import { POUserRecord } from '../types';

/**
 * Process PO Users Excel file.
 * - Column Q (index 16) = Document Number (matching key to main ledger Column F)
 * - Column F (index 5) = Created by (PO Owner)
 * - Column L (index 11) = Email
 *
 * Returns a Map keyed by document number for fast lookup.
 */
export const processPOFile = async (file: File): Promise<Map<string, POUserRecord>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error('No sheets found in PO Users file.'));
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        // Find header row — look for a row containing "Created" in column F area
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(20, rows.length); i++) {
          const row = rows[i];
          if (!row) continue;
          // Check if any cell looks like a header
          const rowStr = row.map((c: any) => String(c || '').toLowerCase()).join(' ');
          if (rowStr.includes('created') || rowStr.includes('document') || rowStr.includes('email')) {
            headerRowIndex = i;
            break;
          }
        }

        const poMap = new Map<string, POUserRecord>();

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const docNumber = String(row[16] || '').trim(); // Column Q = index 16
          const createdBy = String(row[5] || '').trim();  // Column F = index 5
          const email = String(row[11] || '').trim();      // Column L = index 11

          if (!docNumber) continue;

          poMap.set(docNumber, {
            documentNumber: docNumber,
            createdBy,
            email,
          });
        }

        resolve(poMap);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

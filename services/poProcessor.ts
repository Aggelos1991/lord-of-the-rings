import * as XLSX from 'xlsx';
import { POUserRecord } from '../types';

/**
 * Process PO Users Excel file.
 * - Column B (index 1) = PO Number
 * - Column D (index 3) = Vendor Name
 * - Column F (index 5) = Created by (PO Owner)
 * - Column L (index 11) = Email
 * - Column Q (index 16) = Document/Invoice Number
 *
 * Returns an array of all PO records.
 */
export const processPOFile = async (file: File): Promise<POUserRecord[]> => {
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

        // Find header row
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(20, rows.length); i++) {
          const row = rows[i];
          if (!row) continue;
          const rowStr = row.map((c: any) => String(c || '').toLowerCase()).join(' ');
          if (rowStr.includes('created') || rowStr.includes('document') || rowStr.includes('vendor') || rowStr.includes('email')) {
            headerRowIndex = i;
            break;
          }
        }

        const records: POUserRecord[] = [];

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const poNumber = String(row[1] || '').trim();       // Column B = index 1
          const vendorName = String(row[3] || '').trim();     // Column D = index 3
          const createdBy = String(row[5] || '').trim();      // Column F = index 5
          const email = String(row[11] || '').trim();          // Column L = index 11
          const documentNumber = String(row[16] || '').trim(); // Column Q = index 16

          // Skip empty rows — at minimum need a vendor or PO number
          if (!vendorName && !poNumber) continue;

          records.push({
            poNumber,
            vendorName,
            createdBy,
            email,
            documentNumber,
          });
        }

        resolve(records);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

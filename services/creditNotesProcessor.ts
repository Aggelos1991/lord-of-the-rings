import * as XLSX from 'xlsx';

export interface CNRecord {
  VAT_ID_clean: string;
  CN_Number: string;
  CN_Amount: number;
}

export interface AggregatedCN {
  CN_Numbers: string[];      // All CN numbers for this vendor
  CN_Total: number;          // Sum of all CN amounts
  CN_Count: number;          // How many CNs
}

export const processCreditNotesFile = async (file: File): Promise<Map<string, AggregatedCN>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        // Use a Map to aggregate by VAT_ID
        const cnMap = new Map<string, AggregatedCN>();
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          
          const vat = String(row[3] || "").trim().toUpperCase(); // Column D
          const cnNumber = String(row[2] || "").trim();          // Column C
          const cnAmount = Number(row[10] || 0);                 // Column K
          
          if (!vat || !cnNumber) continue;
          
          const existing = cnMap.get(vat);
          if (existing) {
            existing.CN_Numbers.push(cnNumber);
            existing.CN_Total += cnAmount;
            existing.CN_Count += 1;
          } else {
            cnMap.set(vat, {
              CN_Numbers: [cnNumber],
              CN_Total: cnAmount,
              CN_Count: 1,
            });
          }
        }
        
        resolve(cnMap);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

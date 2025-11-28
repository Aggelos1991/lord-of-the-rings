import * as XLSX from 'xlsx';

export interface CNRecord {
    VAT_ID_clean: string;
    CN_Number: string;
    CN_Amount: number;
}

export const processCreditNotesFile = async (file: File): Promise<CNRecord[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: "array" });

                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

                const results: CNRecord[] = [];

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row) continue;

                    const vat = String(row[3] || "").trim().toUpperCase(); // Column D
                    const cnNumber = String(row[2] || "").trim(); // Column C
                    const cnAmount = Number(row[10] || 0); // Column K

                    if (!vat || !cnNumber || !cnAmount) continue;

                    results.push({
                        VAT_ID_clean: vat,
                        CN_Number: cnNumber,
                        CN_Amount: cnAmount
                    });
                }

                resolve(results);

            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = err => reject(err);
        reader.readAsArrayBuffer(file);
    });
};

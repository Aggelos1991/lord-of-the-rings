import React, { useState, useMemo, useEffect } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { ProcessedInvoice, FilterState } from './types';
import { processExcelFile } from './services/excelProcessor';
import KPIGrid from './components/KPIGrid';
import Filters from './components/Filters';
import InvoiceChart from './components/InvoiceChart';
import DataTable from './components/DataTable';

function App() {
  const [rawFiles, setRawFiles] = useState<File | null>(null);
  const [data, setData] = useState<ProcessedInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial Filter State
  const [filterState, setFilterState] = useState<FilterState>({
    country: 'All',
    dateRange: [null, null],
    applyYesFilter: true,
    ajYesOnly: false,
    selectedVendorTypes: [],
    selectedBFPStatus: [],
    chartStatus: 'All Open',
    vendorGroup: 'Top 20',
    selectedVendor: null,
  });

  // Derived constants for filter lists
  const availableVendorTypes = useMemo(() => 
    Array.from(new Set(data.map(d => d.Vendor_Type))).sort(), 
  [data]);

  const availableBFPStatus = useMemo(() => 
    Array.from(new Set(data.map(d => d.Col_BS))).sort(), 
  [data]);

  const dateBounds = useMemo(() => {
    if (data.length === 0) return { min: new Date(), max: new Date() };
    const dates = data.map(d => d.Due_Date?.getTime() || 0).filter(t => t > 0);
    return {
        min: new Date(Math.min(...dates)),
        max: new Date(Math.max(...dates))
    };
  }, [data]);

  // Set initial filters when data loads
  useEffect(() => {
    if (data.length > 0) {
        setFilterState(prev => ({
            ...prev,
            dateRange: [dateBounds.min, dateBounds.max],
            selectedVendorTypes: availableVendorTypes,
            selectedBFPStatus: availableBFPStatus
        }));
    }
  }, [data, availableVendorTypes, availableBFPStatus, dateBounds]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRawFiles(file);
    setLoading(true);
    setError(null);
    try {
      const processed = await processExcelFile(file);
      setData(processed);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process file. Ensure correct format.");
    } finally {
      setLoading(false);
    }
  };

  // FILTER LOGIC
  const filteredData = useMemo(() => {
    if (data.length === 0) return [];

    return data.filter(item => {
        // Country
        if (filterState.country !== 'All' && item.Country_Type !== filterState.country) return false;
        
        // Date
        if (filterState.dateRange[0] && item.Due_Date && item.Due_Date < filterState.dateRange[0]) return false;
        if (filterState.dateRange[1] && item.Due_Date && item.Due_Date > filterState.dateRange[1]) return false;

        // Yes Flags
        if (filterState.applyYesFilter) {
            if (item.Col_AF !== 'Yes' || item.Col_AH !== 'Yes' || item.Col_AN !== 'Yes') return false;
        }
        if (filterState.ajYesOnly && item.Col_AJ !== 'Yes') return false;

        // Multi-selects
        if (!filterState.selectedVendorTypes.includes(item.Vendor_Type)) return false;
        if (!filterState.selectedBFPStatus.includes(item.Col_BS)) return false;

        return true;
    });
  }, [data, filterState]);

  // Raw Table Logic (Apply Chart Filters)
  const tableData = useMemo(() => {
    let res = filteredData;
    
    // Status View Filter
    if (filterState.chartStatus === 'Overdue Only') {
        res = res.filter(d => d.Status === 'Overdue');
    } else if (filterState.chartStatus === 'Not Overdue Only') {
        res = res.filter(d => d.Status === 'Not Overdue');
    }

    // Chart Click Selection
    if (filterState.selectedVendor) {
        res = res.filter(d => d.Vendor_Name === filterState.selectedVendor);
    } 
    // If Top N is selected and NO specific vendor clicked, we generally show all matching, 
    // or we could filter to just the top N. The prompt logic implies showing selected vendor if clicked, 
    // otherwise showing based on list. Let's stick to showing all matching filter unless clicked.
    
    return res;
  }, [filteredData, filterState.chartStatus, filterState.selectedVendor]);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-gold-500 selection:text-black">
      
      {/* HEADER */}
      <header className="bg-slate-900 border-b border-gold-600/30 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-cinzel text-gold-500 tracking-wider flex items-center gap-3">
               <span className="text-4xl">💍</span> Ledger of the Rings
            </h1>
            <p className="text-xs text-slate-400 font-cinzel mt-1 ml-12">One Invoice to Rule Them All</p>
          </div>
          
          <div className="flex items-center gap-4">
             {/* File Input */}
            <div className="relative group">
                <input 
                    type="file" 
                    onChange={handleFileUpload} 
                    accept=".xlsx, .xls" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={loading}
                />
                <button className={`flex items-center gap-2 px-6 py-2 rounded-full border transition-all duration-300 ${
                    rawFiles 
                    ? 'bg-slate-800 border-gold-500 text-gold-500' 
                    : 'bg-gold-600 border-gold-600 text-black hover:bg-gold-500'
                }`}>
                    {loading ? (
                        <span className="animate-spin">⚔️</span>
                    ) : (
                        <UploadCloud size={18} />
                    )}
                    <span className="font-bold">{rawFiles ? "Change File" : "Upload Ledger"}</span>
                </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto">
        
        {/* SIDEBAR FILTERS (Only visible if data loaded) */}
        {data.length > 0 && (
            <Filters 
                filterState={filterState} 
                setFilterState={setFilterState}
                availableVendorTypes={availableVendorTypes}
                availableBFPStatus={availableBFPStatus}
                minDate={dateBounds.min}
                maxDate={dateBounds.max}
            />
        )}

        {/* CONTENT AREA */}
        <main className="flex-1 p-6 lg:p-10">
            
            {error && (
                <div className="bg-red-900/20 border border-red-500 text-red-200 p-4 rounded-xl mb-6 flex items-center gap-3">
                    <span className="text-2xl">⚠️</span> {error}
                </div>
            )}

            {!data.length && !loading && !error && (
                <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 gap-4 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/50">
                    <FileSpreadsheet size={64} className="opacity-20" />
                    <p className="text-lg">Upload the Master Ledger (.xlsx) to begin your quest.</p>
                    <p className="text-sm opacity-50 max-w-md text-center">Required Sheets: 'Outstanding Invoices IB', 'Vendors', 'VR CHECK_Special vendors list'</p>
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
                    <div className="w-16 h-16 border-4 border-gold-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-cinzel text-xl text-gold-500 animate-pulse">Forging the data...</p>
                </div>
            )}

            {data.length > 0 && (
                <div className="space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-4">
                    
                    {/* KPIS */}
                    <KPIGrid 
                        data={filteredData} 
                        fullDataCount={data.length}
                        fullDataAmount={data.reduce((a, b) => a + b.Open_Amount, 0)}
                    />

                    {/* CHART SECTION */}
                    <div className="grid grid-cols-1 gap-6">
                        <div className="flex flex-wrap gap-4 items-center justify-between mb-2">
                            <h2 className="text-xl font-cinzel font-bold text-white">The Balance Scroll</h2>
                            <div className="flex gap-4">
                                <select 
                                    className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-3 py-1.5 focus:border-gold-500 outline-none"
                                    value={filterState.chartStatus}
                                    onChange={(e) => setFilterState(prev => ({...prev, chartStatus: e.target.value as any}))}
                                >
                                    <option>All Open</option>
                                    <option>Overdue Only</option>
                                    <option>Not Overdue Only</option>
                                </select>
                                <select 
                                    className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-3 py-1.5 focus:border-gold-500 outline-none max-w-[200px]"
                                    value={filterState.vendorGroup}
                                    onChange={(e) => {
                                        setFilterState(prev => ({...prev, vendorGroup: e.target.value, selectedVendor: null}));
                                    }}
                                >
                                    <option>Top 200</option>
                                    <option>Top 100</option>
                                    <option>Top 30</option>
                                    <option>Top 20</option>
                                    <optgroup label="Specific Vendors">
                                        {Array.from(new Set(filteredData.map(d => d.Vendor_Name))).sort().map(v => (
                                            <option key={v} value={v}>{v}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>
                        </div>

                        <InvoiceChart 
                            data={filteredData} 
                            statusFilter={filterState.chartStatus}
                            vendorGroup={filterState.vendorGroup}
                            selectedVendor={filterState.selectedVendor}
                            onVendorClick={(v) => setFilterState(prev => ({...prev, selectedVendor: v}))}
                        />
                    </div>

                    {/* TABLE & EMAIL */}
                    <DataTable 
                        data={tableData} 
                        title={filterState.selectedVendor ? `Invoices for ${filterState.selectedVendor}` : "Raw Invoice Ledger"}
                    />

                </div>
            )}
        </main>
      </div>
    </div>
  );
}

export default App;
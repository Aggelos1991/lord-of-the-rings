import React from 'react';
import { FilterState } from '../types';
import { Filter, Calendar, Globe, AlertCircle, FileText, Search } from 'lucide-react';

interface FiltersProps {
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
  availableVendorTypes: string[];
  availableBFPStatus: string[];
  minDate: Date;
  maxDate: Date;
}

const Filters: React.FC<FiltersProps> = ({ 
  filterState, 
  setFilterState, 
  availableVendorTypes,
  availableBFPStatus,
  minDate,
  maxDate
}) => {
  
  const formatDate = (d: Date | null) => d ? d.toISOString().split('T')[0] : '';

  return (
    <div className="bg-slate-800 border-r border-slate-700 w-full lg:w-80 flex-shrink-0 p-6 flex flex-col gap-6 overflow-y-auto lg:h-[calc(100vh-80px)] lg:sticky lg:top-[80px]">
      
      <div className="flex items-center gap-2 text-gold-500 mb-2">
        <Filter size={20} />
        <h2 className="text-xl font-cinzel font-bold">Filters</h2>
      </div>

      {/* Vendor Search */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Search size={16} /> Vendor Search
        </label>
        <input
          type="text"
          placeholder="e.g. Telef* or *RENTING*"
          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded p-2 focus:border-gold-500 outline-none placeholder:text-slate-600"
          value={filterState.vendorSearch}
          onChange={(e) => setFilterState(prev => ({ ...prev, vendorSearch: e.target.value }))}
        />
        {filterState.vendorSearch && (
          <button
            onClick={() => setFilterState(prev => ({ ...prev, vendorSearch: '' }))}
            className="text-xs text-slate-500 hover:text-gold-500 transition-colors"
          >
            Clear search
          </button>
        )}
      </div>

      {/* Country Selection */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Globe size={16} /> Country Group
        </label>
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
          {['All', 'Spain', 'Foreign'].map((opt) => (
            <button
              key={opt}
              onClick={() => setFilterState(prev => ({ ...prev, country: opt as any }))}
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
                filterState.country === opt 
                  ? 'bg-gold-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Calendar size={16} /> Due Date Range
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input 
            type="date" 
            className="bg-slate-900 border border-slate-700 text-white text-xs rounded p-2 focus:border-gold-500 outline-none"
            value={formatDate(filterState.dateRange[0])}
            min={formatDate(minDate)}
            max={formatDate(maxDate)}
            onChange={(e) => {
              const d = e.target.value ? new Date(e.target.value) : null;
              setFilterState(prev => ({ ...prev, dateRange: [d, prev.dateRange[1]] }));
            }}
          />
          <input 
            type="date" 
            className="bg-slate-900 border border-slate-700 text-white text-xs rounded p-2 focus:border-gold-500 outline-none"
            value={formatDate(filterState.dateRange[1])}
            min={formatDate(minDate)}
            max={formatDate(maxDate)}
            onChange={(e) => {
              const d = e.target.value ? new Date(e.target.value) : null;
              setFilterState(prev => ({ ...prev, dateRange: [prev.dateRange[0], d] }));
            }}
          />
        </div>
      </div>

      <hr className="border-slate-700" />

      {/* Vendor Type Multi-Select */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <AlertCircle size={16} /> Vendor Types
        </label>
        <div className="h-32 overflow-y-auto bg-slate-900 border border-slate-700 rounded p-2 space-y-1 custom-scrollbar">
            {availableVendorTypes.map(vt => (
                <label key={vt} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white cursor-pointer">
                    <input 
                        type="checkbox"
                        checked={filterState.selectedVendorTypes.includes(vt)}
                        onChange={(e) => {
                            if (e.target.checked) {
                                setFilterState(prev => ({...prev, selectedVendorTypes: [...prev.selectedVendorTypes, vt]}));
                            } else {
                                setFilterState(prev => ({...prev, selectedVendorTypes: prev.selectedVendorTypes.filter(x => x !== vt)}));
                            }
                        }}
                        className="rounded border-slate-600 text-gold-600 bg-slate-900"
                    />
                    {vt}
                </label>
            ))}
        </div>
      </div>

       {/* BFP Status Multi-Select */}
       <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <FileText size={16} /> Block Status (BS)
        </label>
        <div className="h-24 overflow-y-auto bg-slate-900 border border-slate-700 rounded p-2 space-y-1 custom-scrollbar">
            {availableBFPStatus.map(bs => (
                <label key={bs} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white cursor-pointer">
                    <input 
                        type="checkbox"
                        checked={filterState.selectedBFPStatus.includes(bs)}
                        onChange={(e) => {
                            if (e.target.checked) {
                                setFilterState(prev => ({...prev, selectedBFPStatus: [...prev.selectedBFPStatus, bs]}));
                            } else {
                                setFilterState(prev => ({...prev, selectedBFPStatus: prev.selectedBFPStatus.filter(x => x !== bs)}));
                            }
                        }}
                        className="rounded border-slate-600 text-gold-600 bg-slate-900"
                    />
                    {bs}
                </label>
            ))}
        </div>
      </div>

    </div>
  );
};

export default Filters;
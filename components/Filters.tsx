import React from 'react';
import { FilterState } from '../types';
import { Filter, Globe, AlertCircle, FileText, Search, DollarSign, Archive, TrendingDown, RotateCcw } from 'lucide-react';

interface FiltersProps {
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
  availableVendorTypes: string[];
  availableBFPStatus: string[];
}

const Filters: React.FC<FiltersProps> = ({
  filterState,
  setFilterState,
  availableVendorTypes,
  availableBFPStatus,
}) => {

  return (
    <div className="bg-slate-800 border-r border-slate-700 w-full lg:w-80 flex-shrink-0 p-6 flex flex-col gap-6 overflow-y-auto lg:h-[calc(100vh-80px)] lg:sticky lg:top-[80px]">
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-gold-500">
          <Filter size={20} />
          <h2 className="text-xl font-cinzel font-bold">Filters</h2>
        </div>
        <button
          onClick={() => setFilterState(prev => ({
            ...prev,
            country: 'All',
            vendorSearch: '',
            invoiceSearch: '',
            amountOperator: 'all',
            amountValue: '',
            amountValueMin: '',
            amountValueMax: '',
            altDocDateYear: 'All',
            debitBalanceOnly: false,
            chartStatus: 'All Open',
            vendorGroup: 'Top 20',
            selectedVendor: null,
            selectedVendorTypes: availableVendorTypes,
            selectedBFPStatus: availableBFPStatus,
          }))}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-gold-500 transition-colors bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 hover:border-gold-600"
        >
          <RotateCcw size={12} /> Reset All
        </button>
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

      {/* Document Year Filter (Alternative Document Date - Col Y) */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Archive size={16} /> Document Year (Col Y)
        </label>
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
          {(['All', '2026', '2025', 'Old'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setFilterState(prev => ({ ...prev, altDocDateYear: opt }))}
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
                filterState.altDocDateYear === opt
                  ? 'bg-gold-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {opt === 'Old' ? '≤2024' : opt}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Based on Alternative Document Date (Col Y)</p>
      </div>

      {/* Debit Balance Vendors */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <TrendingDown size={16} /> Debit Balance
        </label>
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
          {['All', 'Debit Only'].map((opt) => (
            <button
              key={opt}
              onClick={() => setFilterState(prev => ({ ...prev, debitBalanceOnly: opt === 'Debit Only' }))}
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
                (opt === 'Debit Only' ? filterState.debitBalanceOnly : !filterState.debitBalanceOnly)
                  ? 'bg-gold-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Vendors with negative amounts (Col G)</p>
      </div>

      {/* Amount Filter */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <DollarSign size={16} /> Vendor Amount
        </label>
        <select
          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded p-2 focus:border-gold-500 outline-none"
          value={filterState.amountOperator}
          onChange={(e) => setFilterState(prev => ({
            ...prev,
            amountOperator: e.target.value as any,
            amountValue: '',
            amountValueMin: '',
            amountValueMax: '',
          }))}
        >
          <option value="all">All Amounts</option>
          <option value=">=">≥ Greater or Equal</option>
          <option value="<=">≤ Less or Equal</option>
          <option value="=">= Exactly</option>
          <option value="between">Between (range)</option>
        </select>

        {filterState.amountOperator !== 'all' && filterState.amountOperator !== 'between' && (
          <input
            type="number"
            placeholder="Enter amount (e.g. 10000)"
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded p-2 focus:border-gold-500 outline-none placeholder:text-slate-600"
            value={filterState.amountValue}
            onChange={(e) => setFilterState(prev => ({ ...prev, amountValue: e.target.value }))}
          />
        )}

        {filterState.amountOperator === 'between' && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min"
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded p-2 focus:border-gold-500 outline-none placeholder:text-slate-600"
              value={filterState.amountValueMin}
              onChange={(e) => setFilterState(prev => ({ ...prev, amountValueMin: e.target.value }))}
            />
            <input
              type="number"
              placeholder="Max"
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded p-2 focus:border-gold-500 outline-none placeholder:text-slate-600"
              value={filterState.amountValueMax}
              onChange={(e) => setFilterState(prev => ({ ...prev, amountValueMax: e.target.value }))}
            />
          </div>
        )}

        {filterState.amountOperator !== 'all' && (
          <button
            onClick={() => setFilterState(prev => ({
              ...prev,
              amountOperator: 'all',
              amountValue: '',
              amountValueMin: '',
              amountValueMax: '',
            }))}
            className="text-xs text-slate-500 hover:text-gold-500 transition-colors"
          >
            Clear amount filter
          </button>
        )}
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
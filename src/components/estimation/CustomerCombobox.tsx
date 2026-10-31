import { useState, useEffect, useRef, useMemo } from 'react';
import {
  getCustomers,
  getCustomerFullName,
  getCustomerAddressString,
  type BackendCustomer,
} from '../../services/customerService';

interface CustomerComboboxProps {
  onSelectCustomer: (customer: BackendCustomer) => void;
  onClear?: () => void;
  className?: string;
}

export default function CustomerCombobox({
  onSelectCustomer,
  onClear,
  className = '',
}: CustomerComboboxProps) {
  const [customers, setCustomers] = useState<BackendCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<BackendCustomer | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load customers on mount
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCustomers();
        if (isMounted) {
          setCustomers(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load customers');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle clicking outside to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter customers matching query
  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const company = (c.company_name || '').toLowerCase();
      const contactName = getCustomerFullName(c).toLowerCase();
      const email = (c.cus_email || '').toLowerCase();
      const phone = (c.cus_cnum || '').toLowerCase();
      const address = getCustomerAddressString(c).toLowerCase();
      const tin = (c.TIN_NO || '').toLowerCase();
      return (
        company.includes(q) ||
        contactName.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        address.includes(q) ||
        tin.includes(q)
      );
    });
  }, [customers, query]);

  const handleSelect = (customer: BackendCustomer) => {
    setSelectedCustomer(customer);
    const displayName = customer.company_name || getCustomerFullName(customer) || 'Customer';
    setQuery(displayName);
    setIsOpen(false);
    onSelectCustomer(customer);
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomer(null);
    setQuery('');
    setIsOpen(false);
    if (onClear) onClear();
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span>Existing Customer (Auto-fill)</span>
          <span className="text-[9px] font-normal text-slate-400 lowercase">(optional)</span>
        </label>
        {selectedCustomer && (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Customer auto-filled
          </span>
        )}
      </div>

      {/* Input container */}
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {loading ? (
            <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (selectedCustomer) setSelectedCustomer(null);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={
            loading
              ? 'Loading customer database...'
              : customers.length === 0
              ? 'No existing customers in DB (type manually below)'
              : 'Search customer name, company, email, or city...'
          }
          className={`w-full min-w-0 pl-10 pr-20 py-3 rounded-xl border bg-white dark:bg-[#162032] text-sm text-slate-800 dark:text-white outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 ${
            selectedCustomer
              ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/20'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        />

        {/* Right side buttons: clear & toggle chevron */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Clear selection"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title={isOpen ? 'Close list' : 'Show customer list'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A233A] p-1.5 shadow-xl animate-fade-in-up">
          {loading ? (
            <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Fetching customers...</span>
            </div>
          ) : error ? (
            <div className="py-4 px-3 text-center text-xs text-red-500">
              {error}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-6 px-4 text-center">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                No matching customers found
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                You can manually fill in the company and project details below.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Existing Customers ({filteredCustomers.length})</span>
                <span>Click to auto-fill</span>
              </div>
              {filteredCustomers.map((c) => {
                const contactName = getCustomerFullName(c);
                const addressStr = getCustomerAddressString(c);
                const isSelected = selectedCustomer?.cus_ID === c.cus_ID;

                return (
                  <div
                    key={c.cus_ID}
                    onClick={() => handleSelect(c)}
                    className={`p-3 rounded-xl transition-all cursor-pointer flex flex-col gap-1 border ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-slate-200/60 dark:hover:border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {c.company_name || contactName || `Customer #${c.cus_ID}`}
                      </span>
                      {c.TIN_NO && (
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                          TIN: {c.TIN_NO}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {contactName && c.company_name && (
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <span>👤</span>
                          <span>{contactName}</span>
                        </span>
                      )}
                      {c.cus_cnum && (
                        <span className="flex items-center gap-1">
                          <span>📞</span>
                          <span>{c.cus_cnum}</span>
                        </span>
                      )}
                      {c.cus_email && (
                        <span className="flex items-center gap-1 truncate max-w-xs">
                          <span>✉️</span>
                          <span>{c.cus_email}</span>
                        </span>
                      )}
                    </div>

                    {addressStr && (
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1 mt-0.5">
                        <span>📍</span>
                        <span className="truncate">{addressStr}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

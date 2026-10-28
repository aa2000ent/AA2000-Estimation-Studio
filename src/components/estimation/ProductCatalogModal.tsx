import { useEffect, useRef, useState } from 'react';
import {
  getCatalogBrands,
  productImageSrc,
  searchCatalogProducts,
  type CatalogBrand,
  type CatalogProduct,
} from '../../services/api/products';

interface Props {
  onSelect: (product: CatalogProduct) => void;
  onAddCustom: () => void;
  onClose: () => void;
  isDark?: boolean;
}

const peso = (value: unknown) =>
  `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Product database search used by the Bill of Materials "Add Item" action. */
export default function ProductCatalogModal({ onSelect, onAddCustom, onClose, isDark = false }: Props) {
  const [query, setQuery] = useState('');
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [brand, setBrand] = useState<CatalogBrand | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<Record<number, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    inputRef.current?.focus();
    const controller = new AbortController();
    getCatalogBrands(controller.signal).then(setBrands).catch(() => { /* chips are optional; search still works */ });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { controller.abort(); window.removeEventListener('keydown', onKey); };
  }, []);

  // Debounced search; a newer query aborts the previous request.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError('');
      try {
        setProducts(await searchCatalogProducts(query, brand, { signal: controller.signal }));
      } catch (err) {
        if (!controller.signal.aborted) {
          setProducts([]);
          setError(err instanceof Error ? err.message : 'Could not reach the product database.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, brand]);

  const handleAdd = (product: CatalogProduct) => {
    onSelect(product);
    setAdded(prev => ({ ...prev, [product.prod_ID]: (prev[product.prod_ID] || 0) + 1 }));
  };

  const panel = isDark ? 'bg-[#131B2E] text-slate-100 border-slate-800' : 'bg-white text-slate-800 border-slate-200';
  const card = isDark ? 'border-slate-800 bg-[#0D1527] hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300';
  const subtle = isDark ? 'text-slate-400' : 'text-slate-500';
  const chip = (active: boolean) => `shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase cursor-pointer transition-colors ${
    active ? 'bg-[#1E3A8A] text-white' : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
  }`;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search product catalog"
        className={`w-full max-w-3xl h-full max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${panel}`}
        onClick={e => e.stopPropagation()}
      >
        <header className={`px-5 pt-5 pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black uppercase tracking-wide">
                Search Product Catalog
                <span className={`ml-2 align-middle px-2 py-0.5 rounded-full text-[10px] font-bold normal-case ${isDark ? 'bg-blue-950 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>Database Search</span>
              </h2>
              <p className={`text-xs mt-0.5 ${subtle}`}>Select a product from the official database to add to the bill of materials</p>
            </div>
            <button onClick={onClose} aria-label="Close" className={`p-1.5 rounded-lg cursor-pointer ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search model number, product name, brand, or description..."
            className={`mt-4 w-full px-4 py-2.5 rounded-xl text-sm border-2 outline-none focus:border-blue-500 ${isDark ? 'bg-[#0D1527] border-slate-700' : 'bg-white border-slate-200'}`}
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${subtle}`}>Brand / Catalog ({brands.length} brands)</span>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <button className={chip(!brand)} onClick={() => setBrand(null)}>All</button>
            {brands.map(b => (
              <button key={b.id} className={chip(brand?.id === b.id)} onClick={() => setBrand(b)}>{b.name}</button>
            ))}
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isDark ? 'bg-[#0B132B]' : 'bg-slate-50'}`} aria-busy={isLoading}>
          {error ? (
            <div className="p-4 rounded-xl border border-red-300 bg-red-50 text-red-700 text-sm font-semibold">
              {error} You can still add a custom line item below.
            </div>
          ) : isLoading && products.length === 0 ? (
            <p className={`py-12 text-center text-sm font-semibold ${subtle}`}>Searching the product database...</p>
          ) : products.length === 0 ? (
            <p className={`py-12 text-center text-sm font-semibold ${subtle}`}>No products match your search.</p>
          ) : products.map(p => {
            const image = productImageSrc(p.image_base64);
            const model = p.model || p.prod_Code;
            const title = p.prod_Name || p.item_description || model || 'Unnamed product';
            const count = added[p.prod_ID] || 0;
            return (
              <div key={p.prod_ID} className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${card} ${isLoading ? 'opacity-60' : ''}`}>
                <div className={`w-12 h-12 shrink-0 rounded-lg border overflow-hidden flex items-center justify-center ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                  {image ? <img src={image} alt="" className="w-full h-full object-contain" /> : <span className={`text-[10px] font-bold ${subtle}`}>N/A</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase">
                    {model && <span className={`px-1.5 py-0.5 rounded border ${isDark ? 'border-blue-800 text-blue-300' : 'border-blue-200 text-blue-700 bg-blue-50'}`}>{model}</span>}
                    {p.brand && <span className={subtle}>• {p.brand}</span>}
                    {p.category && <span className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>{p.category}</span>}
                  </div>
                  <p className="mt-1 text-sm font-bold truncate" title={title}>{title}</p>
                  {p.item_description && p.item_description !== title && (
                    <p className={`text-xs truncate ${subtle}`} title={p.item_description}>{p.item_description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[10px] font-bold uppercase ${subtle}`}>Price</p>
                  <p className="text-sm font-black">{peso(p.prod_price)}</p>
                </div>
                <button
                  onClick={() => handleAdd(p)}
                  className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-800 cursor-pointer"
                >
                  {count ? `Added ×${count}` : '+ Add Item'}
                </button>
              </div>
            );
          })}
        </div>

        <footer className={`flex items-center justify-between gap-3 px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button onClick={onAddCustom} className="text-xs font-bold text-blue-600 hover:underline cursor-pointer">
            + Add Custom Line Item (Manual Entry)
          </button>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

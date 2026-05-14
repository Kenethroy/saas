import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

const SelectionModal = ({
  show,
  title,
  subtitle = "",
  searchPlaceholder = 'Search...',
  items = [],
  searchFields = ['name', 'email'],
  onClose,
  onSelect,
  onRefresh = null,
  refreshing = false,
  size = '2xl',
  renderItems
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const search = searchQuery.toLowerCase();
    return items.filter(item => {
      return searchFields.some(field => {
        const value = item[field];
        return value && value.toString().toLowerCase().includes(search);
      });
    });
  }, [items, searchQuery, searchFields]);

  const handleSelect = (item) => {
    onSelect(item);
    setSearchQuery('');
  };

  const sizeClass = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl'
  }[size] || 'max-w-2xl';

  if (!show) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
        <div className={`bg-white rounded-lg shadow-xl w-full ${sizeClass} overflow-hidden`}>
          {/* Modal Header */}
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
              {subtitle ? <p className="mt-1 text-[12px] text-[#607d8b]">{subtitle}</p> : null}
            </div>

            <div className="flex items-center gap-2">
              {onRefresh ? (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-sm border border-[#d4e0e9] bg-white px-3 py-1.5 text-[11px] font-bold text-[#1a3557] transition hover:bg-[#f5f9fc] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <i className={`fas ${refreshing ? "fa-spinner fa-spin" : "fa-rotate-right"} text-[11px]`} />
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
              ) : null}

              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
          </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Search Input */}
          <div className="relative">
             <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
             <input
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               type="text"
               placeholder={searchPlaceholder}
               className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
               autoFocus
             />
          </div>

          {/* Items List */}
          <div className="mt-4 h-[300px] overflow-y-auto erp-scroll pr-2">
            {filteredItems.length > 0 ? (
              renderItems({ filteredItems, selectItem: handleSelect })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-6">
                <div className="w-[48px] h-[48px] bg-[#e8f1f8] rounded-full flex items-center justify-center mb-3">
                  <i className="fas fa-search text-[20px] text-[#90a4ae]"></i>
                </div>
                <div className="text-[13px] font-bold text-[#546e7a] mb-1">
                  {searchQuery ? 'No results found' : 'No items available'}
                </div>
                <div className="text-[11px] text-[#90a4ae]">
                  {searchQuery ? `No matches for "${searchQuery}"` : 'There are no items to display'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SelectionModal;

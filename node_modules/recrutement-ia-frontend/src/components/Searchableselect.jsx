import { useEffect, useRef, useState } from 'react';
import { normalizeText } from '../utils/searchMatcher';

/**
 * Searchable select — behaves like a <select> but allows typing to filter options.
 *
 * Props: options, value, onChange, placeholder, icon (optional)
 */
export default function SearchableSelect({ options, value, onChange, placeholder = 'Sélectionner...', icon }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const wrapperRef = useRef(null);

  // Sync displayed value when it changes externally
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(value || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const filteredOptions = options.filter((opt) =>
    normalizeText(opt).includes(normalizeText(query))
  );

  const handleSelect = (opt) => {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="searchable-select" ref={wrapperRef}>
      <div className="searchable-select-input-wrap">
        {icon && <span className="search-icon">{icon}</span>}
        <input
          type="text"
          className="offres-search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {value && (
          <button type="button" className="search-clear" onClick={handleClear}>✕</button>
        )}
      </div>

      {open && (
        <ul className="searchable-select-dropdown">
          {filteredOptions.length === 0 ? (
            <li className="searchable-select-empty">Aucun résultat</li>
          ) : (
            <>
              {value && (
                <li className="searchable-select-option searchable-select-option--reset" onClick={handleClear}>
                  Tous les pays
                </li>
              )}
              {filteredOptions.map((opt) => (
                <li
                  key={opt}
                  className={`searchable-select-option ${opt === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
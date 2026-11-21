import React, { useState, useEffect, useRef, useCallback } from 'react';

const EntityAutocomplete = ({
    label,
    placeholder = 'Search...',
    fetchOptions,
    value, // current selected ID
    onSelect,
    renderOption,
    disabled = false,
    minChars = 2,
    debounceMs = 300,
    getOptionLabel = (opt) => opt.name || 'Unknown',
    getOptionValue = (opt) => opt._id,
    emptyMessage = 'Search for an item...',
    noResultsMessage = 'No matching results found.',
    resetOnSelect = false
}) => {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [error, setError] = useState(null);

    const wrapperRef = useRef(null);
    const debounceTimeout = useRef(null);
    const abortControllerRef = useRef(null);

    // Sync selected entity if initial `value` object is passed, or rely on parent handling it.
    useEffect(() => {
        if (!value) {
            setSelectedEntity(null);
            setQuery('');
            setOptions([]);
            setOpen(false);
            setActiveIndex(-1);
        } else if (value && typeof value === 'object') {
            setSelectedEntity(value);
        }
    }, [value]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const search = useCallback(async (searchQuery) => {
        if (searchQuery.length < minChars) {
            setOptions([]);
            setOpen(true);
            return;
        }

        setLoading(true);
        setError(null);
        
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        const signal = abortController.signal;

        try {
            const results = await fetchOptions(searchQuery, signal);
            if (abortControllerRef.current === abortController) {
                setOptions(results || []);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Autocomplete search error:", err);
                setError("Failed to fetch results.");
            }
        } finally {
            if (abortControllerRef.current === abortController) {
                setLoading(false);
                setOpen(true);
            }
        }
    }, [fetchOptions, minChars]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        setOpen(true);
        setActiveIndex(-1);

        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }

        debounceTimeout.current = setTimeout(() => {
            search(val);
        }, debounceMs);
    };

    const handleSelectOption = (option) => {
        if (resetOnSelect) {
            setSelectedEntity(null);
            setQuery('');
            setOptions([]);
            setOpen(false);
            setActiveIndex(-1);
            onSelect(option);
            return;
        }
        setSelectedEntity(option);
        setQuery('');
        setOpen(false);
        onSelect(option);
    };

    const handleClear = () => {
        setSelectedEntity(null);
        setQuery('');
        setOptions([]);
        setOpen(false);
        onSelect(null);
    };

    const handleKeyDown = (e) => {
        if (!open) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < options.length) {
                handleSelectOption(options[activeIndex]);
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                </label>
            )}

            <div className="relative">
                {selectedEntity ? (
                    <div className="flex items-center justify-between w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 shadow-sm focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
                        <span className="truncate flex-1 font-medium">
                            {getOptionLabel(selectedEntity)}
                        </span>
                        {!disabled && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="ml-2 text-gray-400 hover:text-red-500 focus:outline-none p-1 rounded-full hover:bg-red-50"
                                aria-label="Clear selection"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                ) : (
                    <input
                        type="text"
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            if (query.length >= minChars) {
                                setOpen(true);
                            }
                        }}
                        disabled={disabled}
                        placeholder={placeholder}
                        className={`block w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 shadow-sm focus:ring-primary-500 focus:border-primary-500 ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
                        autoComplete="off"
                    />
                )}
            </div>

            {open && !selectedEntity && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto">
                    {loading ? (
                        <div className="p-3 text-sm text-gray-500 flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Searching...
                        </div>
                    ) : error ? (
                        <div className="p-3 text-sm text-red-500">{error}</div>
                    ) : query.length > 0 && query.length < minChars ? (
                        <div className="p-3 text-sm text-gray-500">{emptyMessage}</div>
                    ) : query.length >= minChars && options.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">{noResultsMessage}</div>
                    ) : options.length > 0 ? (
                        <ul className="py-1">
                            {options.map((option, index) => (
                                <li
                                    key={getOptionValue(option) || index}
                                    onClick={() => handleSelectOption(option)}
                                    className={`px-3 py-2 cursor-pointer transition-colors duration-150 ${
                                        activeIndex === index ? 'bg-primary-50 text-primary-900' : 'hover:bg-gray-50 text-gray-700'
                                    }`}
                                >
                                    {renderOption ? renderOption(option) : (
                                        <div className="font-medium text-sm">
                                            {getOptionLabel(option)}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default EntityAutocomplete;

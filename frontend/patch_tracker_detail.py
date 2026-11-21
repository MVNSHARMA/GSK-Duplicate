import re

with open('src/pages/admin/TrackerDetail.jsx', 'r') as f:
    content = f.read()

# 1. Add imports
content = re.sub(
    r"(import React, \{ useState, useEffect, useCallback \} from 'react';)",
    r"\1\nimport TrackerCarFilters from '../../components/admin/TrackerCarFilters';",
    content
)

# 2. Add state variables
state_vars = """  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, pages: 1 });
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('');
  const [availableFilters, setAvailableFilters] = useState({ statuses: [], carTypes: [], complianceStatuses: [] });
"""
content = re.sub(r"  const \[pagination, setPagination\] = useState\(\{ total: 0, page: 1, limit: 50, pages: 1 \}\);", state_vars, content)

# 3. Add debounce effect
debounce_effect = """  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchCars = useCallback(async (page = 1) => {"""
content = re.sub(r"  const fetchCars = useCallback\(async \(page = 1\) => \{", debounce_effect, content)

# 4. Modify fetchCars to include filters and abort controller, and available filters
fetch_cars_new = """  const fetchCars = useCallback(async (page = 1, search = debouncedSearch, status = statusFilter, typeStr = typeFilter, compliance = complianceFilter) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('gsk_token');
      
      let typeObj = { make: '', model: '' };
      if (typeStr) {
        try { typeObj = JSON.parse(typeStr); } catch(e) {}
      }

      const params = new URLSearchParams({
        page,
        limit: 50
      });
      if (search) params.append('search', search);
      if (status) params.append('status', status);
      if (compliance) params.append('complianceStatus', compliance);
      if (typeObj.make || typeObj.model || typeStr) {
        params.append('make', typeObj.make || '');
        params.append('model', typeObj.model || '');
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/vehicle-batches/${id}/vehicles?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCars(data.data);
        setPagination(data.pagination);
        if (data.filters) setAvailableFilters(data.filters);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tracker cars:', error);
      setLoading(false);
    }
  }, [id, debouncedSearch, statusFilter, typeFilter, complianceFilter]);"""

content = re.sub(r"  const fetchCars = useCallback\(async \(page = 1\) => \{[\s\S]*?\}, \[id\]\);", fetch_cars_new, content)


# 5. Modify useEffect to clear selection and fetch
use_effect_new = """  useEffect(() => {
    fetchTracker();
  }, [fetchTracker]);

  useEffect(() => {
    setSelectedCarIds([]); // Clear selection safely on filter/pagination/search changes
    fetchCars(1);
  }, [fetchCars, debouncedSearch, statusFilter, typeFilter, complianceFilter]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setComplianceFilter('');
  };

  const handleTemplateChange"""

content = re.sub(r"  useEffect\(\(\) => \{\n    setSelectedCarIds\(\[\]\); \/\/ Clear selection safely on filter\/pagination changes\n    fetchTracker\(\);\n    fetchCars\(\);\n  \}, \[fetchTracker, fetchCars\]\);\n\n  const handleTemplateChange", use_effect_new, content)


# 6. Inject TrackerCarFilters component above the table
filters_component = """      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <TrackerCarFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          complianceFilter={complianceFilter}
          setComplianceFilter={setComplianceFilter}
          isImport={tracker?.type === 'Import'}
          availableFilters={availableFilters}
          onClearFilters={handleClearFilters}
          isLoading={loading}
        />
        
        {/* Tracker Cars Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">"""

content = re.sub(
    r"      <div className=\"bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6\">\n        <div className=\"overflow-x-auto\">\n          <table className=\"w-full\">\n            <thead className=\"bg-slate-50 border-b border-slate-100\">",
    filters_component,
    content
)

# Also update the display count text
count_display_old = """              <p className="text-sm text-gray-500">
                {selectedCarIds.length > 0 ? (
                  <span className="font-medium text-primary bg-primary/5 px-2 py-1 rounded-md">
                    {selectedCarIds.length} car{selectedCarIds.length !== 1 ? 's' : ''} selected
                  </span>
                ) : (
                  <span>Showing {cars.length} of {tracker.actualVehicleCount || 0} cars</span>
                )}
              </p>"""

count_display_new = """              <p className="text-sm text-gray-500">
                {selectedCarIds.length > 0 ? (
                  <span className="font-medium text-primary bg-primary/5 px-2 py-1 rounded-md mr-3">
                    {selectedCarIds.length} car{selectedCarIds.length !== 1 ? 's' : ''} selected
                  </span>
                ) : null}
                <span>
                  {tracker.actualVehicleCount || 0} total cars
                  {(debouncedSearch || statusFilter || typeFilter || complianceFilter) && pagination.total !== undefined ? ` | ${pagination.total} matching results` : ''}
                </span>
              </p>"""

content = content.replace(count_display_old, count_display_new)

# Empty states logic
empty_state_old = """                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    <Car className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-lg font-medium text-gray-900">No cars found</p>
                    <p className="text-sm mt-1">Start by adding cars to this tracker.</p>
                  </td>
                </tr>"""

empty_state_new = """                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    <Car className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    {(debouncedSearch || statusFilter || typeFilter || complianceFilter) ? (
                      <>
                        <p className="text-lg font-medium text-gray-900">No cars match your search or filters.</p>
                        <button onClick={handleClearFilters} className="mt-3 text-sm text-primary font-medium hover:underline">Clear Filters</button>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-medium text-gray-900">No cars have been added to this tracker yet.</p>
                        <p className="text-sm mt-1">Start by adding cars to this tracker.</p>
                      </>
                    )}
                  </td>
                </tr>"""

content = content.replace(empty_state_old, empty_state_new)

with open('src/pages/admin/TrackerDetail.jsx', 'w') as f:
    f.write(content)

print("Patch applied successfully.")

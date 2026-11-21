import re

with open('src/pages/admin/TrackerDetail.jsx', 'r') as f:
    content = f.read()

empty_state_old = """              {!loading && cars.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <Car size={32} className="mx-auto text-gray-300 mb-3 opacity-50" />
                    <p className="font-medium">No tracker cars yet</p>
                    <p className="text-sm mt-1 mb-4">Add a car individually or use Bulk Add to quickly add multiple cars.</p>
                    <div className="flex items-center justify-center gap-3">
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary hover:bg-primary-dark text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                      >
                        <Plus size={16} /> Add Car
                      </button>
                      <button 
                        onClick={() => setIsBulkAddModalOpen(true)}"""

empty_state_new = """              {!loading && cars.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <Car size={32} className="mx-auto text-gray-300 mb-3 opacity-50" />
                    {(debouncedSearch || statusFilter || typeFilter || complianceFilter) ? (
                      <>
                        <p className="font-medium text-gray-900">No cars match your search or filters.</p>
                        <button onClick={handleClearFilters} className="mt-3 text-sm text-primary font-medium hover:underline">Clear Filters</button>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">No tracker cars yet</p>
                        <p className="text-sm mt-1 mb-4">Add a car individually or use Bulk Add to quickly add multiple cars.</p>
                        <div className="flex items-center justify-center gap-3">
                          <button 
                            onClick={() => setIsModalOpen(true)}
                            className="bg-primary hover:bg-primary-dark text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                          >
                            <Plus size={16} /> Add Car
                          </button>
                          <button 
                            onClick={() => setIsBulkAddModalOpen(true)}"""

content = content.replace(empty_state_old, empty_state_new)

with open('src/pages/admin/TrackerDetail.jsx', 'w') as f:
    f.write(content)

print("Empty state updated successfully.")

import re

with open('src/pages/admin/TrackerDetail.jsx', 'r') as f:
    content = f.read()

# Make sure we import ChevronRight
content = re.sub(
    r"(import \{.*?ChevronLeft.*?)(\} from 'lucide-react';)",
    r"\1, ChevronRight \2",
    content
)

# Insert pagination UI after the table body closing tags
pagination_ui = """            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500 font-medium">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} matching cars
            </p>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => {
                        const newPage = Math.max(1, pagination.page - 1);
                        setPagination(prev => ({ ...prev, page: newPage }));
                        fetchCars(newPage);
                    }}
                    disabled={pagination.page === 1}
                    className="p-1.5 rounded bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-bold text-dark px-2">
                    {pagination.page} <span className="text-gray-400 font-normal">/ {pagination.pages}</span>
                </span>
                <button
                    onClick={() => {
                        const newPage = Math.min(pagination.pages, pagination.page + 1);
                        setPagination(prev => ({ ...prev, page: newPage }));
                        fetchCars(newPage);
                    }}
                    disabled={pagination.page === pagination.pages}
                    className="p-1.5 rounded bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
          </div>
        )}
      </div>"""

content = re.sub(
    r"            </tbody>\n          </table>\n        </div>\n      </div>",
    pagination_ui,
    content
)

with open('src/pages/admin/TrackerDetail.jsx', 'w') as f:
    f.write(content)

print("Pagination UI injected successfully.")

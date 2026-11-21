import re

with open('src/pages/admin/TrackerDetail.jsx', 'r') as f:
    content = f.read()

filters_component = """        </div>

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

        <div className="overflow-x-auto w-full">"""

content = content.replace('        </div>\n\n        <div className="overflow-x-auto w-full">', filters_component)

with open('src/pages/admin/TrackerDetail.jsx', 'w') as f:
    f.write(content)

print("Injected filters component successfully.")

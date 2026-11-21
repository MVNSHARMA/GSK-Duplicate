import re

with open('src/components/admin/TrackerCarFilters.jsx', 'r') as f:
    content = f.read()

constants = """import { Search, Filter, X } from 'lucide-react';

const STATUS_OPTIONS = [
  'Pending', 'Waiting', 'Completed', 'Expected', 'Received', 'Inspection', 
  'Waiting for Approval', 'In Service', 'Waiting for Parts', 'Compliance', 
  'Ready for Collection', 'Collected', 'Delivered', 'Cancelled'
];

const COMPLIANCE_OPTIONS = [
  'Not Started', 'In Progress', 'Completed'
];"""

content = content.replace("import { Search, Filter, X } from 'lucide-react';", constants)

status_render_old = """        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary min-w-[140px]"
          disabled={isLoading || availableFilters?.statuses?.length === 0}
        >
          <option value="">All Statuses</option>
          {availableFilters?.statuses?.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>"""

status_render_new = """        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary min-w-[140px]"
          disabled={isLoading}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>"""

content = content.replace(status_render_old, status_render_new)

compliance_render_old = """          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value)}
            className="bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary min-w-[170px]"
            disabled={isLoading || availableFilters?.complianceStatuses?.length === 0}
          >
            <option value="">All Compliance</option>
            {availableFilters?.complianceStatuses?.map(cs => (
              <option key={cs} value={cs}>{cs}</option>
            ))}
          </select>"""

compliance_render_new = """          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value)}
            className="bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary min-w-[170px]"
            disabled={isLoading}
          >
            <option value="">All Compliance</option>
            {COMPLIANCE_OPTIONS.map(cs => (
              <option key={cs} value={cs}>{cs}</option>
            ))}
          </select>"""

content = content.replace(compliance_render_old, compliance_render_new)

with open('src/components/admin/TrackerCarFilters.jsx', 'w') as f:
    f.write(content)

print("Constants injected into TrackerCarFilters.")

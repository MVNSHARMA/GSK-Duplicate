import React from 'react';
import { Link } from 'react-router-dom';
import { Loader, Clock, Edit2, Trash2 } from 'lucide-react';

const CustomerTypeBadge = ({ type }) => {
  if (type === 'import_company') return <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">Import</span>;
  if (type === 'rental_company') return <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wide">Rental</span>;
  return null;
};

const JobCardRow = ({ 
  jc, 
  isAdmin = true,
  isMechanic = false,
  canEdit, 
  canDelete, 
  updatingStatus, 
  handleUpdateStatus, 
  deletingCard, 
  deleteCard, 
  setSelectedHistoryCardId, 
  setHistoryModalOpen,
  VALID_STATUSES 
}) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-4 px-6">
        {updatingStatus[jc._id] ? (
          <div className="flex items-center gap-2">
            <Loader className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-xs text-gray-500">Updating...</span>
          </div>
        ) : (
            <select
              value={jc.status}
              onChange={(e) => handleUpdateStatus(jc._id, e.target.value, jc.status)}
              disabled={!canEdit || updatingStatus[jc._id]}
              className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider border cursor-pointer appearance-none outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${
                jc.status === 'Open' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                jc.status === 'In Progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                jc.status === 'Stuck' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                jc.status === 'Waiting for Parts' || jc.status === 'Waiting For Parts' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                jc.status === 'Waiting for Review' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                jc.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-200' :
                'bg-red-100 text-red-700 border-red-200'
              }`}
              style={{ paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%234b5563%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.65rem auto' }}
            >
              {[...new Set([...VALID_STATUSES, jc.status])].map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
        )}
      </td>
      <td className="py-4 px-6">
        <p className="font-bold text-sm text-dark font-mono">JC-{jc._id.slice(-4).toUpperCase()}</p>
        <p className="text-xs text-gray-500">{new Date(jc.createdAt).toLocaleDateString()}</p>
      </td>
      <td className="py-4 px-6">
        <p className="font-bold text-sm text-gray-800">
          {jc.vehicleId?.registrationNumber || jc.trackerCarId?.registrationNumber || '—'}
        </p>
        {!jc.vehicleId && jc.trackerCarId?.vin && (
          <p className="text-xs text-gray-500 mt-0.5">VIN: {jc.trackerCarId.vin}</p>
        )}
      </td>
      <td className="py-4 px-6">
        {jc.vehicleId ? (
          <>
            <p className="font-bold text-sm text-dark">{jc.vehicleId.brand} {jc.vehicleId.model}</p>
            <p className="text-xs text-gray-500">{jc.vehicleId.year || ''}</p>
          </>
        ) : jc.trackerCarId ? (
          <>
            <p className="font-bold text-sm text-dark">{jc.trackerCarId.make} {jc.trackerCarId.model}</p>
            <p className="text-[10px] uppercase tracking-wider text-purple-600 bg-purple-50 font-bold px-1.5 py-0.5 rounded inline-block mt-0.5 border border-purple-100">Fleet Car</p>
          </>
        ) : (
          <p className="text-sm text-gray-500">Unknown</p>
        )}
      </td>
      <td className="py-4 px-6 text-sm text-gray-700 flex items-center mt-2">
        {jc.customerId?.name || 'Unknown'}
        <CustomerTypeBadge type={jc.customerId?.customerType} />
      </td>
      <td className="py-4 px-6 text-sm text-gray-500">
        {jc.mechanic || '-'}
      </td>
      {isAdmin && !isMechanic && (
        <td className="py-4 px-6 text-sm font-mono font-bold text-dark">
          <div>${(jc.totalAmount || 0).toFixed(2)}</div>
          {jc.status === 'Completed' && !jc.financialsFinalized && !jc.hasInvoice && (
            <span className="inline-block text-[9px] font-sans font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded mt-0.5">
              Needs Finalization
            </span>
          )}
        </td>
      )}
      {isAdmin && !isMechanic && (
        <td className="py-4 px-6 text-center">
          {jc.hasInvoice ? (
            <div className="flex flex-col items-center">
              <Link to={`/admin/invoices?search=${jc.invoiceNumber}`} className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-green-100 text-green-700 hover:bg-green-200 transition-colors border border-green-200">
                {jc.invoiceNumber}
              </Link>
              {jc.invoiceStatus && (
                <span className="text-[9px] text-gray-500 mt-1 uppercase tracking-wider">{jc.invoiceStatus}</span>
              )}
            </div>
          ) : jc.status === 'Completed' && jc.financialsFinalized ? (
            <Link to={`/admin/invoices?action=new&jobCardId=${jc._id}`} className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200">
              Create
            </Link>
          ) : jc.status === 'Completed' && !jc.financialsFinalized ? (
            <Link
              to={`/admin/job-cards/${jc._id}/edit`}
              title="Review completed work and finalize amount before invoicing"
              className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200"
            >
              Finalize Amount
            </Link>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-gray-50 text-gray-400 border border-gray-100">
              Pending
            </span>
          )}
        </td>
      )}
      <td className="py-4 px-6 text-right">
        <div className="flex items-center justify-end gap-3">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setSelectedHistoryCardId(jc._id);
              setHistoryModalOpen(true);
            }} 
            className="text-gray-500 hover:text-blue-500 transition-colors"
            title="View History"
          >
            <Clock size={16} />
          </button>
          {canEdit && <Link to={`/admin/job-cards/${jc._id}/edit`} className="text-gray-500 hover:text-blue-500 transition-colors">
            <Edit2 size={16} />
          </Link>}
          {canDelete && <button 
            onClick={(e) => { e.stopPropagation(); deleteCard(jc._id); }} 
            disabled={deletingCard[jc._id]}
            className={`transition-colors ${deletingCard[jc._id] ? 'text-gray-300' : 'text-gray-500 hover:text-red-500'}`}
            title="Delete Job Card"
          >
            {deletingCard[jc._id] ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>}
        </div>
      </td>
    </tr>
  );
};

export default JobCardRow;

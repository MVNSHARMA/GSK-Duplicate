import React from 'react';

export const TableContainer = ({ children, className = '' }) => (
  <div className={`w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col ${className}`}>
    <div className="overflow-x-auto">
      {children}
    </div>
  </div>
);

export const Table = ({ children, className = '' }) => (
  <table className={`w-full text-left border-collapse whitespace-nowrap min-w-full ${className}`}>
    {children}
  </table>
);

export const TableHeader = ({ children, className = '' }) => (
  <thead className={`bg-gray-50/80 border-b border-gray-100 ${className}`}>
    {children}
  </thead>
);

export const TableHead = ({ children, className = '' }) => (
  <th className={`px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${className}`}>
    {children}
  </th>
);

export const TableBody = ({ children, className = '' }) => (
  <tbody className={`divide-y divide-gray-50 ${className}`}>
    {children}
  </tbody>
);

export const TableRow = ({ children, className = '', onClick }) => (
  <tr 
    onClick={onClick}
    className={`
      ${onClick ? 'cursor-pointer hover:bg-gray-50/80 transition-colors' : ''} 
      ${className}
    `}
  >
    {children}
  </tr>
);

export const TableCell = ({ children, className = '' }) => (
  <td className={`px-6 py-4 text-sm text-gray-700 ${className}`}>
    {children}
  </td>
);

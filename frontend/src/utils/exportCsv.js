export const downloadCSV = (data, filename, headers) => {
  if (!data || !data.length) {
    alert("No data available to export.");
    return;
  }

  // Define column keys and labels
  const columns = headers || Object.keys(data[0]).map(key => ({ label: key, key }));

  // Convert array of objects to CSV string
  const csvContent = [
    // Header row
    columns.map(c => `"${c.label}"`).join(','),
    // Data rows
    ...data.map(row => 
      columns.map(c => {
        let value = row[c.key];
        
        // Handle nested objects or arrays if necessary
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            value = value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join('; ');
          } else {
            value = value.name || value.title || value.registrationNumber || value.itemName || JSON.stringify(value);
          }
        }
        
        // Handle undefined/null
        if (value === undefined || value === null) {
          value = '';
        }
        
        // Escape quotes
        value = String(value).replace(/"/g, '""');
        return `"${value}"`;
      }).join(',')
    )
  ].join('\n');

  // Create a Blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

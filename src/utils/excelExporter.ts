import * as XLSX from 'xlsx';

export interface BoqExportItem {
  itemNumber?: number | string;
  description: string;
  category?: string;
  area?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
}

export function exportBoqToExcel(projectTitle: string, items: BoqExportItem[]) {
  const wsData: (string | number)[][] = [
    ['AA2000 SECURITY & ESTIMATION PLATFORM'],
    [`Project / Quotation: ${projectTitle}`],
    [`Generated Date: ${new Date().toLocaleDateString()}`],
    [],
    ['Item #', 'Description', 'Category / Area', 'Quantity', 'Unit', 'Unit Price (PHP)', 'Total Price (PHP)'],
  ];

  items.forEach((item, idx) => {
    wsData.push([
      item.itemNumber ?? idx + 1,
      item.description,
      item.area || item.category || 'General',
      item.quantity ?? 1,
      item.unit ?? 'lot',
      item.unitPrice ?? 0,
      item.totalPrice ?? ((item.quantity ?? 1) * (item.unitPrice ?? 0)),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOQ Estimate');
  XLSX.writeFile(wb, `${projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_boq.xlsx`);
}

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/** Generate and download a sample category Excel file */
export function downloadCategorySample() {
  const headers = ['name', 'description', 'branchId'];
  const sampleRows = [
    ['Skincare', 'All skincare products including cleansers, moisturizers, and serums', ''],
    ['Lipstick', 'Lip color products in various shades and finishes', ''],
    ['Haircare', 'Shampoos, conditioners, and hair treatments', ''],
    ['Fragrance', 'Perfumes, body mists, and colognes', ''],
    ['Makeup', 'Foundation, concealer, blush, and eye makeup', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = [
    { wch: 20 },
    { wch: 50 },
    { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Categories');

  // Add a README sheet
  const readmeHeaders = ['Field', 'Required', 'Description'];
  const readmeRows = [
    ['name', 'Yes', 'Category name (must be unique)'],
    ['description', 'No', 'Short description of the category'],
    ['branchId', 'No', 'Branch ID (leave empty for global)'],
  ];
  const readmeWs = XLSX.utils.aoa_to_sheet([readmeHeaders, ...readmeRows]);
  readmeWs['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, readmeWs, 'Instructions');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'mollari_category_sample.xlsx');
}

/** Generate and download a sample product Excel file */
export function downloadProductSample() {
  const headers = ['name', 'sku', 'barcode', 'price', 'costPrice', 'categoryId', 'description', 'branchId', 'openingStock', 'unitType', 'unitLabel'];
  const sampleRows = [
    ['Rose Glow Serum', 'SKU-ROSE-001', '8901234567890', '1250', '800', '1', 'A luxurious rose-infused serum for glowing skin', '1', '50', 'PIECE', 'pc'],
    ['Vitamin C Brightening Cream', 'SKU-VITC-001', '8901234567891', '890', '550', '1', 'Brightening cream with 20% Vitamin C', '1', '100', 'PIECE', 'pc'],
    ['Matte Lipstick - Ruby Red', 'SKU-LIP-001', '8901234567892', '450', '250', '2', 'Long-lasting matte finish lipstick', '1', '200', 'PIECE', 'pc'],
    ['Herbal Shampoo - 250ml', 'SKU-SHAMP-001', '8901234567893', '350', '180', '3', 'Sulfate-free herbal shampoo for all hair types', '1', '150', 'PIECE', 'pc'],
    ['Floral Perfume Mist', 'SKU-MIST-001', '8901234567894', '680', '400', '4', 'Refreshing floral body mist', '1', '80', 'PIECE', 'pc'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = [
    { wch: 30 }, { wch: 18 }, { wch: 15 },
    { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 45 }, { wch: 10 }, { wch: 14 },
    { wch: 10 }, { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');

  // Add a README sheet
  const readmeHeaders = ['Field', 'Required', 'Description'];
  const readmeRows = [
    ['name', 'Yes', 'Product name'],
    ['sku', 'Yes', 'Stock Keeping Unit (unique). Auto-generated if duplicate.'],
    ['barcode', 'No', 'Product barcode (EAN/UPC)'],
    ['price', 'Yes', 'Selling price (number)'],
    ['costPrice', 'No', 'Cost price (number)'],
    ['categoryId', 'Yes', 'Category ID (must exist in the system)'],
    ['description', 'No', 'Product description'],
    ['branchId', 'No', 'Branch/warehouse ID (uses default if empty)'],
    ['openingStock', 'No', 'Initial stock quantity (number)'],
    ['unitType', 'No', 'PIECE or WEIGHT (default: PIECE)'],
    ['unitLabel', 'No', 'Unit label like pc, kg, ml (default: pc)'],
  ];
  const readmeWs = XLSX.utils.aoa_to_sheet([readmeHeaders, ...readmeRows]);
  readmeWs['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, readmeWs, 'Instructions');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'mollari_product_sample.xlsx');
}

'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Download } from 'lucide-react'
import { toast } from 'sonner'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { Order } from '@/app/hooks/useOrders'

interface OrderItem {
  sku: string;
  quantity: number;
  price: number;
  total_price: number;
  is_using_cost?: boolean;
  cost_price?: number;
  margin_percentage?: number;
}

// Interface untuk item rincian profit
interface ProfitDetailItem {
  sku: string
  quantity: number
  pricePerItem: number
  method: 'modal' | 'margin'
  value: number // modal price atau margin percentage
  profitPerItem: number
  totalProfit: number
  shopName?: string
  orderSn?: string
}

interface ExcelExporterProps {
  orders: Order[]
  escrowTotal: number
  adsSpend: number | string | { ads_data: any[], total_cost: string, raw_cost: number }
  profitDetails: ProfitDetailItem[]
  shopProfitData: {[key: number]: {
    shopId: number,
    shopName: string,
    totalEscrow: number,
    totalProfit: number,
    adsSpend: number,
    netProfit: number
  }}
  calculateTotalProfit?: () => Promise<void>
  dateRange?: { from: Date | undefined, to?: Date | undefined } | undefined
}

export default function ExcelExporter({
  orders,
  escrowTotal,
  adsSpend,
  profitDetails,
  shopProfitData,
  calculateTotalProfit,
  dateRange
}: ExcelExporterProps) {
  const [isExporting, setIsExporting] = useState<boolean>(false)
  
  // Fungsi untuk mendapatkan nilai adsSpend yang valid
  const getValidAdsSpend = (): number => {
    // Jika adsSpend adalah object dengan raw_cost
    if (adsSpend && typeof adsSpend === 'object' && 'raw_cost' in adsSpend) {
      return typeof adsSpend.raw_cost === 'number' ? adsSpend.raw_cost : 0;
    }
    
    // Jika adsSpend adalah string (format rupiah)
    if (typeof adsSpend === 'string') {
      // Hapus format Rp. dan titik ribuan
      const numericValue = parseFloat(adsSpend.replace(/[^\d,]/g, '').replace(',', '.'));
      return isNaN(numericValue) ? 0 : numericValue;
    }
    
    // Jika adsSpend adalah angka langsung
    return typeof adsSpend === 'number' && !isNaN(adsSpend) ? adsSpend : 0;
  };
  
  // Ekstrak SKU dan kuantitas dari sku_qty string
  const extractSkusWithQuantity = (skuQty: string): { sku: string, quantity: number }[] => {
    if (!skuQty) return [];
    
    const result: { sku: string, quantity: number }[] = [];
    const entries = skuQty.split(',').map(entry => entry.trim());
    
    for (const entry of entries) {
      const match = entry.match(/(.*?)\s*\((\d+)\)/);
      if (match) {
        const [, skuName, quantityStr] = match;
        const quantity = parseInt(quantityStr);
        // Simpan SKU dengan nama asli (dengan case yang sama) dan versi normalized
        result.push({ 
          sku: skuName,
          quantity 
        });
      }
    }
    
    return result;
  };
  
  // Fungsi untuk export data ke Excel menggunakan ExcelJS
  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      toast.info('Mempersiapkan data laporan...');
      
      // Buat workbook dan worksheet di awal
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Profit Calculator';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet('Laporan Profit', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });

      // Definisikan kolom-kolom
      worksheet.columns = [
        { header: 'Nomor Pesanan', key: 'order_sn', width: 20 },
        { header: 'Tanggal', key: 'date', width: 12 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Toko', key: 'shop', width: 25 },
        { header: 'SKU', key: 'sku', width: 30 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Harga Asli', key: 'original_price', width: 15 },
        { header: 'Total Harga', key: 'total_price', width: 15 },
        { header: 'Proporsi', key: 'proportion', width: 12, hidden: true },
        { header: 'Dana Diterima', key: 'escrow', width: 15 },
        { header: 'Metode', key: 'method', width: 10 },
        { header: 'Nilai', key: 'value', width: 15 },
        { header: 'Laba Kotor', key: 'profit', width: 15 }
      ];

      // Style header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F0F5' }
      };

      // Bagi data menjadi chunks untuk mencegah browser freeze
      const chunks = [];
      for (let i = 0; i < orders.length; i += 1000) {
        chunks.push(orders.slice(i, i + 1000));
      }
      
      // Proses per batch untuk data besar
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        toast.info(`Memproses batch ${i+1} dari ${chunks.length}...`);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Proses setiap order dalam chunk
        for (const order of chunk) {
          if (!order.items || order.items.length === 0) continue;

          // Hitung total harga order untuk proporsi
          const totalOrderPrice = order.items.reduce((sum, item) => sum + item.total_price, 0);
          const escrowAmount = order.escrow_amount_after_adjustment || 0;

          // Proses setiap item dalam order
          for (const item of order.items) {
            // Cari data profit untuk SKU ini dari profitDetails
            const profitDetail = profitDetails.find(detail => 
              detail.sku === item.sku && 
              detail.orderSn === order.order_sn
            );

            // Gunakan data dari profitDetail jika ada
            const method = profitDetail ? profitDetail.method === 'modal' ? 'Modal' : 'Margin' : 'Margin';
            // Untuk margin, simpan dalam format desimal (misal 0.137 untuk 13.7%)
            const value = profitDetail ? profitDetail.value : 0.15;
            
            // Hitung proporsi escrow
            const itemEscrowProportion = item.total_price / totalOrderPrice;
            const itemEscrow = escrowAmount * itemEscrowProportion;

            // Tambah baris dengan rumus Excel
            const rowNumber = worksheet.rowCount + 1;
            worksheet.addRow({
              order_sn: order.order_sn,
              date: new Date(order.create_time * 1000).toLocaleDateString('id-ID'),
              status: order.order_status,
              shop: order.shop_name,
              sku: item.sku,
              quantity: item.quantity,
              original_price: item.price,
              total_price: item.total_price,
              proportion: Number(itemEscrowProportion.toFixed(1)),
              escrow: itemEscrow,
              method: method,
              value: method === 'Modal' ? value : value * 100
            });

            // Set format untuk kolom proporsi (kolom I)
            worksheet.getCell(`I${rowNumber}`).numFmt = '0.0';

            // Tambahkan rumus Excel untuk Laba Kotor
            const escrowCell = `J${rowNumber}`; // Kolom Dana Diterima
            const methodCell = `K${rowNumber}`; // Kolom Metode
            const valueCell = `L${rowNumber}`; // Kolom Nilai
            const qtyCell = `F${rowNumber}`; // Kolom Quantity

            // Formula yang lebih sederhana karena menggunakan nilai numerik
            worksheet.getCell(`M${rowNumber}`).value = {
              formula: `=IF(${methodCell}="Modal",${escrowCell}-${valueCell}*${qtyCell},${escrowCell}*${valueCell}/100)`
            };

            // Format kolom nilai sesuai dengan metode
            worksheet.getCell(`L${rowNumber}`).numFmt = method === 'Modal' ? '#,##0' : '0.0"%"';
            // Format kolom laba kotor
            worksheet.getCell(`M${rowNumber}`).numFmt = '#,##0';

            // Tambahkan validasi untuk memastikan nilai yang benar
            console.log('Debug profit calculation:', {
              orderSn: order.order_sn,
              sku: item.sku,
              escrow: itemEscrow,
              method: method,
              value: value,
              expectedProfit: method === 'Modal' ? 
                itemEscrow - (value * item.quantity) : 
                itemEscrow * value
            });
          }
        }
      }
      
      toast.info('Membuat file Excel...');
      
      // Ganti worksheet.sort dengan:
      const dataRows = worksheet.getRows(2, worksheet.rowCount - 1);
      if (dataRows) {
        dataRows.sort((a, b) => {
          const shopA = a.getCell('shop').value as string;
          const shopB = b.getCell('shop').value as string;
          return shopA.localeCompare(shopB);
        });
      }
      
      // Tambahkan penjelasan di bagian atas worksheet
      const infoSheet = workbook.addWorksheet('Info Perhitungan', {
        properties: { tabColor: { argb: 'FF6AA84F' } } // Warna hijau untuk tab info
      });
      
      // Header info
      infoSheet.mergeCells('A1:E1');
      const infoHeader = infoSheet.getCell('A1');
      infoHeader.value = 'PENJELASAN PERHITUNGAN LABA';
      infoHeader.font = { bold: true, size: 14 };
      infoHeader.alignment = { horizontal: 'center' };
      infoHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEAF3E0' } // Light green
      };
      
      // Tambahkan penjelasan
      infoSheet.mergeCells('A3:E3');
      infoSheet.getCell('A3').value = 'METODE PERHITUNGAN LABA KOTOR:';
      infoSheet.getCell('A3').font = { bold: true };
      
      infoSheet.mergeCells('A4:E4');
      infoSheet.getCell('A4').value = '1. Metode Modal: Laba Kotor = Dana Diterima - Harga Modal';
      
      infoSheet.mergeCells('A5:E5');
      infoSheet.getCell('A5').value = '2. Metode Margin: Laba Kotor = Dana Diterima × Persentase Margin';
      
      infoSheet.mergeCells('A7:E7');
      infoSheet.getCell('A7').value = 'METODE PERHITUNGAN LABA BERSIH:';
      infoSheet.getCell('A7').font = { bold: true };
      
      infoSheet.mergeCells('A8:E8');
      infoSheet.getCell('A8').value = 'Laba Bersih = Total Laba Kotor + Biaya Iklan (biaya iklan diinput sebagai nilai negatif)';
      
      infoSheet.mergeCells('A10:E10');
      infoSheet.getCell('A10').value = 'CATATAN:';
      infoSheet.getCell('A10').font = { bold: true };
      
      infoSheet.mergeCells('A11:E11');
      infoSheet.getCell('A11').value = '• Semua sel laba kotor menggunakan rumus Excel yang bisa Anda ubah sesuai kebutuhan';
      
      infoSheet.mergeCells('A12:E12');
      infoSheet.getCell('A12').value = '• Hover mouse pada sel Laba Kotor untuk melihat detail rumus yang digunakan';
      
      infoSheet.mergeCells('A13:E13');
      infoSheet.getCell('A13').value = '• Ubah nilai Biaya Iklan di bagian ringkasan jika diperlukan';
      
      infoSheet.mergeCells('A14:E14');
      infoSheet.getCell('A14').value = '• Semua perhitungan ringkasan menggunakan rumus Excel yang akan terupdate otomatis jika data berubah';
      
      // Atur lebar kolom
      infoSheet.getColumn('A').width = 15;
      infoSheet.getColumn('B').width = 25;
      infoSheet.getColumn('C').width = 25;
      infoSheet.getColumn('D').width = 25;
      infoSheet.getColumn('E').width = 15;
      
      // Tambahkan kolom untuk ringkasan per toko
      const shopSummaryCol = 15; // Kolom O (setelah kolom data utama dengan jarak 1 kolom)
      
      // Tambahkan header untuk ringkasan per toko
      const shopSummaryHeader = worksheet.getCell(1, shopSummaryCol);
      shopSummaryHeader.value = 'RINGKASAN PER TOKO';
      shopSummaryHeader.font = { bold: true };
      shopSummaryHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEAF3E0' } // Light green
      };
      
      // Merge header ringkasan per toko
      worksheet.mergeCells(1, shopSummaryCol, 1, shopSummaryCol + 5);
      
      // Header kolom ringkasan per toko
      const shopSummaryColumns = [
        { col: shopSummaryCol, title: 'Toko', width: 25 },
        { col: shopSummaryCol + 1, title: 'Jumlah Pesanan', width: 15 },
        { col: shopSummaryCol + 2, title: 'Dana Diterima', width: 15 },
        { col: shopSummaryCol + 3, title: 'Laba Kotor', width: 15 },
        { col: shopSummaryCol + 4, title: 'Biaya Iklan', width: 15 },
        { col: shopSummaryCol + 5, title: 'Laba Bersih', width: 15 }
      ];
      
      // Tambahkan header kolom ringkasan
      shopSummaryColumns.forEach(col => {
        const cell = worksheet.getCell(2, col.col);
        cell.value = col.title;
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' } // Light gray
        };
        worksheet.getColumn(col.col).width = col.width;
      });
      
      // Hitung jumlah pesanan per toko
      const orderCountByShop: Record<string, Set<string>> = {};
      worksheet.eachRow((row: ExcelJS.Row, rowNumber: number) => {
        if (rowNumber === 1) return; // Skip header
        
        const shop = row.getCell('shop').value as string;
        const orderSn = row.getCell('order_sn').value as string;
        if (shop) {
          if (!orderCountByShop[shop]) {
            orderCountByShop[shop] = new Set();
          }
          orderCountByShop[shop].add(orderSn);
        }
      });
      
      // Kumpulkan data per toko dari shopProfitData
      const shopSummaries = Object.values(shopProfitData);
      
      // Urutkan berdasarkan total escrow (terbesar ke terkecil)
      shopSummaries.sort((a, b) => b.totalEscrow - a.totalEscrow);
      
      // Tambahkan data per toko
      shopSummaries.forEach((shop, index) => {
        const row = index + 3; // Mulai dari baris 3 (setelah header)
        
        // Toko
        const shopNameCell = worksheet.getCell(row, shopSummaryCol);
        shopNameCell.value = shop.shopName;
        
        // Jumlah Pesanan (hitung dari order_sn yang unik)
        const orderCountCell = worksheet.getCell(row, shopSummaryCol + 1);
        orderCountCell.value = orderCountByShop[shop.shopName]?.size || 0;
        orderCountCell.alignment = { horizontal: 'center' };
        
        // Dana Diterima - Gunakan rumus SUMIF untuk menghitung escrow per toko
        const escrowCell = worksheet.getCell(row, shopSummaryCol + 2);
        escrowCell.value = { 
          formula: `=SUMIF(D:D,"${shop.shopName}",J:J)` // D kolom Toko, J kolom Dana Diterima
        };
        escrowCell.numFmt = '"Rp "#,##0';
        escrowCell.alignment = { horizontal: 'right' };
        
        // Laba Kotor - Gunakan rumus SUMIF untuk menghitung Laba Kotor per toko
        const profitCell = worksheet.getCell(row, shopSummaryCol + 3);
        profitCell.value = { 
          formula: `=SUMIF(D:D,"${shop.shopName}",M:M)` // M kolom Laba Kotor
        };
        profitCell.numFmt = '"Rp "#,##0';
        profitCell.alignment = { horizontal: 'right' };
        
        // Biaya Iklan
        const adsCell = worksheet.getCell(row, shopSummaryCol + 4);
        adsCell.value = -shop.adsSpend;
        adsCell.numFmt = '"Rp "#,##0';
        adsCell.alignment = { horizontal: 'right' };
        
        // Laba Bersih - Gunakan rumus untuk menghitung Laba Bersih dengan formula
        const netProfitCell = worksheet.getCell(row, shopSummaryCol + 5);
        netProfitCell.value = { 
          formula: `${profitCell.address}+${adsCell.address}` // Laba Kotor + Biaya Iklan (nilai Biaya Iklan sudah negatif)
        };
        netProfitCell.numFmt = '"Rp "#,##0';
        netProfitCell.alignment = { horizontal: 'right' };
        
        // Add conditional formatting untuk Laba Bersih dengan rumus
        worksheet.addConditionalFormatting({
          ref: netProfitCell.address,
          rules: [
            {
              type: 'cellIs',
              operator: 'lessThan',
              formulae: [0],
              priority: 1,
              style: {
                font: { color: { argb: 'FFFF0000' } } // Red text for negative
              }
            }
          ]
        });
        
        // Tambahkan border untuk setiap sel di baris toko
        for (let col = shopSummaryCol; col <= shopSummaryCol + 5; col++) {
          const cell = worksheet.getCell(row, col);
          cell.border = {
            top: { style: 'thin' },
            left: { style: col === shopSummaryCol ? 'medium' : 'thin' },
            bottom: { style: 'thin' },
            right: { style: col === shopSummaryCol + 5 ? 'medium' : 'thin' }
          };
        }
      });
      
      // Dapatkan baris terakhir dari ringkasan per toko
      const lastShopRow = shopSummaries.length + 3;
      
      // Tambahkan border tebal untuk header tabel ringkasan per toko
      for (let col = shopSummaryCol; col <= shopSummaryCol + 5; col++) {
        const headerCell = worksheet.getCell(2, col);
        headerCell.border = {
          top: { style: 'medium' },
          left: { style: col === shopSummaryCol ? 'medium' : 'thin' },
          bottom: { style: 'medium' },
          right: { style: col === shopSummaryCol + 5 ? 'medium' : 'thin' }
        };
      }
      
      // Tambahkan border tebal untuk baris terakhir tabel ringkasan per toko
      if (shopSummaries.length > 0) {
        for (let col = shopSummaryCol; col <= shopSummaryCol + 5; col++) {
          const lastRowCell = worksheet.getCell(lastShopRow - 1, col);
          lastRowCell.border = {
            ...lastRowCell.border,
            bottom: { style: 'medium' }
          };
        }
      }
      
      // Styling untuk header utama ringkasan per toko
      shopSummaryHeader.border = {
        top: { style: 'medium' },
        left: { style: 'medium' },
        bottom: { style: 'medium' },
        right: { style: 'medium' }
      };
      
      // Baris kosong setelah ringkasan per toko
      const emptyRow = worksheet.getRow(lastShopRow + 1);
      emptyRow.height = 10;
      
      // Dapatkan nilai adsSpend yang valid
      const validAdsSpend = getValidAdsSpend();
      const totalProfit = profitDetails.reduce((sum, item) => sum + item.totalProfit, 0);
      const netProfit = totalProfit - validAdsSpend;
      
      // Tambahkan header ringkasan laporan
      const reportSummaryHeader = worksheet.getCell(lastShopRow + 2, shopSummaryCol);
      reportSummaryHeader.value = 'RINGKASAN LAPORAN';
      reportSummaryHeader.font = { bold: true };
      reportSummaryHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFD3BD' } // Light orange
      };
      
      // Merge header ringkasan laporan
      worksheet.mergeCells(lastShopRow + 2, shopSummaryCol, lastShopRow + 2, shopSummaryCol + 1);
      
      // Buat header kolom untuk ringkasan (Kategori dan Nilai)
      const summaryColumnHeader1 = worksheet.getCell(lastShopRow + 3, shopSummaryCol);
      summaryColumnHeader1.value = 'Kategori';
      summaryColumnHeader1.font = { bold: true };
      summaryColumnHeader1.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' } // Light gray
      };

      const summaryColumnHeader2 = worksheet.getCell(lastShopRow + 3, shopSummaryCol + 1);
      summaryColumnHeader2.value = 'Nilai';
      summaryColumnHeader2.font = { bold: true };
      summaryColumnHeader2.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' } // Light gray
      };
      
      // Tambahkan data ringkasan dalam format dua kolom
      const summaryItems = [
        { label: 'Total Dana Diterima', value: escrowTotal },
        { label: 'Total Laba Kotor', value: totalProfit },
        { label: 'Biaya Iklan', value: -validAdsSpend },
        { label: 'Laba Bersih', value: netProfit }
      ];
      
      summaryItems.forEach((item, index) => {
        const row = lastShopRow + 4 + index;
        
        // Label
        const labelCell = worksheet.getCell(row, shopSummaryCol);
        labelCell.value = item.label;
        labelCell.font = { bold: true };
        
        // Value
        const valueCell = worksheet.getCell(row, shopSummaryCol + 1);
        
        // Gunakan rumus Excel untuk semua perhitungan
        if (item.label === 'Total Dana Diterima') {
          // Gunakan SUM untuk total dana diterima (kolom Dana Diterima)
          valueCell.value = { formula: 'SUM(J2:J' + (worksheet.rowCount + 1) + ')' };
        } 
        else if (item.label === 'Total Laba Kotor') {
          // Gunakan SUM untuk total laba kotor (kolom Laba Kotor)
          valueCell.value = { formula: 'SUM(M2:M' + (worksheet.rowCount + 1) + ')' };
        }
        else if (item.label === 'Biaya Iklan') {
          // Tetap menggunakan nilai biaya iklan, tapi bisa dimodifikasi nanti oleh pengguna
          valueCell.value = -validAdsSpend;
        }
        else if (item.label === 'Laba Bersih') {
          // Gunakan rumus untuk laba bersih (perbaiki untuk mengurangi, bukan menambahkan)
          valueCell.value = { formula: `${worksheet.getCell(lastShopRow + 5, shopSummaryCol + 1).address}+${worksheet.getCell(lastShopRow + 6, shopSummaryCol + 1).address}` };
        }
        
        valueCell.numFmt = '"Rp "#,##0';
        valueCell.alignment = { horizontal: 'right' };
        valueCell.font = { bold: true };
        
        // Conditional formatting untuk laba bersih berdasarkan rumus
        if (item.label === 'Laba Bersih') {
          // Tambahkan conditional formatting dengan rumus Excel
          worksheet.addConditionalFormatting({
            ref: valueCell.address,
            rules: [
              {
                type: 'cellIs',
                operator: 'lessThan',
                formulae: [0],
                priority: 1,
                style: {
                  font: { color: { argb: 'FFFF0000' } } // Red text for negative
                }
              }
            ]
          });
        }
      });
      
      // Tambahkan border di sekitar ringkasan
      for (let row = lastShopRow + 2; row <= lastShopRow + 8; row++) {
        for (let col = shopSummaryCol; col <= shopSummaryCol + 1; col++) {
          const cell = worksheet.getCell(row, col);
          cell.border = {
            top: { style: row === lastShopRow + 2 ? 'medium' : 'thin' },
            left: { style: (col === shopSummaryCol ? 'medium' : 'thin') },
            bottom: { style: row === lastShopRow + 8 ? 'medium' : 'thin' },
            right: { style: col === shopSummaryCol + 1 ? 'medium' : 'thin' }
          };
        }
      }
      
      // Tambahkan styling untuk header ringkasan laporan
      const summaryHeaderCell = worksheet.getCell(lastShopRow + 2, shopSummaryCol);
      summaryHeaderCell.border = {
        top: { style: 'medium' },
        left: { style: 'medium' },
        bottom: { style: 'medium' }, 
        right: { style: 'medium' }
      };
      
      // Pastikan borders tebal di sisi luar ringkasan
      for (let i = 0; i <= 1; i++) {
        // Border kiri pada kolom pertama
        for (let row = lastShopRow + 3; row <= lastShopRow + 8; row++) {
          worksheet.getCell(row, shopSummaryCol).border = {
            ...worksheet.getCell(row, shopSummaryCol).border,
            left: { style: 'medium' }
          };
        }
        
        // Border kanan pada kolom terakhir
        for (let row = lastShopRow + 3; row <= lastShopRow + 8; row++) {
          worksheet.getCell(row, shopSummaryCol + 1).border = {
            ...worksheet.getCell(row, shopSummaryCol + 1).border,
            right: { style: 'medium' }
          };
        }
        
        // Border bawah pada baris terakhir
        for (let col = shopSummaryCol; col <= shopSummaryCol + 1; col++) {
          worksheet.getCell(lastShopRow + 8, col).border = {
            ...worksheet.getCell(lastShopRow + 8, col).border,
            bottom: { style: 'medium' }
          };
        }
      }
      
      // Buat alternating row colors untuk data
      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        if (rowNumber % 2 === 0) { // even rows
          for (let colNumber = 1; colNumber <= worksheet.columnCount; colNumber++) {
            const cell = worksheet.getCell(rowNumber, colNumber);
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF9F9F9' } // Very light gray
            };
          }
        }
      }
      
      // Generate nama file dengan tanggal saat ini
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // format YYYY-MM-DD
      
      // Jika ada dateRange, tambahkan ke nama file
      let fileName = `Laporan_Profit_${dateStr}`;
      if (dateRange && dateRange.from) {
        const fromDate = dateRange.from.toISOString().split('T')[0];
        const toDate = dateRange.to ? dateRange.to.toISOString().split('T')[0] : fromDate;
        fileName = `Laporan_Profit_${fromDate}_${toDate}`;
      }
      
      // Export file dengan file-saver
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `${fileName}.xlsx`);
      
      toast.success('Berhasil export laporan ke Excel!');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Gagal export laporan ke Excel');
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-6 w-6 bg-green-100/50 dark:bg-green-900/50 border-green-200 dark:border-green-800"
      onClick={exportToExcel}
      disabled={isExporting || (orders.length === 0)}
      title="Export ke Excel"
    >
      {isExporting ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <Download className="h-3 w-3" />
      )}
    </Button>
  )
} 
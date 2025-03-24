'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Download } from 'lucide-react'
import { toast } from 'sonner'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { type Order } from '@/app/hooks/useOrders'



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
      
      // Jika tidak ada detail profit dan ada fungsi kalkulasi, panggil fungsi tersebut
      if (profitDetails.length === 0 && calculateTotalProfit) {
        await calculateTotalProfit();
      }
      
      // Bagi data menjadi chunks untuk mencegah browser freeze
      const chunks = [];
      for (let i = 0; i < orders.length; i += 1000) {
        chunks.push(orders.slice(i, i + 1000));
      }
      
      // Siapkan data untuk export
      interface ExportDataItem {
        'Nomor Pesanan': string;
        'Tanggal': string;
        'Status': string;
        'Toko': string;
        'Produk': string;
        'Harga': number | string;
        'Dana Diterima': number;
        'Margin/Modal': number;
        'Laba Kotor': number;
        '_shop_id': number;
        '_margin_value': number;
        '_metode': 'modal' | 'margin' | string;
      }
      
      const exportData: ExportDataItem[] = [];
      
      // Proses per batch untuk data besar
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Update progress
        toast.info(`Memproses batch ${i+1} dari ${chunks.length}...`);
        
        // Berikan kesempatan UI untuk update
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Proses setiap order dalam chunk
        for (const order of chunk) {
          // Cari detail profit untuk order ini
          const orderDetails = profitDetails.filter(d => d.orderSn === order.order_sn);
          
          // Hitung total profit untuk order ini
          const profit = orderDetails.reduce((sum, detail) => sum + detail.totalProfit, 0);
          
          // Ekstrak semua informasi penting
          const escrowAmount = order.escrow_amount_after_adjustment || 0;
          
          // Ambil nilai metode perhitungan (nilai modal atau margin)
          let nilaiMetode = '';
          let marginValue = 0;
          if (orderDetails.length > 0) {
            const firstDetail = orderDetails[0];
            if (firstDetail.method === 'modal') {
              nilaiMetode = `Rp ${Math.round(firstDetail.value).toLocaleString('id-ID')}`;
              marginValue = firstDetail.value;
            } else {
              // Untuk margin, cek apakah perlu desimal
              marginValue = firstDetail.value * 100;
              nilaiMetode = marginValue % 1 === 0 ? `${Math.round(marginValue)}%` : `${marginValue.toFixed(1)}%`;
            }
          }
          
          // Perkiraan harga total produk
          const hargaProduk = order.total_amount || escrowAmount;
          
          // Format tanggal - perbaiki konversi Unix timestamp
          let tanggal = '';
          if (order.create_time) {
            // Jika timestamp dalam format Unix (detik), kalikan dengan 1000 untuk milidetik
            const timestamp = typeof order.create_time === 'number' && order.create_time < 10000000000
              ? order.create_time * 1000  // Unix timestamp dalam detik
              : order.create_time;        // Sudah dalam milidetik atau format lain
            
            tanggal = new Date(timestamp).toLocaleDateString('id-ID');
          }
          
          exportData.push({
            'Nomor Pesanan': order.order_sn,
            'Tanggal': tanggal,
            'Status': order.order_status || 'Tidak diketahui',
            'Toko': order.shop_name || 'Tidak diketahui',
            'Produk': order.sku_qty || '-',
            'Harga': hargaProduk,
            'Dana Diterima': escrowAmount,
            'Margin/Modal': marginValue,
            'Laba Kotor': profit,
            '_shop_id': order.shop_id || 0,
            '_margin_value': marginValue,
            '_metode': orderDetails.length > 0 ? orderDetails[0].method : 'margin'
          });
        }
      }
      
      toast.info('Membuat file Excel...');
      
      // Kelompokkan pesanan berdasarkan toko dan urutkan berdasarkan nama toko
      exportData.sort((a, b) => {
        if (a['Toko'] < b['Toko']) return -1;
        if (a['Toko'] > b['Toko']) return 1;
        return 0;
      });
      
      // Buat workbook dan worksheet dengan ExcelJS
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Profit Calculator';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet('Laporan Profit', {
        views: [{ state: 'frozen', ySplit: 1 }] // Freeze header row
      });
      
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
      
      // Kembali ke worksheet utama (tidak menggunakan activate yang tidak didukung)
      
      // Definisikan kolom-kolom dengan alignment
      const columns = [
        { header: 'Nomor Pesanan', key: 'Nomor Pesanan', width: 20 },
        { header: 'Tanggal', key: 'Tanggal', width: 12 },
        { header: 'Status', key: 'Status', width: 15 },
        { header: 'Toko', key: 'Toko', width: 25 },
        { header: 'Produk', key: 'Produk', width: 30 },
        { header: 'Harga', key: 'Harga', width: 15 },
        { header: 'Dana Diterima', key: 'Dana Diterima', width: 15 },
        { header: 'Margin/Modal', key: 'Margin/Modal', width: 15 },
        { header: 'Laba Kotor', key: 'Laba Kotor', width: 15 },
      ];
      
      worksheet.columns = columns;
      
      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F0F5' } // Light blue background
      };
      headerRow.border = {
        bottom: { style: 'thin' }
      };
      
      // Set alignment untuk seluruh header
      headerRow.eachCell((cell) => {
        cell.alignment = { 
          horizontal: 'center', 
          vertical: 'middle' 
        };
      });
      
      // Tambahkan catatan pada header kolom Laba Kotor
      const labaKotorHeader = worksheet.getCell(1, 9); // Kolom I baris 1
      labaKotorHeader.note = {
        texts: [
          { text: 'Informasi Perhitungan Laba Kotor:\n', font: { bold: true } },
          { text: '• Jika Margin/Modal berformat mata uang (Rp): Laba Kotor = Dana Diterima - Harga Modal\n' },
          { text: '• Jika Margin/Modal berformat persentase (%): Laba Kotor = Dana Diterima × Persentase Margin\n\n' },
          { text: 'Rumus yang digunakan otomatis menyesuaikan dengan format nilai di kolom Margin/Modal.' }
        ],
        margins: { insetmode: 'auto' }
      };
      
      // Add data rows
      const visibleData = exportData.map(item => {
        // Ubah isi exportData untuk kolom Margin/Modal - simpan nilai numerik asli
        const { _shop_id, _margin_value, _metode, ...rest } = item;
        return {
          ...rest,
          'Margin/Modal': _margin_value // Simpan nilai numerik saja
        };
      });
      
      visibleData.forEach((data, index) => {
        worksheet.addRow(data);
      });
      
      // Optimalkan tinggi baris berdasarkan konten
      worksheet.properties.defaultRowHeight = 20; // Tinggi default yang lebih optimal
      
      // Auto-fit baris untuk konten yang panjang pada kolom produk
      for (let rowNumber = 2; rowNumber <= visibleData.length + 1; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const produktText = row.getCell(5).text || ''; // Kolom produk (E)
        
        // Jika teks produk panjang, sesuaikan tinggi baris
        if (produktText.length > 50) {
          row.height = Math.min(50, 20 + Math.floor(produktText.length / 30) * 5);
        }
        
        // Aktifkan text wrapping untuk kolom produk
        row.getCell(5).alignment = { 
          wrapText: true, 
          vertical: 'middle' 
        };
      }
      
      // Format cells berdasarkan tipe data
      for (let rowNumber = 2; rowNumber <= visibleData.length + 1; rowNumber++) {
        const originalData = exportData[rowNumber - 2];
        const row = worksheet.getRow(rowNumber);
        
        // Atur vertical alignment untuk semua sel
        row.eachCell((cell) => {
          const existingAlignment = cell.alignment || {};
          cell.alignment = { 
            ...existingAlignment,
            vertical: 'middle' 
          };
        });
        
        // Format untuk kolom Harga dan Dana Diterima
        worksheet.getCell(rowNumber, 6).numFmt = '"Rp "#,##0'; // Harga
        worksheet.getCell(rowNumber, 6).alignment = { 
          horizontal: 'right',
          vertical: 'middle'
        };
        
        worksheet.getCell(rowNumber, 7).numFmt = '"Rp "#,##0'; // Dana Diterima
        worksheet.getCell(rowNumber, 7).alignment = { 
          horizontal: 'right',
          vertical: 'middle'
        };
        
        // Format untuk kolom nomor pesanan dan tanggal
        worksheet.getCell(rowNumber, 1).alignment = { // Nomor Pesanan
          horizontal: 'left',
          vertical: 'middle'
        };
        
        worksheet.getCell(rowNumber, 2).alignment = { // Tanggal
          horizontal: 'center',
          vertical: 'middle'
        };
        
        worksheet.getCell(rowNumber, 3).alignment = { // Status
          horizontal: 'center',
          vertical: 'middle'
        };
        
        worksheet.getCell(rowNumber, 4).alignment = { // Toko
          horizontal: 'left',
          vertical: 'middle'
        };
        
        // Format untuk kolom Margin/Modal berdasarkan metode
        const marginModalCell = worksheet.getCell(rowNumber, 8);
        if (originalData._metode === 'modal') {
          marginModalCell.numFmt = '"Rp "#,##0'; // Format currency untuk modal
        } else {
          marginModalCell.numFmt = '0.0"%"'; // Format persentase untuk margin
        }
        marginModalCell.alignment = { 
          horizontal: 'center',
          vertical: 'middle'
        };
        
        // Ganti nilai Laba Kotor dengan rumus Excel yang lebih cerdas
        const labaKotorCell = worksheet.getCell(rowNumber, 9); // Kolom Laba Kotor (I)
        
        // Buat kolom tersembunyi untuk jenis perhitungan (AA)
        const metodeCol = 27; // Kolom AA (27)
        const metodeCell = worksheet.getCell(rowNumber, metodeCol);
        metodeCell.value = originalData._metode; // Simpan string "modal" atau "margin"
        
        // Gunakan pendekatan dengan fungsi FIND untuk mendeteksi metode berdasarkan format
        // FIND mencari pola format dan mengembalikan posisi jika ditemukan atau #VALUE! jika tidak
        // Kita gunakan ini untuk mendeteksi apakah sel menggunakan format Rupiah atau Persentase
        labaKotorCell.value = { 
          formula: `IF(${metodeCell.address}="modal", G${rowNumber}-H${rowNumber}, G${rowNumber}*(H${rowNumber}/100))` 
        };
        
        // Format untuk kolom Laba Kotor
        labaKotorCell.numFmt = '"Rp "#,##0';
        labaKotorCell.alignment = { 
          horizontal: 'right',
          vertical: 'middle'
        };
      }
      
      // Tambahkan kolom untuk ringkasan per toko
      const shopSummaryCol = 11; // Kolom K
      
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
      const orderCountByShop: {[key: number]: number} = {};
      exportData.forEach(item => {
        const shopId = item._shop_id;
        if (!orderCountByShop[shopId]) {
          orderCountByShop[shopId] = 0;
        }
        orderCountByShop[shopId]++;
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
        
        // Jumlah Pesanan
        const orderCountCell = worksheet.getCell(row, shopSummaryCol + 1);
        orderCountCell.value = orderCountByShop[shop.shopId] || 0;
        orderCountCell.alignment = { horizontal: 'center' };
        
        // Dana Diterima - Gunakan rumus SUMIF untuk menghitung escrow per toko
        const escrowCell = worksheet.getCell(row, shopSummaryCol + 2);
        const shopRows = exportData.filter(item => item._shop_id === shop.shopId)
          .map(item => {
            const foundItem = visibleData.find(v => v['Nomor Pesanan'] === item['Nomor Pesanan']);
            return foundItem ? visibleData.indexOf(foundItem) + 2 : -1;
          })
          .filter(index => index !== -1); // Hapus indeks yang tidak valid
        
        if (shopRows.length > 0) {
          // Jika ada baris untuk toko ini, buat rumus SUMIF yang menghitung dari data asli
          escrowCell.value = { formula: 'SUMIF(D2:D' + (visibleData.length + 1) + ',"' + shop.shopName + '",G2:G' + (visibleData.length + 1) + ')' };
        } else {
          // Fallback jika tidak ada data untuk toko ini
          escrowCell.value = 0;
        }
        escrowCell.numFmt = '"Rp "#,##0';
        escrowCell.alignment = { horizontal: 'right' };
        
        // Laba Kotor - Gunakan rumus SUMIF untuk menghitung Laba Kotor per toko
        const profitCell = worksheet.getCell(row, shopSummaryCol + 3);
        if (shopRows.length > 0) {
          profitCell.value = { formula: 'SUMIF(D2:D' + (visibleData.length + 1) + ',"' + shop.shopName + '",I2:I' + (visibleData.length + 1) + ')' };
        } else {
          profitCell.value = 0;
        }
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
          valueCell.value = { formula: 'SUM(G2:G' + (visibleData.length + 1) + ')' };
        } 
        else if (item.label === 'Total Laba Kotor') {
          // Gunakan SUM untuk total laba kotor (kolom Laba Kotor)
          valueCell.value = { formula: 'SUM(I2:I' + (visibleData.length + 1) + ')' };
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
      for (let rowNumber = 2; rowNumber <= visibleData.length + 1; rowNumber++) {
        if (rowNumber % 2 === 0) { // even rows
          for (let colNumber = 1; colNumber <= 9; colNumber++) {
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
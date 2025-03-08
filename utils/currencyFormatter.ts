export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
  
  return formatted.replace('Rp', 'Rp. ')
                  .replace(/\u00A0/g, ''); // Menghapus karakter non-breaking space
}

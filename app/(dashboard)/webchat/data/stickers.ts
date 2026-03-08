// Data stiker Shopee Indonesia (region: ID)
// Sumber: https://deo.shopeemobile.com/shopee/shopee-sticker-live-id/manifest.json

const CDN_BASE = 'https://deo.shopeemobile.com/shopee/shopee-sticker-live-id/packs';

export interface StickerPackage {
    pid: string;
    label: string;
    stickers: { sid: string; ext: string }[];
}

export const STICKER_PACKAGES: StickerPackage[] = [
    {
        pid: 'sticker_id_choki',
        label: 'Choki',
        stickers: [
            { sid: '0001', ext: 'png' }, { sid: '0002', ext: 'png' }, { sid: '0003', ext: 'png' },
            { sid: '0004', ext: 'png' }, { sid: '0005', ext: 'png' }, { sid: '0006', ext: 'png' },
            { sid: '0007', ext: 'png' }, { sid: '0008', ext: 'png' }, { sid: '0009', ext: 'png' },
            { sid: '0010', ext: 'png' }, { sid: '0011', ext: 'png' }, { sid: '0012', ext: 'png' },
            { sid: '0013', ext: 'png' }, { sid: '0014', ext: 'png' }, { sid: '0015', ext: 'png' },
            { sid: '0016', ext: 'png' }, { sid: '0017', ext: 'png' }, { sid: '0018', ext: 'png' },
            { sid: '0019', ext: 'png' }, { sid: '0020', ext: 'png' }, { sid: '0021', ext: 'png' },
            { sid: '0022', ext: 'png' }, { sid: '0023', ext: 'png' }, { sid: '0024', ext: 'png' },
            { sid: '0025', ext: 'png' }, { sid: '0026', ext: 'png' }, { sid: '0027', ext: 'png' },
            { sid: '0028', ext: 'png' }, { sid: '0029', ext: 'png' }, { sid: '0030', ext: 'png' },
            { sid: '0031', ext: 'png' }, { sid: '0032', ext: 'png' }, { sid: '0033', ext: 'png' },
            { sid: '0034', ext: 'png' }, { sid: '0035', ext: 'png' },
        ],
    },
    {
        pid: 'shrimp_id_new',
        label: 'Udang',
        stickers: [
            { sid: '0001', ext: 'png' }, { sid: '0002', ext: 'png' }, { sid: '0003', ext: 'png' },
            { sid: '0004', ext: 'png' }, { sid: '0006', ext: 'png' }, { sid: '0008', ext: 'png' },
            { sid: '0010', ext: 'png' }, { sid: '0012', ext: 'png' }, { sid: '0014', ext: 'png' },
            { sid: '0017', ext: 'png' }, { sid: '0020', ext: 'png' }, { sid: '0022', ext: 'png' },
            { sid: '0023', ext: 'png' }, { sid: '0028', ext: 'png' },
        ],
    },
    {
        pid: 'orangutan_id_new',
        label: 'Orangutan',
        stickers: [
            { sid: '0001', ext: 'png' }, { sid: '0002', ext: 'png' }, { sid: '0003', ext: 'png' },
            { sid: '0004', ext: 'png' }, { sid: '0005', ext: 'png' }, { sid: '0006', ext: 'png' },
            { sid: '0008', ext: 'png' }, { sid: '0012', ext: 'png' }, { sid: '0013', ext: 'png' },
            { sid: '0017', ext: 'png' }, { sid: '0023', ext: 'png' }, { sid: '0028', ext: 'png' },
        ],
    },
    {
        pid: 'xiaxiaobian_id',
        label: 'Xiaxiaobian',
        stickers: [
            { sid: '0004', ext: 'png' }, { sid: '0005', ext: 'png' }, { sid: '0006', ext: 'png' },
            { sid: '0008', ext: 'png' }, { sid: '0013', ext: 'png' }, { sid: '0014', ext: 'png' },
            { sid: '0018', ext: 'png' }, { sid: '0020', ext: 'png' }, { sid: '0028', ext: 'png' },
            { sid: '0029', ext: 'png' }, { sid: '0031', ext: 'png' }, { sid: '0032', ext: 'png' },
            { sid: '0036', ext: 'png' },
        ],
    },
];

export function getStickerUrl(pid: string, sid: string, ext: string = 'png'): string {
    return `${CDN_BASE}/${pid}/${sid}@1x.${ext}`;
}

'use client';
import React, { useState } from 'react';
import { STICKER_PACKAGES, getStickerUrl, StickerPackage } from '../data/stickers';

interface StickerPickerContentProps {
    onSelectSticker: (packageId: string, stickerId: string) => void;
}

const StickerPickerContent: React.FC<StickerPickerContentProps> = ({ onSelectSticker }) => {
    const [activePackage, setActivePackage] = useState<StickerPackage>(STICKER_PACKAGES[0]);

    return (
        <div className="w-full">
            {/* Header - Package Tabs */}
            <div className="flex items-center gap-1 pb-2 mb-2 border-b border-border overflow-x-auto scrollbar-thin">
                {STICKER_PACKAGES.map((pkg) => (
                    <button
                        key={pkg.pid}
                        type="button"
                        onClick={() => setActivePackage(pkg)}
                        className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer ${activePackage.pid === pkg.pid
                            ? 'bg-primary/15 ring-2 ring-primary/50 scale-105'
                            : 'hover:bg-muted'
                            }`}
                        title={pkg.label}
                    >
                        <img
                            src={getStickerUrl(pkg.pid, pkg.stickers[0].sid, pkg.stickers[0].ext)}
                            alt={pkg.label}
                            className="w-6 h-6 object-contain"
                            loading="lazy"
                        />
                    </button>
                ))}
            </div>

            {/* Sticker Grid */}
            <div className="grid grid-cols-4 gap-1 h-[200px] overflow-y-auto scrollbar-thin">
                {activePackage.stickers.map((sticker) => (
                    <button
                        key={`${activePackage.pid}-${sticker.sid}`}
                        type="button"
                        onClick={() => onSelectSticker(activePackage.pid, sticker.sid)}
                        className="aspect-square rounded-lg p-1.5 hover:bg-muted transition-colors duration-100 cursor-pointer active:scale-90"
                        title={`Stiker ${sticker.sid}`}
                    >
                        <img
                            src={getStickerUrl(activePackage.pid, sticker.sid, sticker.ext)}
                            alt={`Stiker ${sticker.sid}`}
                            className="w-full h-full object-contain"
                            loading="lazy"
                        />
                    </button>
                ))}
            </div>
        </div>
    );
};

export default StickerPickerContent;

'use client'

import React from 'react'
import { X } from 'lucide-react'

interface CustomImageLightboxProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  altText?: string
}

const CustomImageLightbox: React.FC<CustomImageLightboxProps> = ({
  isOpen,
  onClose,
  imageUrl,
  altText = 'Preview'
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <img 
          src={imageUrl} 
          alt={altText} 
          className="max-w-full max-h-[90vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
        >
          <X size={20} className="text-white" />
        </button>
      </div>
    </div>
  );
};

export default CustomImageLightbox 
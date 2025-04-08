'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  altText = 'Gambar pesan'
}) => {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Pastikan komponen hanya dirender di client side
  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      // Lock body scroll
      document.body.style.overflow = 'hidden'
    } else {
      // Animate out
      setTimeout(() => {
        setIsVisible(false)
        // Restore body scroll
        document.body.style.overflow = ''
      }, 200)
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5))
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const resetView = () => {
    setZoom(1)
    setRotation(0)
  }

  const handleClose = () => {
    resetView()
    onClose()
  }

  // Jangan render apapun jika komponen belum di-mount atau tidak visible
  if (!isMounted || !isVisible) return null

  // Gunakan createPortal untuk merender di root body
  const lightbox = (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-200 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      {/* Semi-transparent overlay with backdrop blur */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
        }}
      />
      
      <div 
        className="relative z-10 w-[90vw] h-[90vh] max-w-7xl flex flex-col bg-transparent overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header controls */}
        <div className="flex justify-between items-center p-2 bg-black/30 text-white rounded-t-lg backdrop-blur-md">
          <div className="text-sm font-medium truncate max-w-[60%]">{altText}</div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleZoomOut}
              className="text-white hover:bg-white/20"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleZoomIn}
              className="text-white hover:bg-white/20"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRotate}
              className="text-white hover:bg-white/20"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Image container */}
        <div className="flex-1 flex items-center justify-center overflow-hidden bg-black/30 backdrop-blur-sm relative">
          <div 
            className="relative transition-transform duration-200 ease-in-out cursor-move"
            style={{ 
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              maxHeight: '100%',
              maxWidth: '100%',
            }}
          >
            <img
              src={imageUrl}
              alt={altText}
              className="max-h-[80vh] max-w-full object-contain select-none"
              style={{
                transition: 'all 0.3s ease',
              }}
              onDoubleClick={handleZoomIn}
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Render ke document.body menggunakan portal
  return createPortal(lightbox, document.body);
}

export default CustomImageLightbox 
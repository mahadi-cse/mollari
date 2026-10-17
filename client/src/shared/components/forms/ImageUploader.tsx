'use client';

import React, { useState, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import apiClient from '@/shared/lib/apiClient';

export interface ImageUploaderRef {
  /** Upload the pending cropped image to Cloudinary. Returns the URL or null if nothing to upload. */
  upload: () => Promise<string | null>;
  /** Whether there's a pending local image waiting to be uploaded */
  hasPending: () => boolean;
}

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  aspect?: number;
  maxSizeMB?: number;
  placeholder?: string;
}

async function getCroppedBlob(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.92,
    );
  });
}

const ImageUploader = forwardRef<ImageUploaderRef, ImageUploaderProps>(function ImageUploader(
  {
    value,
    onChange,
    folder = 'mollari/products',
    aspect = 1,
    maxSizeMB = 0.2,
    placeholder = 'Click or drag to upload image',
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  // Local preview blob URL (not yet uploaded)
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  // The raw image + crop data kept for deferred upload
  const pendingRef = useRef<{ rawImage: string; croppedArea: Area } | null>(null);
  const [error, setError] = useState('');

  // Expose upload() to parent via ref
  useImperativeHandle(ref, () => ({
    hasPending: () => pendingRef.current !== null,
    upload: async () => {
      const pending = pendingRef.current;
      if (!pending) return null;

      try {
        const croppedBlob = await getCroppedBlob(pending.rawImage, pending.croppedArea);
        const compressedFile = await imageCompression(
          new File([croppedBlob], 'image.jpg', { type: 'image/jpeg' }),
          { maxSizeMB: maxSizeMB || 0.2, maxWidthOrHeight: 800, useWebWorker: true },
        );

        const formData = new FormData();
        formData.append('image', compressedFile);

        const res = await apiClient.post(
          `/uploads/image?folder=${encodeURIComponent(folder)}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );

        const url = res.data?.data?.url;
        if (url) {
          pendingRef.current = null;
          if (localPreview) URL.revokeObjectURL(localPreview);
          setLocalPreview(null);
          return url;
        }
        throw new Error('No URL returned');
      } catch (err: any) {
        throw new Error(err?.response?.data?.message || err.message || 'Upload failed');
      }
    },
  }));

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    setError('');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    const reader = new FileReader();
    reader.onload = () => setRawImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  /** User confirms crop — store locally, don't upload yet */
  const handleConfirmCrop = async () => {
    if (!rawImage || !croppedArea) return;
    setError('');

    try {
      // Store for deferred upload
      pendingRef.current = { rawImage, croppedArea };

      // Create a local preview blob URL
      const croppedBlob = await getCroppedBlob(rawImage, croppedArea);
      if (localPreview) URL.revokeObjectURL(localPreview);
      const previewUrl = URL.createObjectURL(croppedBlob);
      setLocalPreview(previewUrl);

      // Clear the cropper modal
      setRawImage(null);
    } catch {
      setError('Failed to process image');
    }
  };

  const handleCancel = () => {
    setRawImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setError('');
  };

  const handleRemove = () => {
    pendingRef.current = null;
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    onChange('');
  };

  const displayImage = localPreview || value;

  return (
    <div>
      {/* Crop modal overlay */}
      {rawImage && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
          onClick={handleCancel}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
              <span className="text-sm font-bold text-zinc-800">Crop Image</span>
              <button
                type="button"
                onClick={handleCancel}
                className="text-lg leading-none text-zinc-400 hover:text-zinc-700 cursor-pointer border-none bg-transparent"
              >
                ✕
              </button>
            </div>
            <div className="relative h-72 bg-zinc-900">
              <Cropper
                image={rawImage}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex items-center gap-3 px-5 py-3 border-t border-zinc-100">
              <label className="text-xs text-zinc-500 shrink-0">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-pink-600"
              />
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-pink-600 text-white hover:bg-pink-700 transition"
              >
                Confirm
              </button>
            </div>
            {error && <div className="px-5 pb-3 text-xs text-red-500">{error}</div>}
          </div>
        </div>
      )}

      {/* Picker / preview */}
      <div
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed border-zinc-200 hover:border-pink-300 transition bg-zinc-50 flex flex-col items-center justify-center gap-2 p-3"
        style={{ minHeight: displayImage ? 64 : 80 }}
      >
        {displayImage ? (
          <div className="flex items-center gap-3 w-full">
            <img src={displayImage} alt="Preview" className="h-14 w-14 rounded-lg object-cover border border-zinc-200" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-zinc-500 truncate">
                {localPreview ? 'Ready to upload on save' : (value.split('/').pop() || 'Uploaded')}
              </div>
              <div className="text-[10px] text-pink-500 font-medium mt-0.5">Click to replace</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove(); }}
              className="text-xs text-zinc-400 hover:text-red-500 border-none bg-transparent cursor-pointer px-1"
              title="Remove image"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <div className="text-xl">📷</div>
            <div className="text-xs text-zinc-500">{placeholder}</div>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFileSelect}
        className="hidden"
      />
      {error && !rawImage && <div className="mt-1 text-xs text-red-500">{error}</div>}
    </div>
  );
});

export default ImageUploader;

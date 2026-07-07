'use client';

import { useState, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export default function ImageCropper({ src, onCancel, onApply }) {
  const [crop, setCrop] = useState(null);
  const [completedCrop, setCompletedCrop] = useState(null);
  const cropperImgRef = useRef(null);

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerAspectCrop(width, height, 1);
    setCrop(initialCrop);
    cropperImgRef.current = e.currentTarget;
  };

  const handleApply = () => {
    if (!completedCrop || !cropperImgRef.current) return;
    const image = cropperImgRef.current;
    
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      onApply(blob);
    }, 'image/jpeg');
  };

  return (
    <div className="space-y-4">
      <div className="max-h-[50vh] overflow-hidden flex items-center justify-center bg-black rounded-xl relative">
        <ReactCrop 
          crop={crop} 
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={1}
        >
          <img 
            src={src} 
            alt="To Crop"
            onLoad={onImageLoad}
            className="max-h-[45vh] object-contain"
            draggable="false"
          />
        </ReactCrop>
      </div>
      <div className="flex justify-end space-x-2">
        <button 
          onClick={onCancel}
          className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold cursor-pointer"
          type="button"
        >
          Cancel
        </button>
        <button 
          onClick={handleApply}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold cursor-pointer"
          type="button"
        >
          Apply Crop
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Camera, Image, Type, ChevronLeft, Send, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import api from '@/services/api';

const GRADIENTS = [
  'linear-gradient(135deg, #f59e0b, #ec4899)',
  'linear-gradient(135deg, #10b981, #3b82f6)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
  'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  'linear-gradient(135deg, #f43f5e, #f59e0b)',
  '#1f2937',
  '#312e81',
];

export default function StoryCreateModal({ isOpen, onClose, onStoryCreated }) {
  const [step, setStep] = useState('select'); // select, camera, edit, settings
  const [mediaFile, setMediaFile] = useState(null); // File blob
  const [previewUrl, setPreviewUrl] = useState(''); // Local Object URL for edit stage
  const [mediaType, setMediaType] = useState('image'); // image, video, text
  const [caption, setCaption] = useState('');
  
  // Text story specific state
  const [textGradientIdx, setTextGradientIdx] = useState(0);
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState(32); //px
  
  // Camera specific state
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Upload state
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [audience, setAudience] = useState('everyone'); // everyone, close_friends

  useEffect(() => {
    // Cleanup preview URLs to prevent leaks
    return () => {
      if (previewUrl && mediaType !== 'text') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, mediaType]);

  useEffect(() => {
    // Stop camera tracks when modal is closed or step changes
    if (!isOpen || step !== 'camera') {
      stopCamera();
    }
  }, [step, isOpen]);

  if (!isOpen) return null;

  // Camera initialization
  const startCamera = async () => {
    setError('');
    setStep('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Could not access camera. Please check permissions or select a file instead.');
      setStep('select');
    }
  };

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  }

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Create temporary canvas to draw the frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Flip snapshot if using front-facing selfie mode
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });
          setMediaFile(file);
          setPreviewUrl(URL.createObjectURL(blob));
          setMediaType('image');
          setStep('edit');
        }
      }, 'image/jpeg', 0.95);
    }
    stopCamera();
  };

  // File picker handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10MB for image, 100MB for video)
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      setError('Unsupported file format. Please upload an image or video.');
      return;
    }

    const maxSize = isImage ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File size exceeds limit (${isImage ? '10MB' : '100MB'}).`);
      return;
    }

    setMediaFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMediaType(isImage ? 'image' : 'video');
    setStep('edit');
  };

  // Convert text-only gradient canvas to blob for upload
  const generateTextStoryBlob = () => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      // 1. Draw gradient background
      const fillStyle = GRADIENTS[textGradientIdx];
      if (fillStyle.startsWith('linear-gradient')) {
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, textGradientIdx === 0 ? '#f59e0b' : textGradientIdx === 1 ? '#10b981' : textGradientIdx === 2 ? '#8b5cf6' : textGradientIdx === 3 ? '#3b82f6' : '#f43f5e');
        grad.addColorStop(1, textGradientIdx === 0 ? '#ec4899' : textGradientIdx === 1 ? '#3b82f6' : textGradientIdx === 2 ? '#ec4899' : textGradientIdx === 3 ? '#8b5cf6' : '#f59e0b');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = fillStyle;
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw Text caption centered
      ctx.fillStyle = textColor;
      ctx.font = `bold ${fontSize * 2}px sans-serif`; // Scale font for 1080p canvas
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Simple multiline wrapping
      const words = caption.split(' ');
      const lines = [];
      let currentLine = '';
      const maxWidth = canvas.width - 160;

      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) lines.push(currentLine);

      const lineHeight = fontSize * 2.8;
      const startY = (canvas.height / 2) - ((lines.length - 1) * lineHeight / 2);

      lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, startY + (index * lineHeight));
      });

      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  // Submit story upload trigger
  const handleShareStory = async () => {
    setSubmitting(true);
    setError('');
    setProgress(15);
    
    try {
      let finalFile = mediaFile;
      if (mediaType === 'text') {
        const textBlob = await generateTextStoryBlob();
        if (!textBlob) {
          throw new Error('Canvas rendering failed');
        }
        finalFile = new File([textBlob], 'text_story.jpg', { type: 'image/jpeg' });
      }

      setProgress(40);

      const formData = new FormData();
      formData.append('file', finalFile);
      // Backend expects the optional caption string
      if (mediaType !== 'text' && caption) {
        formData.append('caption', caption);
      }

      setProgress(60);

      await api.post('/stories/create/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setProgress(100);
      onStoryCreated();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post story. Please try again.');
      setProgress(0);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset modal states
    setStep('select');
    setMediaFile(null);
    setPreviewUrl('');
    setCaption('');
    setError('');
    setProgress(0);
    setMediaType('image');
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Modal Card container */}
      <div className="relative w-full max-w-lg h-full sm:h-[80vh] sm:max-h-[750px] bg-zinc-950 text-white flex flex-col overflow-hidden sm:rounded-2xl border border-zinc-800 shadow-2xl">
        
        {/* Header */}
        <header className="p-4 border-b border-zinc-850 flex items-center justify-between shrink-0 bg-zinc-900/40">
          <div className="flex items-center space-x-2">
            {step !== 'select' && (
              <button 
                onClick={() => {
                  if (step === 'camera') setStep('select');
                  else if (step === 'edit') setStep('select');
                  else if (step === 'settings') setStep('edit');
                }}
                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <h3 className="font-extrabold text-sm uppercase tracking-wider">
              {step === 'select' && 'Create Story'}
              {step === 'camera' && 'Take Snapshot'}
              {step === 'edit' && 'Edit Story'}
              {step === 'settings' && 'Publish Story'}
            </h3>
          </div>
          
          <button 
            onClick={handleClose} 
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Global Error Banner */}
        {error && (
          <div className="p-3 bg-red-950/40 border-b border-red-900/50 text-red-400 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Panels */}
        <div className="flex-1 overflow-y-auto flex flex-col relative bg-zinc-950">
          
          {/* Step 1: Media Selection */}
          {step === 'select' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
              <div className="h-20 w-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
                <Sparkles className="h-10 w-10" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="font-bold text-base">Select story format</h4>
                <p className="text-xs text-zinc-500 max-w-[280px]">Take a live selfie, choose a file from your photo library, or share a colorful text slide.</p>
              </div>

              <div className="w-full max-w-xs flex flex-col space-y-3.5 pt-4">
                {/* Take Photo button */}
                <button 
                  onClick={startCamera}
                  className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-850 rounded-xl border border-zinc-800 flex items-center justify-between text-sm font-semibold transition"
                >
                  <span className="flex items-center space-x-3">
                    <Camera className="h-5 w-5 text-indigo-400" />
                    <span>Use Camera</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-medium">Selfie</span>
                </button>

                {/* Upload from device button */}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-850 rounded-xl border border-zinc-800 flex items-center justify-between text-sm font-semibold transition"
                >
                  <span className="flex items-center space-x-3">
                    <Image className="h-5 w-5 text-emerald-400" />
                    <span>Upload Media</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-medium">Gallery</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*,video/*"
                  className="hidden" 
                />

                {/* Text story button */}
                <button 
                  onClick={() => {
                    setMediaType('text');
                    setStep('edit');
                  }}
                  className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-850 rounded-xl border border-zinc-800 flex items-center justify-between text-sm font-semibold transition"
                >
                  <span className="flex items-center space-x-3">
                    <Type className="h-5 w-5 text-pink-400" />
                    <span>Text Story</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-medium">Gradient</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Camera Capture */}
          {step === 'camera' && (
            <div className="flex-1 flex flex-col justify-between bg-black relative">
              <div className="flex-1 flex items-center justify-center overflow-hidden">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full max-h-[500px] object-cover scale-x-[-1] bg-black"
                />
              </div>
              
              {/* Shutter actions */}
              <div className="p-6 bg-zinc-950 shrink-0 flex justify-center border-t border-zinc-900">
                <button 
                  onClick={takeSnapshot}
                  className="h-16 w-16 bg-white hover:bg-zinc-200 rounded-full border-4 border-zinc-800 flex items-center justify-center transition shadow-lg shrink-0 cursor-pointer"
                >
                  <div className="h-10 w-10 bg-white rounded-full border-2 border-zinc-950" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Editor */}
          {step === 'edit' && (
            <div className="flex-1 flex flex-col relative bg-zinc-950">
              
              {/* Media viewer window */}
              <div className="flex-1 max-h-[480px] min-h-[300px] relative overflow-hidden bg-black flex items-center justify-center">
                
                {/* Render Text-only gradients background */}
                {mediaType === 'text' && (
                  <div 
                    style={{ background: GRADIENTS[textGradientIdx] }}
                    className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none"
                  >
                    <textarea
                      placeholder="Start typing your story..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      style={{ color: textColor, fontSize: `${fontSize}px` }}
                      className="w-full max-w-sm bg-transparent border-none text-center font-bold outline-none focus:ring-0 placeholder-zinc-500/80 resize-none font-sans scrollbar-none"
                      rows={6}
                      maxLength={180}
                      autoFocus
                    />
                  </div>
                )}

                {/* Render Image template */}
                {mediaType === 'image' && previewUrl && (
                  <>
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                    {/* Caption Input Box Overlay */}
                    <div className="absolute bottom-4 inset-x-4">
                      <input 
                        type="text" 
                        placeholder="Add a caption..."
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full px-4 py-2.5 bg-black/60 hover:bg-black/75 focus:bg-black/90 backdrop-blur rounded-xl border border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-white transition-all text-center"
                        maxLength={150}
                      />
                    </div>
                  </>
                )}

                {/* Render Video template */}
                {mediaType === 'video' && previewUrl && (
                  <>
                    <video src={previewUrl} autoPlay loop muted playsInline className="w-full h-full object-contain" />
                    {/* Caption Input Box Overlay */}
                    <div className="absolute bottom-4 inset-x-4">
                      <input 
                        type="text" 
                        placeholder="Add a caption..."
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full px-4 py-2.5 bg-black/60 hover:bg-black/75 focus:bg-black/90 backdrop-blur rounded-xl border border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-white transition-all text-center"
                        maxLength={150}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Editing Controls bottom bar */}
              <div className="p-4 bg-zinc-900/60 border-t border-zinc-850 shrink-0 flex flex-col space-y-4">
                
                {/* Specific controls for text-only story */}
                {mediaType === 'text' && (
                  <div className="flex flex-col space-y-3">
                    {/* Gradients presets switcher */}
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-zinc-400 font-bold shrink-0">Backgrounds:</span>
                      <div className="flex space-x-2 overflow-x-auto py-1 scrollbar-none">
                        {GRADIENTS.map((grad, idx) => (
                          <button
                            key={idx}
                            onClick={() => setTextGradientIdx(idx)}
                            style={{ background: grad }}
                            className={`h-7 w-7 rounded-full shrink-0 transition border-2 ${
                              textGradientIdx === idx ? 'border-white scale-110 shadow' : 'border-transparent hover:scale-105'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Font customizations */}
                    <div className="flex items-center justify-between">
                      {/* Font size */}
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-zinc-400 font-bold">Size:</span>
                        <input 
                          type="range" 
                          min={20} 
                          max={48} 
                          value={fontSize} 
                          onChange={(e) => setFontSize(parseInt(e.target.value))}
                          className="w-24 accent-primary h-1 bg-zinc-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Font color */}
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs text-zinc-400 font-bold mr-1">Colors:</span>
                        {['#ffffff', '#000000', '#facc15', '#f87171', '#60a5fa'].map(color => (
                          <button
                            key={color}
                            onClick={() => setTextColor(color)}
                            style={{ backgroundColor: color }}
                            className={`h-5 w-5 rounded-full border border-zinc-800 transition ${
                              textColor === color ? 'ring-2 ring-primary scale-110' : 'hover:scale-105'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Advance action button */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => setStep('settings')}
                    disabled={mediaType === 'text' && !caption.trim()}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center space-x-2 transition shadow shadow-primary/10 select-none cursor-pointer"
                  >
                    <span>Next</span>
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Audience settings & publish */}
          {step === 'settings' && (
            <div className="flex-1 flex flex-col justify-between p-6 space-y-6">
              <div className="space-y-4 flex-1">
                <h4 className="font-bold text-sm text-zinc-400 uppercase tracking-wider">Publish options</h4>
                
                {/* Audience Selection Row */}
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-850 p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h5 className="text-sm font-semibold">Audience Setting</h5>
                      <p className="text-[11px] text-zinc-500">Choose who can view this story slide.</p>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2 pt-2 border-t border-zinc-850/80">
                    <label className="flex items-center justify-between p-3 bg-zinc-950/40 rounded-xl border border-zinc-850 hover:bg-zinc-900 cursor-pointer transition select-none">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">Everyone</span>
                        <span className="text-[10px] text-zinc-500">All of your followers can view</span>
                      </div>
                      <input 
                        type="radio" 
                        name="audience" 
                        checked={audience === 'everyone'}
                        onChange={() => setAudience('everyone')}
                        className="accent-primary h-4 w-4"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-zinc-950/40 rounded-xl border border-zinc-850 hover:bg-zinc-900 cursor-pointer transition select-none">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">Close Friends</span>
                        <span className="text-[10px] text-zinc-500">Only share with close friends list</span>
                      </div>
                      <input 
                        type="radio" 
                        name="audience" 
                        checked={audience === 'close_friends'}
                        onChange={() => setAudience('close_friends')}
                        className="accent-primary h-4 w-4"
                      />
                    </label>
                  </div>
                </div>

                {/* Submitting progress indicator */}
                {submitting && (
                  <div className="space-y-2.5 pt-4">
                    <div className="flex justify-between text-xs text-zinc-400 font-semibold">
                      <span>Uploading media and sharing...</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
                      <div 
                        style={{ width: `${progress}%` }}
                        className="h-full bg-primary transition-all duration-300 rounded-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Share Trigger button */}
              <div className="shrink-0 pt-4 border-t border-zinc-900">
                <button
                  onClick={handleShareStory}
                  disabled={submitting}
                  className="w-full py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold rounded-xl transition shadow-lg shadow-primary/20 flex items-center justify-center space-x-2 cursor-pointer select-none"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Posting to story...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Share to Story</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

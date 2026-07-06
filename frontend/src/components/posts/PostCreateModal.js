'use client';

import { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { 
  X, 
  Image as ImageIcon, 
  MapPin, 
  Globe, 
  Users, 
  Lock, 
  ArrowLeft, 
  ArrowRight, 
  Crop, 
  AlertCircle, 
  Check 
} from 'lucide-react';
import api from '@/services/api';
import useUIStore from '@/store/useUIStore';
import MentionDropdown from './MentionDropdown';

// Helper to center the initial crop
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

export default function PostCreateModal() {
  const { isPostCreateOpen, closePostCreate } = useUIStore();
  const [step, setStep] = useState(1); // 1: Media Selection, 2: Edit/Reorder, 3: Details
  
  // Files states
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of { file, preview, id }
  
  // Cropper states
  const [croppingIndex, setCroppingIndex] = useState(null); // Index of file being cropped
  const [crop, setCrop] = useState(null);
  const [completedCrop, setCompletedCrop] = useState(null);
  const cropperImgRef = useRef(null);

  // Details states
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState('public');
  
  // Hashtag suggestions states
  const [hashtagQuery, setHashtagQuery] = useState('');
  const [hashtagSuggestions, setHashtagSuggestions] = useState([]);
  const [showHashtagDropdown, setShowHashtagDropdown] = useState(false);
  const [hashtagPosition, setHashtagPosition] = useState(0);

  // Mention suggestions states
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionPosition, setMentionPosition] = useState(0);

  // Upload/Progress states
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const contentRef = useRef(null);

  // Reset modal state on open/close
  useEffect(() => {
    if (isPostCreateOpen) {
      setStep(1);
      setSelectedFiles([]);
      setCroppingIndex(null);
      setContent('');
      setLocation('');
      setPrivacy('public');
      setError('');
      setUploadProgress(0);
      setUploading(false);
    }
  }, [isPostCreateOpen]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isPostCreateOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isPostCreateOpen]);

  // Debounced Hashtag Search check
  useEffect(() => {
    if (!hashtagQuery) {
      setHashtagSuggestions([]);
      setShowHashtagDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/hashtags/search/?q=${hashtagQuery}`);
        setHashtagSuggestions(res.data || []);
        setShowHashtagDropdown(res.data?.length > 0);
      } catch (err) {
        setHashtagSuggestions([]);
        setShowHashtagDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [hashtagQuery]);



  // React Dropzone configuration (Step 1)
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': [],
      'video/*': []
    },
    maxFiles: 10,
    onDrop: (acceptedFiles) => {
      const remainingCount = 10 - selectedFiles.length;
      const filesToProcess = acceptedFiles.slice(0, remainingCount);

      const mapped = filesToProcess.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        id: Math.random().toString(36).substring(7),
        type: file.type.startsWith('video') ? 'video' : 'image'
      }));

      setSelectedFiles((prev) => [...prev, ...mapped]);
      if (mapped.length > 0) {
        setStep(2);
      }
    }
  });

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
    if (selectedFiles.length <= 1) {
      setStep(1);
    }
  };

  const handleMoveFile = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= selectedFiles.length) return;
    setSelectedFiles((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  // Canvas Image Cropping execution
  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerAspectCrop(width, height, 1); // 1:1 square crop default
    setCrop(initialCrop);
    cropperImgRef.current = e.currentTarget;
  };

  const applyCrop = async () => {
    if (!completedCrop || !cropperImgRef.current || croppingIndex === null) return;
    const image = cropperImgRef.current;
    const targetFile = selectedFiles[croppingIndex];

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
      blob.name = targetFile.file.name;
      const croppedFile = new File([blob], targetFile.file.name, { type: 'image/jpeg' });
      
      setSelectedFiles((prev) => {
        const copy = [...prev];
        URL.revokeObjectURL(copy[croppingIndex].preview);
        copy[croppingIndex] = {
          ...copy[croppingIndex],
          file: croppedFile,
          preview: URL.createObjectURL(croppedFile)
        };
        return copy;
      });

      setCroppingIndex(null);
      setCompletedCrop(null);
    }, 'image/jpeg');
  };

  // Text details content watcher for hashtags suggestions and mentions
  const handleContentChange = (e) => {
    const val = e.target.value;
    if (val.length > 2200) return;
    setContent(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);

    // Hashtag suggestion trigger check
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
    if (lastHashIndex !== -1 && lastHashIndex >= textBeforeCursor.lastIndexOf(' ')) {
      const charBeforeHash = lastHashIndex > 0 ? textBeforeCursor[lastHashIndex - 1] : '';
      if (charBeforeHash === '' || /\s/.test(charBeforeHash)) {
        const queryText = textBeforeCursor.slice(lastHashIndex + 1);
        if (!queryText.includes(' ')) {
          setHashtagQuery(queryText);
          setHashtagPosition(lastHashIndex);
          setShowHashtagDropdown(true);
          setShowMentionDropdown(false);
          setMentionQuery('');
          return;
        }
      }
    }

    // Mention suggestion trigger check
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex >= textBeforeCursor.lastIndexOf(' ')) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : '';
      if (charBeforeAt === '' || /\s/.test(charBeforeAt)) {
        const queryText = textBeforeCursor.slice(lastAtIndex + 1);
        if (!queryText.includes(' ')) {
          setMentionQuery(queryText);
          setMentionPosition(lastAtIndex);
          setShowMentionDropdown(true);
          setShowHashtagDropdown(false);
          setHashtagQuery('');
          return;
        }
      }
    }

    setShowHashtagDropdown(false);
    setHashtagQuery('');
    setShowMentionDropdown(false);
    setMentionQuery('');
  };

  const handleSelectHashtag = (hashtag) => {
    const textBeforeHash = content.slice(0, hashtagPosition);
    const textAfterCursor = content.slice(contentRef.current.selectionStart);
    const newContent = `${textBeforeHash}#${hashtag} ${textAfterCursor}`;
    setContent(newContent);
    setShowHashtagDropdown(false);
    setHashtagQuery('');
    contentRef.current.focus();
  };

  // Multi-step form save/upload submission
  const handleSubmitPost = async () => {
    setUploading(true);
    setError('');

    let uploadedMedia = [];

    // Step 3.1: Upload files to Cloudinary if media exists
    if (selectedFiles.length > 0) {
      const formData = new FormData();
      selectedFiles.forEach((item) => {
        formData.append('files', item.file);
      });

      try {
        const uploadRes = await api.post('/posts/upload-media/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        });
        uploadedMedia = uploadRes.data;
      } catch (err) {
        setError('Failed to upload media. Please try again.');
        setUploading(false);
        return;
      }
    }

    // Step 3.2: Create database post entry
    try {
      await api.post('/posts/', {
        content,
        privacy,
        media: uploadedMedia.map((m, index) => ({
          media_url: m.media_url,
          media_type: m.media_type,
          public_id: m.public_id,
          thumbnail_url: m.thumbnail_url,
          order: index
        }))
      });

      setToast({ message: 'Post shared successfully!', type: 'success' });
      setTimeout(() => {
        setToast(null);
        closePostCreate();
        // Force refresh feed on success
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.content?.[0] || 'Failed to publish post.');
      setUploading(false);
    }
  };

  if (!isPostCreateOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-emerald-500 text-white rounded-xl shadow-lg flex items-center space-x-2 text-sm font-semibold animate-bounce">
          <Check className="h-5 w-5" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main modal card container */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
        {/* Navigation / Header */}
        <div className="px-6 py-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {step > 1 && !uploading && (
              <button 
                onClick={() => setStep((prev) => prev - 1)}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 cursor-pointer"
                aria-label="Go Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50">
              {step === 1 ? 'Create new post' : step === 2 ? 'Edit / Reorder' : 'Create details'}
            </h2>
          </div>
          {!uploading && (
            <button 
              onClick={closePostCreate}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 cursor-pointer"
              aria-label="Close Modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Dynamic step body pages */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[250px]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-500 text-sm rounded-xl flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            /* STEP 1: Media drop selection zone */
            <div 
              {...getRootProps()} 
              className="h-64 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer p-6 hover:border-primary/50 transition-colors bg-zinc-50/50 dark:bg-zinc-950/20"
            >
              <input {...getInputProps()} />
              <ImageIcon className="h-12 w-12 text-zinc-400 mb-3 animate-pulse" />
              <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">Drag images or videos here</p>
              <p className="text-xs text-zinc-500 mt-1">Select up to 10 files</p>
            </div>
          )}

          {step === 2 && (
            /* STEP 2: Reordering and Canvas crop adjustments */
            <div className="space-y-6">
              {croppingIndex !== null ? (
                /* Crop Modal view mode overlay */
                <div className="space-y-4">
                  <div className="max-h-[50vh] overflow-hidden flex items-center justify-center bg-black rounded-xl relative">
                    <ReactCrop 
                      crop={crop} 
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={1}
                    >
                      <img 
                        src={selectedFiles[croppingIndex].preview} 
                        alt="To Crop"
                        onLoad={onImageLoad}
                        className="max-h-[45vh] object-contain"
                      />
                    </ReactCrop>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button 
                      onClick={() => setCroppingIndex(null)}
                      className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={applyCrop}
                      className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold cursor-pointer"
                    >
                      Apply Crop
                    </button>
                  </div>
                </div>
              ) : (
                /* Thumbnails grid containing order actions */
                <div className="grid grid-cols-2 gap-4">
                  {selectedFiles.map((item, index) => (
                    <div 
                      key={item.id}
                      className="aspect-square rounded-2xl bg-zinc-100 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 relative group overflow-hidden"
                    >
                      {item.type === 'video' ? (
                        <video src={item.preview} className="w-full h-full object-cover" />
                      ) : (
                        <img src={item.preview} alt="Preview" className="w-full h-full object-cover" />
                      )}

                      {/* Action buttons footer for index order movement */}
                      <div className="absolute inset-0 bg-black/40 flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleRemoveFile(index)}
                          className="self-end p-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                          aria-label="Remove item"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="flex justify-between items-center w-full mt-auto">
                          <button 
                            disabled={index === 0}
                            onClick={() => handleMoveFile(index, -1)}
                            className="p-1 bg-white/20 hover:bg-white/40 disabled:opacity-30 text-white rounded-lg transition-colors cursor-pointer"
                            aria-label="Move left"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          
                          {item.type === 'image' && (
                            <button
                              onClick={() => setCroppingIndex(index)}
                              className="p-1 bg-white/20 hover:bg-white/40 text-white rounded-lg transition-colors cursor-pointer"
                              aria-label="Crop image"
                            >
                              <Crop className="h-4 w-4" />
                            </button>
                          )}

                          <button 
                            disabled={index === selectedFiles.length - 1}
                            onClick={() => handleMoveFile(index, 1)}
                            className="p-1 bg-white/20 hover:bg-white/40 disabled:opacity-30 text-white rounded-lg transition-colors cursor-pointer"
                            aria-label="Move right"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Select more files grid box card */}
                  {selectedFiles.length < 10 && (
                    <div 
                      {...getRootProps()} 
                      className="aspect-square border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-950/20 transition-colors"
                    >
                      <input {...getInputProps()} />
                      <ImageIcon className="h-6 w-6 text-zinc-400" />
                      <span className="text-xs font-bold mt-1 text-zinc-500">Add More</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            /* STEP 3: Details editors */
            <div className="space-y-4 relative">
              {/* Text editor and counters */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-zinc-500">
                  <span className="font-bold">Caption Details</span>
                  <span>{content.length} / 2200</span>
                </div>
                <textarea
                  ref={contentRef}
                  value={content}
                  onChange={handleContentChange}
                  placeholder="Write a caption... Use #hashtags to tag topics!"
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-sm text-zinc-900 dark:text-zinc-50 transition-all resize-none"
                />
              </div>

              {/* Debounced hashtag suggest lists absolute cards */}
              {showHashtagDropdown && (
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg">
                  {hashtagSuggestions.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectHashtag(item.name)}
                      className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      #{item.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Debounced mention suggest lists absolute cards */}
              {showMentionDropdown && (
                <MentionDropdown
                  query={mentionQuery}
                  onSelect={(username) => {
                    const textBeforeAt = content.slice(0, mentionPosition);
                    const textAfterCursor = contentRef.current ? content.slice(contentRef.current.selectionStart) : '';
                    const newContent = `${textBeforeAt}@${username} ${textAfterCursor}`;
                    setContent(newContent);
                    setShowMentionDropdown(false);
                    setMentionQuery('');
                    setTimeout(() => {
                      if (contentRef.current) {
                        contentRef.current.focus();
                      }
                    }, 50);
                  }}
                  onClose={() => {
                    setShowMentionDropdown(false);
                    setMentionQuery('');
                  }}
                />
              )}

              {/* Location Tag input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500">Tag Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Add location..."
                    className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all"
                  />
                </div>
              </div>

              {/* Privacy settings */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500">Privacy Settings</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'public', label: 'Public', icon: Globe },
                    { id: 'followers', label: 'Followers', icon: Users },
                    { id: 'private', label: 'Private', icon: Lock }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = privacy === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPrivacy(item.id)}
                        className={`flex items-center justify-center space-x-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-primary text-primary bg-primary/5' 
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-550 hover:bg-zinc-100 dark:hover:bg-zinc-800/40'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions / upload progress displays */}
        <div className="px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
          {uploading ? (
            /* Upload progress bar tracker */
            <div className="space-y-2 py-2">
              <div className="flex justify-between items-center text-xs font-bold text-zinc-500">
                <span>Uploading media files...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            /* Next/Submit modal button controls */
            <div className="flex justify-between items-center">
              <div>
                {step === 1 && (
                  <span className="text-xs text-zinc-500 font-semibold">Select media to begin</span>
                )}
                {step > 1 && (
                  <span className="text-xs text-zinc-500 font-semibold">{selectedFiles.length} files selected</span>
                )}
              </div>
              
              <div className="flex space-x-2">
                {step === 2 && (
                  <button
                    onClick={() => setStep(3)}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl text-sm shadow-md shadow-primary/10 transition-colors cursor-pointer select-none"
                  >
                    Next Step
                  </button>
                )}
                
                {step === 3 && (
                  <button
                    onClick={handleSubmitPost}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl text-sm shadow-md shadow-primary/10 transition-colors cursor-pointer select-none"
                  >
                    Share Post
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

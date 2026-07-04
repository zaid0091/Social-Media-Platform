'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useDropzone } from 'react-dropzone';
import { Camera, Image as ImageIcon, AlertCircle, Check, Shield, Save } from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';

const profileSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores are allowed'),
  full_name: z.string().min(1, 'Full name is required'),
  bio: z.string().max(150, 'Bio must be at most 150 characters').optional().or(z.literal('')),
  website: z.string().optional().refine((val) => {
    if (!val) return true;
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  }, 'Must be a valid URL (e.g. https://example.com)'),
  location: z.string().optional().or(z.literal('')),
  date_of_birth: z.string().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  is_private: z.boolean().optional(),
});

export default function EditProfilePage() {
  const { user, updateUser, checkAuth } = useAuthStore();
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState('');
  const [coverPhotoFile, setCoverPhotoFile] = useState(null);
  const [coverPhotoPreview, setCoverPhotoPreview] = useState('');

  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, message: '' });
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const usernameTimer = useRef(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: '',
      full_name: '',
      bio: '',
      website: '',
      location: '',
      date_of_birth: '',
      gender: '',
      is_private: false,
    }
  });

  const watchedUsername = watch('username');
  const watchedBio = watch('bio') || '';

  // Load initial user details
  useEffect(() => {
    if (user) {
      setValue('username', user.username || '');
      setValue('full_name', user.full_name || '');
      setValue('bio', user.bio || '');
      setValue('website', user.website || '');
      setValue('location', user.location || '');
      setValue('date_of_birth', user.date_of_birth || '');
      setValue('gender', user.gender || '');
      setValue('is_private', !!user.is_private);

      if (user.profile_picture) setProfilePicPreview(user.profile_picture);
      if (user.cover_photo) setCoverPhotoPreview(user.cover_photo);
    }
  }, [user, setValue]);

  // Alert on unsaved changes when closing tab or reloading
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Debounced username availability checks
  useEffect(() => {
    if (!watchedUsername) return;
    if (user && watchedUsername.toLowerCase() === user.username.toLowerCase()) {
      setUsernameStatus({ checking: false, available: true, message: '' });
      return;
    }

    if (usernameTimer.current) clearTimeout(usernameTimer.current);

    setUsernameStatus({ checking: true, available: null, message: 'Checking availability...' });

    usernameTimer.current = setTimeout(async () => {
      // Validate local schema rules before calling backend
      if (watchedUsername.length < 3 || watchedUsername.length > 30 || !/^[a-zA-Z0-9_]+$/.test(watchedUsername)) {
        setUsernameStatus({ checking: false, available: false, message: 'Invalid username format' });
        return;
      }

      try {
        const res = await api.get(`/users/search/?q=${watchedUsername}`);
        // Exclude current user and check exact match conflicts
        const exists = res.data.some(
          (u) => u.username.toLowerCase() === watchedUsername.toLowerCase()
        );

        if (exists) {
          setUsernameStatus({ checking: false, available: false, message: 'Username is already taken' });
        } else {
          setUsernameStatus({ checking: false, available: true, message: 'Username is available' });
        }
      } catch (err) {
        setUsernameStatus({ checking: false, available: null, message: 'Failed to verify username' });
      }
    }, 500);

    return () => clearTimeout(usernameTimer.current);
  }, [watchedUsername, user]);

  // Profile Picture Dropzone
  const { getRootProps: getProfileProps, getInputProps: getProfileInputProps } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setProfilePicFile(file);
        setProfilePicPreview(URL.createObjectURL(file));
        setIsDirty(true);
      }
    }
  });

  // Cover Photo Dropzone
  const { getRootProps: getCoverProps, getInputProps: getCoverInputProps } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setCoverPhotoFile(file);
        setCoverPhotoPreview(URL.createObjectURL(file));
        setIsDirty(true);
      }
    }
  });

  const onSubmit = async (data) => {
    // If username availability checks failed, block save
    if (usernameStatus.available === false) {
      setError('username', { type: 'manual', message: 'Username is not available.' });
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    
    // Append textual fields
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key]);
      }
    });

    // Append files if dropped
    if (profilePicFile) {
      formData.append('profile_picture', profilePicFile);
    }
    if (coverPhotoFile) {
      formData.append('cover_photo', coverPhotoFile);
    }

    try {
      const response = await api.patch('/users/profile/', formData);
      updateUser(response.data);
      setIsDirty(false);
      
      setToast({ message: 'Profile updated successfully!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData && typeof errorData === 'object') {
        Object.keys(errorData).forEach((field) => {
          setError(field, {
            type: 'server',
            message: Array.isArray(errorData[field]) ? errorData[field][0] : errorData[field]
          });
        });
      } else {
        setToast({ message: 'Failed to update profile. Please try again.', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFieldChange = () => {
    if (!isDirty) setIsDirty(true);
  };

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* 1. Header with floating Toast Alerts */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Edit Profile</h1>
      </header>

      {/* Floating toast alert notifications */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center space-x-2 text-sm font-semibold animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Settings Form Scrollable area */}
      <form 
        onChange={handleFieldChange}
        onSubmit={handleSubmit(onSubmit)}
        className="flex-1 p-6 space-y-8"
      >
        {/* Cover Photo Dragzone upload */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-700 dark:text-zinc-350">Cover Photo</label>
          <div 
            {...getCoverProps()} 
            className="h-36 sm:h-44 w-full rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 relative bg-zinc-50 dark:bg-zinc-950 overflow-hidden cursor-pointer hover:border-primary/50 transition-all flex items-center justify-center group"
          >
            <input {...getCoverInputProps()} />
            {coverPhotoPreview ? (
              <>
                <img src={coverPhotoPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-8 w-8 text-white animate-pulse" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center space-y-1 text-zinc-400">
                <ImageIcon className="h-8 w-8" />
                <span className="text-xs font-semibold">Drag & drop cover photo here, or click</span>
              </div>
            )}
          </div>
        </div>

        {/* Profile Picture Dragzone Upload */}
        <div className="space-y-2 relative">
          <label className="text-sm font-bold text-zinc-700 dark:text-zinc-350">Profile Picture</label>
          <div className="flex items-center space-x-6">
            <div 
              {...getProfileProps()} 
              className="h-24 w-24 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-800 relative bg-zinc-50 dark:bg-zinc-950 overflow-hidden cursor-pointer hover:border-primary/50 transition-all flex items-center justify-center group shrink-0"
            >
              <input {...getProfileInputProps()} />
              {profilePicPreview ? (
                <>
                  <img src={profilePicPreview} alt="Profile Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                </>
              ) : (
                <Camera className="h-8 w-8 text-zinc-400" />
              )}
            </div>
            <div className="flex flex-col text-xs text-zinc-500 space-y-1">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">Drag or click to upload new photo</span>
              <span>Supports JPG, PNG, WEBP. Max size 10MB.</span>
            </div>
          </div>
        </div>

        {/* Form Input grids */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-350">Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              {...register('full_name')}
              className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
                errors.full_name ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
              }`}
            />
            {errors.full_name && (
              <p className="text-xs text-red-500 font-medium">{errors.full_name.message}</p>
            )}
          </div>

          {/* Username (with debounced checker feedback) */}
          <div className="space-y-1">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-350">Username</label>
            <div className="relative">
              <input
                type="text"
                placeholder="username"
                {...register('username')}
                className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
                  errors.username ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
                }`}
              />
            </div>
            
            {/* Real-time username verification text check */}
            {usernameStatus.message && (
              <p className={`text-xs font-semibold px-1 ${
                usernameStatus.available ? 'text-emerald-500' : usernameStatus.available === false ? 'text-red-500' : 'text-zinc-450'
              }`}>
                {usernameStatus.message}
              </p>
            )}
            {errors.username && (
              <p className="text-xs text-red-500 font-medium">{errors.username.message}</p>
            )}
          </div>

          {/* Website */}
          <div className="space-y-1">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-350">Website</label>
            <input
              type="text"
              placeholder="https://example.com"
              {...register('website')}
              className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
                errors.website ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
              }`}
            />
            {errors.website && (
              <p className="text-xs text-red-500 font-medium">{errors.website.message}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-1">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-350">Location</label>
            <input
              type="text"
              placeholder="San Francisco, CA"
              {...register('location')}
              className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
                errors.location ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
              }`}
            />
            {errors.location && (
              <p className="text-xs text-red-500 font-medium">{errors.location.message}</p>
            )}
          </div>

          {/* Date of Birth */}
          <div className="space-y-1">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-350">Date of Birth</label>
            <input
              type="date"
              {...register('date_of_birth')}
              className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
                errors.date_of_birth ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
              }`}
            />
            {errors.date_of_birth && (
              <p className="text-xs text-red-500 font-medium">{errors.date_of_birth.message}</p>
            )}
          </div>

          {/* Gender Selector */}
          <div className="space-y-1">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-350">Gender</label>
            <select
              {...register('gender')}
              className={`w-full px-4 py-3 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
                errors.gender ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="nonbinary">Non-binary</option>
              <option value="custom">Custom / Other</option>
              <option value="none">Prefer not to say</option>
            </select>
            {errors.gender && (
              <p className="text-xs text-red-500 font-medium">{errors.gender.message}</p>
            )}
          </div>
        </div>

        {/* Bio (character counter) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-sm font-bold text-zinc-700 dark:text-zinc-355">
            <label>Bio</label>
            <span className={`text-xs ${watchedBio.length > 150 ? 'text-red-500' : 'text-zinc-500'}`}>
              {150 - watchedBio.length} characters remaining
            </span>
          </div>
          <textarea
            placeholder="Tell us about yourself..."
            rows={4}
            {...register('bio')}
            className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all resize-none ${
              errors.bio ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          />
          {errors.bio && (
            <p className="text-xs text-red-500 font-medium">{errors.bio.message}</p>
          )}
        </div>

        {/* Account Privacy Toggle Card */}
        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="h-6 w-6 text-zinc-500 shrink-0" />
            <div className="flex flex-col">
              <span className="font-bold text-sm leading-tight text-zinc-800 dark:text-zinc-205">Private Account</span>
              <span className="text-xs text-zinc-500">Only approved followers can view your feed and stories.</span>
            </div>
          </div>
          <input
            type="checkbox"
            id="is_private"
            {...register('is_private')}
            className="h-5 w-5 rounded border-zinc-300 text-primary focus:ring-primary dark:border-zinc-850 dark:bg-zinc-950 cursor-pointer"
          />
        </div>

        {/* Submit Actions Bar */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl font-bold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm select-none cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={submitting}
            className={`px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center space-x-2 text-sm select-none cursor-pointer ${
              submitting ? 'opacity-80 cursor-wait' : ''
            }`}
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import OptimizedImage from '../ui/OptimizedImage';

export default function VideoPlayer({ src, poster }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  const [hasInteracted, setHasInteracted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  const controlsTimeout = useRef(null);

  const triggerShowControls = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    
    if (isPlaying) {
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    if (hasInteracted) {
      triggerShowControls();
    }
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, [isPlaying, hasInteracted]);

  // Autoplay video once user has clicked to play
  useEffect(() => {
    if (hasInteracted && isPlaying && videoRef.current) {
      videoRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [hasInteracted, isPlaying]);

  const togglePlay = (e) => {
    if (e) e.stopPropagation();
    
    if (!hasInteracted) {
      setHasInteracted(true);
      setIsPlaying(true);
      return;
    }

    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const seekValue = parseFloat(e.target.value);
    videoRef.current.currentTime = seekValue;
    setCurrentTime(seekValue);
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const value = parseFloat(e.target.value);
    videoRef.current.volume = value;
    setVolume(value);
    if (value === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
    } else {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const toggleFullscreen = (e) => {
    e.stopPropagation();
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '0:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={hasInteracted ? triggerShowControls : undefined}
      onClick={togglePlay}
      className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden group select-none cursor-pointer"
    >
      {!hasInteracted ? (
        // Lazy layout thumbnail preview
        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
          {poster ? (
            <OptimizedImage 
              src={poster} 
              alt="Video Thumbnail" 
              fill 
              priority={false}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-550 text-xs font-semibold">
              Video Clip
            </div>
          )}
          {/* Pulsing Play icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
            <div className="h-16 w-16 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/20 transition-transform scale-100 hover:scale-105">
              <Play className="h-7 w-7 text-white fill-white ml-1" />
            </div>
          </div>
        </div>
      ) : (
        // Actual dynamic video clip element once interacted
        <>
          <video
            ref={videoRef}
            src={src}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onClick={togglePlay}
            className="max-w-full max-h-full object-contain"
            playsInline
            autoPlay
          />

          {/* Pause giant center overlay toggle */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="h-16 w-16 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/20">
                <Play className="h-7 w-7 text-white fill-white ml-1" />
              </div>
            </div>
          )}

          {/* Dynamic Custom Controls Overlay */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex flex-col space-y-3 transition-opacity duration-300 z-10 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Progress seek timeline slider */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-primary focus:outline-none transition-all hover:h-1.5"
              style={{
                background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${
                  (currentTime / (duration || 1)) * 100
                }%, rgba(255,255,255,0.3) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.3) 100%)`
              }}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={togglePlay}
                  className="text-white hover:text-primary transition-colors cursor-pointer"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
                </button>

                <div className="flex items-center space-x-2 group/vol">
                  <button 
                    onClick={toggleMute}
                    className="text-white hover:text-primary transition-colors cursor-pointer"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-primary focus:outline-none transition-all"
                  />
                </div>

                <span className="text-xs text-white/90 font-medium">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <button 
                onClick={toggleFullscreen}
                className="text-white hover:text-primary transition-colors cursor-pointer"
                aria-label="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

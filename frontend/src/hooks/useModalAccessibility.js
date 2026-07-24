'use client';

import { useEffect, useRef } from 'react';

/**
 * A custom React hook that provides accessibility configurations for modals/dialogs:
 * 1. Focus trapping inside the modal.
 * 2. Escape key press listeners to trigger dismissal/onClose.
 * 3. Focus restoration to the trigger element when the modal is closed.
 * 
 * @param {boolean} isOpen Whether the modal is currently open.
 * @param {function} onClose The callback function to close the modal.
 * @returns {React.RefObject} The ref that should be attached to the inner modal box element.
 */
export default function useModalAccessibility(isOpen, onClose) {
  const modalRef = useRef(null);
  const triggerElementRef = useRef(null);

  // Capture active trigger element on mount/open, restore on unmount/close
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isOpen) {
      // Remember what had focus before the modal opened
      triggerElementRef.current = document.activeElement;
    } else {
      // When modal closes, restore focus
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
        // Use a minor timeout to avoid conflicts with route changes or page updates
        const el = triggerElementRef.current;
        setTimeout(() => el.focus(), 50);
      }
    }
  }, [isOpen]);

  // Trap focus inside modal
  useEffect(() => {
    if (!isOpen) return;

    const modalElement = modalRef.current;
    if (!modalElement) return;

    const focusableSelectors = [
      'a[href]',
      'area[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'button:not([disabled])',
      'iframe',
      'object',
      'embed',
      '[tabindex="0"]',
      '[contenteditable]'
    ].join(',');

    // Focus the first focusable element inside the modal card when it opens
    const focusableElements = modalElement.querySelectorAll(focusableSelectors);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      // Fallback to modal box container itself
      modalElement.setAttribute('tabindex', '-1');
      modalElement.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      const elements = modalElement.querySelectorAll(focusableSelectors);
      if (elements.length === 0) {
        e.preventDefault();
        return;
      }

      const firstEl = elements[0];
      const lastEl = elements[elements.length - 1];

      if (e.shiftKey) {
        // Tab backwards: Wrap from first element to last element
        if (document.activeElement === firstEl) {
          lastEl.focus();
          e.preventDefault();
        }
      } else {
        // Tab forwards: Wrap from last element to first element
        if (document.activeElement === lastEl) {
          firstEl.focus();
          e.preventDefault();
        }
      }
    };

    modalElement.addEventListener('keydown', handleKeyDown);
    return () => {
      modalElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Dismiss modal on Escape key press
  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return modalRef;
}

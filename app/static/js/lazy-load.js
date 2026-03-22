/* ============================================
   IMAGE LAZY LOADING SYSTEM
   Love-Is-Food Kitchen Assistant
   ============================================
   
   Progressive image loading with Intersection Observer
   Usage: Add data-src attribute to images
   ============================================ */

(function() {
  'use strict';

  // Configuration
  const config = {
    rootMargin: '50px 0px',  // Start loading 50px before entering viewport
    threshold: 0.01,
    placeholderColor: 'var(--color-charcoal-200)',
    transitionDuration: 400,  // ms
    retryAttempts: 3,
    retryDelay: 1000  // ms
  };

  // Create placeholder blur effect
  function createPlaceholder(img) {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder';
    placeholder.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: ${config.placeholderColor};
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Cdefs%3E%3ClinearGradient id='shimmer' x1='0' x2='1' y1='0' y2='0'%3E%3Cstop offset='0' stop-color='%23f7fafc'/%3E%3Cstop offset='0.5' stop-color='%23e2e8f0'/%3E%3Cstop offset='1' stop-color='%23f7fafc'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='300' fill='url(%23shimmer)'%3E%3Canimate attributeName='x' from='-400' to='400' dur='1.5s' repeatCount='indefinite'/%3E%3C/rect%3E%3C/svg%3E");
      background-size: cover;
      animation: shimmer 1.5s infinite;
      z-index: 1;
    `;
    return placeholder;
  }

  // Shimmer animation keyframes
  const shimmerStyle = document.createElement('style');
  shimmerStyle.textContent = `
    @keyframes shimmer {
      0% { opacity: 0.6; }
      50% { opacity: 0.8; }
      100% { opacity: 0.6; }
    }
    
    .lazy-image-container {
      position: relative;
      overflow: hidden;
      background-color: var(--color-charcoal-100);
    }
    
    .lazy-image {
      opacity: 0;
      transition: opacity ${config.transitionDuration}ms ease-in-out;
    }
    
    .lazy-image.loaded {
      opacity: 1;
    }
    
    .lazy-image.error {
      opacity: 0.3;
    }
    
    .image-placeholder {
      pointer-events: none;
    }
    
    .image-error-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 2rem;
      color: var(--color-text-muted);
      z-index: 2;
    }
  `;
  document.head.appendChild(shimmerStyle);

  // Preload image with retry logic
  function preloadImage(src, attempts = 0) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      
      img.onerror = () => {
        if (attempts < config.retryAttempts) {
          console.warn(`Image load failed, retrying... (${attempts + 1}/${config.retryAttempts})`);
          setTimeout(() => {
            preloadImage(src, attempts + 1).then(resolve).catch(reject);
          }, config.retryDelay);
        } else {
          reject(new Error(`Failed to load image after ${config.retryAttempts} attempts`));
        }
      };
      
      img.src = src;
    });
  }

  // Load image
  async function loadImage(img) {
    const src = img.dataset.src || img.dataset.lazySrc;
    
    if (!src || img.classList.contains('loaded') || img.classList.contains('loading')) {
      return;
    }

    // Mark as loading
    img.classList.add('loading');

    // Get or create container
    let container = img.parentElement;
    if (!container.classList.contains('lazy-image-container')) {
      container = document.createElement('div');
      container.className = 'lazy-image-container';
      img.parentNode.insertBefore(container, img);
      container.appendChild(img);
    }

    // Add placeholder if not exists
    let placeholder = container.querySelector('.image-placeholder');
    if (!placeholder) {
      placeholder = createPlaceholder(img);
      container.insertBefore(placeholder, img);
    }

    try {
      // Preload the image
      await preloadImage(src);
      
      // Set the src
      img.src = src;
      
      // Wait for the actual element to load
      if (!img.complete) {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
      }

      // Remove loading state
      img.classList.remove('loading');
      img.classList.add('loaded');
      
      // Fade out placeholder
      if (placeholder) {
        placeholder.style.transition = `opacity ${config.transitionDuration}ms ease-out`;
        placeholder.style.opacity = '0';
        
        setTimeout(() => {
          if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.removeChild(placeholder);
          }
        }, config.transitionDuration);
      }

      // Remove data attributes
      delete img.dataset.src;
      delete img.dataset.lazySrc;

      // Dispatch custom event
      img.dispatchEvent(new CustomEvent('lazyloaded', {
        bubbles: true,
        detail: { src }
      }));

    } catch (error) {
      console.error('Failed to load image:', src, error);
      
      // Mark as error
      img.classList.remove('loading');
      img.classList.add('error');
      
      // Show error icon
      const errorIcon = document.createElement('div');
      errorIcon.className = 'image-error-icon';
      errorIcon.innerHTML = '<i class="fas fa-image"></i>';
      container.appendChild(errorIcon);

      // Remove placeholder
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
      }

      // Dispatch error event
      img.dispatchEvent(new CustomEvent('lazyerror', {
        bubbles: true,
        detail: { src, error }
      }));
    }
  }

  // Intersection Observer callback
  function handleIntersection(entries, observer) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        loadImage(img);
        observer.unobserve(img);
      }
    });
  }

  // Initialize lazy loading
  function initLazyLoad() {
    // Check for Intersection Observer support
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported, loading all images immediately');
      document.querySelectorAll('[data-src], [data-lazy-src]').forEach(loadImage);
      return;
    }

    // Create observer
    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: config.rootMargin,
      threshold: config.threshold
    });

    // Observe all lazy images
    const lazyImages = document.querySelectorAll('[data-src], [data-lazy-src]');
    lazyImages.forEach(img => {
      // Add lazy-image class
      img.classList.add('lazy-image');
      
      // Observe
      observer.observe(img);
    });

    // Store observer globally for dynamic content
    window.lazyLoadObserver = observer;
  }

  // Public API
  window.LazyLoad = {
    // Initialize lazy loading
    init: initLazyLoad,
    
    // Manually load an image
    load: loadImage,
    
    // Observe new images (for dynamic content)
    observe: function(element) {
      if (!window.lazyLoadObserver) {
        console.warn('LazyLoad not initialized');
        return;
      }
      
      const images = element.querySelectorAll ? 
        element.querySelectorAll('[data-src], [data-lazy-src]') : 
        [element];
        
      images.forEach(img => {
        img.classList.add('lazy-image');
        window.lazyLoadObserver.observe(img);
      });
    },
    
    // Force load all images
    loadAll: function() {
      const lazyImages = document.querySelectorAll('[data-src], [data-lazy-src]');
      lazyImages.forEach(loadImage);
    },
    
    // Update configuration
    config: function(newConfig) {
      Object.assign(config, newConfig);
    }
  };

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyLoad);
  } else {
    initLazyLoad();
  }

  // Re-observe on dynamic content (mutation observer)
  const mutationObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {  // Element node
            // Check if the node itself is a lazy image
            if (node.dataset && (node.dataset.src || node.dataset.lazySrc)) {
              window.LazyLoad.observe(node);
            }
            // Check for lazy images within the node
            const lazyImages = node.querySelectorAll?.('[data-src], [data-lazy-src]');
            if (lazyImages?.length) {
              lazyImages.forEach(img => window.LazyLoad.observe(img));
            }
          }
        });
      }
    });
  });

  // Observe document body for dynamic content
  if (document.body) {
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Log initialization
  console.log('✨ LazyLoad System Initialized');
  console.log('📦 Found images:', document.querySelectorAll('[data-src], [data-lazy-src]').length);

})();

/* ============================================
   USAGE EXAMPLES
   ============================================
   
   1. Basic Usage:
      <img data-src="/static/images/hero-cooking.jpg" alt="Cooking">
   
   2. With Specific Dimensions:
      <img data-src="/static/images/recipe.jpg" 
           width="400" height="300" 
           alt="Recipe">
   
   3. Dynamic Content:
      const img = document.createElement('img');
      img.dataset.src = '/static/images/new-recipe.jpg';
      container.appendChild(img);
      LazyLoad.observe(img);
   
   4. Force Load All:
      LazyLoad.loadAll();
   
   5. Listen to Events:
      img.addEventListener('lazyloaded', (e) => {
        console.log('Image loaded:', e.detail.src);
      });
      
      img.addEventListener('lazyerror', (e) => {
        console.error('Image failed:', e.detail.src);
      });
   
   ============================================ */

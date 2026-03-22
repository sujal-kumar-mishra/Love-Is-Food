/**
 * LOVE-IS-FOOD: UI/UX DYNAMIC ENHANCEMENTS
 * JavaScript implementation for interactive features
 * Author: GitHub Copilot
 * Last Updated: Nov 21, 2025
 */

(function() {
    'use strict';

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', function() {
        initSmoothAnimations();
        initScrollProgress();
        initHeaderScrollEffect();
        initButtonEnhancements();
        initCardEnhancements();
        initToastSystem();
        initSkeletonLoaders();
        initCounterAnimations();
        applyStaggeredAnimations();
    });

    // ===== SMOOTH ANIMATIONS =====
    function initSmoothAnimations() {
        // Add page transition class to body
        document.body.classList.add('page-transition');
        
        // Animate elements on scroll
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observe all animatable elements
        document.querySelectorAll('.premium-card, .card-glow, .sidebar-module').forEach(el => {
            observer.observe(el);
        });
    }

    // ===== SCROLL PROGRESS INDICATOR =====
    function initScrollProgress() {
        // Create progress bar if it doesn't exist
        let progressBar = document.querySelector('.scroll-progress');
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.className = 'scroll-progress';
            document.body.appendChild(progressBar);
        }

        // Update progress on scroll
        window.addEventListener('scroll', function() {
            const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (window.scrollY / windowHeight) * 100;
            progressBar.style.width = scrolled + '%';
        });
    }

    // ===== HEADER SCROLL EFFECT =====
    function initHeaderScrollEffect() {
        const header = document.querySelector('.app-header');
        if (!header) return;

        let lastScroll = 0;
        
        window.addEventListener('scroll', function() {
            const currentScroll = window.pageYOffset;
            
            if (currentScroll > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            
            lastScroll = currentScroll;
        });
    }

    // ===== BUTTON ENHANCEMENTS =====
    function initButtonEnhancements() {
        // Add ripple effect to buttons
        document.querySelectorAll('button, .btn, .tool-btn').forEach(button => {
            if (!button.classList.contains('btn-ripple')) {
                button.classList.add('btn-ripple');
            }
        });

        // Enhance primary buttons
        document.querySelectorAll('.hands-free-toggle, button[type="submit"]').forEach(btn => {
            if (!btn.classList.contains('btn-primary-enhanced')) {
                btn.classList.add('hover-scale');
            }
        });
    }

    // ===== CARD ENHANCEMENTS =====
    function initCardEnhancements() {
        // Apply glass effect to cards
        document.querySelectorAll('.sidebar-module').forEach(card => {
            card.classList.add('glass-card');
        });

        // Add hover effects to recipe/video cards
        document.querySelectorAll('.recipe-card, .video-card').forEach(card => {
            const img = card.querySelector('img');
            if (img && !img.closest('.card-image-container')) {
                // Wrap image in container for overlay effect
                const container = document.createElement('div');
                container.className = 'card-image-container';
                img.parentNode.insertBefore(container, img);
                container.appendChild(img);
                
                // Add overlay
                const overlay = document.createElement('div');
                overlay.className = 'card-image-overlay';
                container.appendChild(overlay);
            }
        });
    }

    // ===== TOAST NOTIFICATION SYSTEM =====
    const toastSystem = {
        container: null,
        
        init() {
            // Create toast container if it doesn't exist
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'toast-container';
                this.container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
                document.body.appendChild(this.container);
            }
        },
        
        show(message, type = 'info', duration = 3000) {
            this.init();
            
            const toast = document.createElement('div');
            toast.className = `toast-notification toast-${type}`;
            
            const icon = this.getIcon(type);
            toast.innerHTML = `
                <i class="fas ${icon}" style="font-size: 1.25rem;"></i>
                <span style="font-weight: 500;">${message}</span>
            `;
            
            this.container.appendChild(toast);
            
            // Auto remove
            setTimeout(() => {
                toast.style.animation = 'toastSlideIn 0.4s reverse';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, 400);
            }, duration);
        },
        
        getIcon(type) {
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                info: 'fa-info-circle',
                warning: 'fa-exclamation-triangle'
            };
            return icons[type] || icons.info;
        }
    };

    function initToastSystem() {
        // Make toast system globally available
        window.showToast = function(message, type, duration) {
            toastSystem.show(message, type, duration);
        };
        
        // Example: Show success toast on successful actions
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            return originalFetch.apply(this, args)
                .then(response => {
                    if (response.ok && response.status === 200) {
                        // Could show success toast here if needed
                    }
                    return response;
                });
        };
    }

    // ===== SKELETON LOADERS =====
    function initSkeletonLoaders() {
        // Function to create skeleton placeholder
        window.createSkeleton = function(type = 'card') {
            const skeleton = document.createElement('div');
            skeleton.className = 'premium-card';
            
            if (type === 'card') {
                skeleton.innerHTML = `
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text" style="width: 80%;"></div>
                `;
            }
            
            return skeleton;
        };
        
        // Function to replace skeleton with content
        window.replaceSkeleton = function(container, content) {
            if (container.querySelector('.skeleton')) {
                container.innerHTML = '';
                container.appendChild(content);
            }
        };
    }

    // ===== COUNTER ANIMATIONS =====
    function initCounterAnimations() {
        const animateCounter = function(element, target, duration = 2000) {
            const start = 0;
            const increment = target / (duration / 16);
            let current = start;
            
            const updateCounter = function() {
                current += increment;
                if (current < target) {
                    element.textContent = Math.floor(current);
                    requestAnimationFrame(updateCounter);
                } else {
                    element.textContent = target;
                }
            };
            
            updateCounter();
        };
        
        // Observe stat counters
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const counter = entry.target;
                    const target = parseInt(counter.dataset.target || counter.textContent);
                    if (!isNaN(target)) {
                        animateCounter(counter, target);
                        observer.unobserve(counter);
                    }
                }
            });
        }, { threshold: 0.5 });
        
        document.querySelectorAll('.stat-counter').forEach(counter => {
            observer.observe(counter);
        });
    }

    // ===== STAGGERED ANIMATIONS =====
    function applyStaggeredAnimations() {
        // Apply staggered animation to lists
        document.querySelectorAll('.quick-tools, .feature-grid').forEach(container => {
            if (!container.classList.contains('stagger-fade-in')) {
                container.classList.add('stagger-fade-in');
            }
        });
    }

    // ===== ENHANCED MIC BUTTON =====
    function enhanceMicButton() {
        const micButton = document.getElementById('mic-button');
        if (!micButton) return;
        
        // Add enhanced class
        micButton.classList.add('mic-button-enhanced');
        
        // Add wave visualizer when listening
        const createWaveVisualizer = function() {
            const visualizer = document.createElement('div');
            visualizer.className = 'wave-visualizer';
            visualizer.innerHTML = `
                <div class="wave-bar"></div>
                <div class="wave-bar"></div>
                <div class="wave-bar"></div>
                <div class="wave-bar"></div>
                <div class="wave-bar"></div>
            `;
            return visualizer;
        };
        
        // Observe mic button state changes
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    const isListening = micButton.classList.contains('listening');
                    
                    // Remove existing visualizer
                    const existingViz = micButton.querySelector('.wave-visualizer');
                    if (existingViz) {
                        existingViz.remove();
                    }
                    
                    // Add visualizer if listening
                    if (isListening && !micButton.querySelector('.wave-visualizer')) {
                        const statusDiv = micButton.nextElementSibling;
                        if (statusDiv && statusDiv.classList.contains('mic-status')) {
                            const visualizer = createWaveVisualizer();
                            statusDiv.parentNode.insertBefore(visualizer, statusDiv);
                        }
                    }
                }
            });
        });
        
        observer.observe(micButton, { attributes: true });
    }

    // Call mic enhancement
    setTimeout(enhanceMicButton, 500);

    // ===== ENHANCED FORM INPUTS =====
    function initFloatingLabels() {
        document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], textarea').forEach(input => {
            // Skip if already has floating label
            if (input.parentElement.classList.contains('floating-label-group')) return;
            
            const label = input.previousElementSibling;
            if (label && label.tagName === 'LABEL') {
                // Wrap input and label
                const wrapper = document.createElement('div');
                wrapper.className = 'floating-label-group';
                input.parentNode.insertBefore(wrapper, input);
                wrapper.appendChild(input);
                wrapper.appendChild(label);
                
                input.classList.add('floating-label-input');
                label.classList.add('floating-label');
                input.setAttribute('placeholder', ' ');
            }
        });
    }

    // Initialize floating labels after a short delay
    setTimeout(initFloatingLabels, 1000);

    // ===== FAVORITE HEART ANIMATION =====
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('favorite-btn') || 
            e.target.closest('.favorite-btn')) {
            const btn = e.target.classList.contains('favorite-btn') ? 
                        e.target : e.target.closest('.favorite-btn');
            
            const heart = btn.querySelector('i') || btn;
            heart.classList.add('favorite-heart');
            heart.classList.toggle('active');
        }
    });

    // ===== ACHIEVEMENT UNLOCK ANIMATION =====
    window.unlockAchievement = function(achievementElement) {
        if (achievementElement) {
            achievementElement.classList.add('achievement-unlock');
            
            // Show toast notification
            const achievementName = achievementElement.querySelector('.achievement-name');
            if (achievementName) {
                showToast(`🏆 Achievement Unlocked: ${achievementName.textContent}!`, 'success', 4000);
            }
        }
    };

    // ===== SMOOTH SCROLL TO TOP =====
    const createScrollToTop = function() {
        const button = document.createElement('button');
        button.className = 'scroll-to-top';
        button.innerHTML = '<i class="fas fa-arrow-up"></i>';
        button.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
            color: white;
            border: none;
            cursor: pointer;
            box-shadow: var(--shadow-orange);
            opacity: 0;
            transform: scale(0);
            transition: all var(--transition-base);
            z-index: 1000;
        `;
        
        button.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                button.style.opacity = '1';
                button.style.transform = 'scale(1)';
            } else {
                button.style.opacity = '0';
                button.style.transform = 'scale(0)';
            }
        });
        
        document.body.appendChild(button);
    };

    createScrollToTop();

    // ===== UTILITY FUNCTIONS =====
    
    // Add CSS class helpers
    window.addEnhancedClass = function(selector, className) {
        document.querySelectorAll(selector).forEach(el => {
            el.classList.add(className);
        });
    };

    // Smooth reveal animation
    window.smoothReveal = function(element, delay = 0) {
        setTimeout(() => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(30px)';
            element.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            
            requestAnimationFrame(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            });
        }, delay);
    };

    // Add enhanced progress bar
    window.createEnhancedProgress = function(percentage, container) {
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar-animated progress-with-label';
        progressBar.innerHTML = `
            <div class="progress-fill-animated" style="width: ${percentage}%"></div>
            <span class="progress-percentage">${percentage}%</span>
        `;
        
        if (container) {
            container.appendChild(progressBar);
        }
        
        return progressBar;
    };

    // ===== CONSOLE WELCOME MESSAGE =====
    console.log('%c🍳 Love-Is-Food Kitchen Assistant', 
        'font-size: 20px; font-weight: bold; background: linear-gradient(135deg, #ED8936, #68D391); padding: 10px 20px; border-radius: 8px; color: white;');
    console.log('%cUI/UX Enhancements Loaded Successfully! ✨', 
        'font-size: 14px; color: #68D391; font-weight: bold;');
    console.log('%cPhases Implemented: 1-12 | Premium Design System Active', 
        'font-size: 12px; color: #666;');

})();

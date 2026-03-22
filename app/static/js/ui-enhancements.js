/**
 * Kitchen Assistant - UI Enhancements & Animations
 * Implements smooth animations, particle effects, and modern UI interactions
 */

// ============================================
// P5.js Background Particle Effect
// ============================================
function initializeParticleBackground() {
    new p5(function(p) {
        let particles = [];
        const numParticles = 60;
        
        p.setup = function() {
            const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
            canvas.id('p5-background');
            canvas.parent(document.body);
            canvas.style('position', 'fixed');
            canvas.style('top', '0');
            canvas.style('left', '0');
            canvas.style('z-index', '-1');
            canvas.style('opacity', '0.4');
            
            // Create particles
            for (let i = 0; i < numParticles; i++) {
                particles.push({
                    x: p.random(p.width),
                    y: p.random(p.height),
                    vx: p.random(-0.5, 0.5),
                    vy: p.random(-0.5, 0.5),
                    size: p.random(2, 8),
                    opacity: p.random(0.1, 0.4),
                    color: p.random([
                        { r: 237, g: 137, b: 54 },   // Copper Orange (Primary)
                        { r: 246, g: 173, b: 85 },   // Light Orange
                        { r: 104, g: 211, b: 145 }   // Sage Green (Success)
                    ])
                });
            }
        };
        
        p.draw = function() {
            p.clear();
            
            // Draw and update particles
            particles.forEach(particle => {
                // Draw particle
                p.fill(particle.color.r, particle.color.g, particle.color.b, particle.opacity * 255);
                p.noStroke();
                p.ellipse(particle.x, particle.y, particle.size);
                
                // Update position
                particle.x += particle.vx;
                particle.y += particle.vy;
                
                // Wrap around edges
                if (particle.x < -10) particle.x = p.width + 10;
                if (particle.x > p.width + 10) particle.x = -10;
                if (particle.y < -10) particle.y = p.height + 10;
                if (particle.y > p.height + 10) particle.y = -10;
            });
        };
        
        p.windowResized = function() {
            p.resizeCanvas(p.windowWidth, p.windowHeight);
        };
    });
}

// ============================================
// Staggered Animation for Recipe Cards
// ============================================
function animateRecipeCards() {
    const cards = document.querySelectorAll('.result-card, .recipe-card');
    
    if (cards.length === 0 || typeof anime === 'undefined') return;
    
    anime({
        targets: cards,
        opacity: [0, 1],
        translateY: [30, 0],
        scale: [0.95, 1],
        delay: anime.stagger(80, {start: 100}),
        duration: 600,
        easing: 'easeOutCubic'
    });
}

// ============================================
// Voice Visualization Waveform
// ============================================
function createVoiceWaveform(container) {
    if (!container) return;
    
    const waveform = document.createElement('div');
    waveform.className = 'voice-waveform';
    waveform.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 3px;
        height: 40px;
        margin-left: 10px;
    `;
    
    // Create 5 wave bars
    for (let i = 0; i < 5; i++) {
        const bar = document.createElement('div');
        bar.className = 'voice-wave';
        waveform.appendChild(bar);
    }
    
    container.appendChild(waveform);
    return waveform;
}

// ============================================
// Typing Indicator for Chat
// ============================================
function showTypingIndicator(chatContainer) {
    if (!chatContainer) return null;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message assistant typing-message';
    typingDiv.innerHTML = `
        <div class="message-bubble">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    
    chatContainer.appendChild(typingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return typingDiv;
}

function removeTypingIndicator() {
    const typingMsg = document.querySelector('.typing-message');
    if (typingMsg) {
        typingMsg.classList.add('fade-out');
        setTimeout(() => typingMsg.remove(), 300);
    }
}

// ============================================
// Smooth Notification System
// ============================================
function showEnhancedNotification(message, type = 'success', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `smart-notification notification-${type} notification-enter`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    notification.innerHTML = `
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <span class="notification-message">${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 16px 24px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 500;
        border-left: 4px solid ${type === 'success' ? '#68D391' : type === 'error' ? '#ED8936' : '#2D3748'};
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove
    setTimeout(() => {
        notification.classList.remove('notification-enter');
        notification.classList.add('notification-exit');
        setTimeout(() => notification.remove(), 300);
    }, duration);
    
    return notification;
}

// ============================================
// Skeleton Loading for Recipe Cards
// ============================================
function createSkeletonCard() {
    const skeleton = document.createElement('div');
    skeleton.className = 'result-card skeleton-card';
    skeleton.innerHTML = `
        <div class="skeleton" style="height: 200px; border-radius: 12px 12px 0 0;"></div>
        <div style="padding: 20px;">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 60%;"></div>
        </div>
    `;
    return skeleton;
}

function showSkeletonCards(container, count = 6) {
    if (!container) return;
    
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        container.appendChild(createSkeletonCard());
    }
}

// ============================================
// Button Ripple Effect
// ============================================
function addRippleEffect(button, event) {
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        left: ${x}px;
        top: ${y}px;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
    `;
    
    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
}

// ============================================
// Smooth Scroll to Element
// ============================================
function smoothScrollTo(element, offset = 0) {
    if (!element) return;
    
    const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
    
    window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
    });
}

// ============================================
// Image Lazy Loading with Fade In
// ============================================
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('fade-in');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// ============================================
// Add Hover Sound Effects (Optional)
// ============================================
function addHoverSound(element, soundType = 'click') {
    // This would play subtle sounds on interaction
    // Placeholder for future implementation
}

// ============================================
// Parallax Scrolling Effect
// ============================================
function initParallax() {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.parallax');
        
        parallaxElements.forEach(element => {
            const speed = element.dataset.speed || 0.5;
            element.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });
}

// ============================================
// Enhanced Modal with Backdrop Blur
// ============================================
function showEnhancedModal(content, options = {}) {
    const modal = document.createElement('div');
    modal.className = 'enhanced-modal';
    modal.innerHTML = `
        <div class="modal-backdrop" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(45, 55, 72, 0.6);
            backdrop-filter: blur(8px);
            z-index: 9998;
        "></div>
        <div class="modal-content glass-effect" style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: ${options.maxWidth || '600px'};
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            z-index: 9999;
            padding: 32px;
            border-radius: 16px;
        ">
            ${content}
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on backdrop click
    modal.querySelector('.modal-backdrop').addEventListener('click', () => {
        modal.classList.add('fade-out');
        setTimeout(() => modal.remove(), 300);
    });
    
    return modal;
}

// ============================================
// Progress Bar Animation
// ============================================
function animateProgressBar(element, targetPercent, duration = 1500) {
    if (!element) return;
    
    if (typeof anime !== 'undefined') {
        anime({
            targets: element,
            width: `${targetPercent}%`,
            duration: duration,
            easing: 'easeOutCubic'
        });
    } else {
        element.style.width = `${targetPercent}%`;
    }
}

// ============================================
// Initialize All UI Enhancements
// ============================================
function initUIEnhancements() {
    console.log('🎨 Initializing UI Enhancements...');
    
    // Initialize particle background if p5.js is available
    if (typeof p5 !== 'undefined') {
        initializeParticleBackground();
    }
    
    // Animate existing recipe cards
    setTimeout(() => {
        animateRecipeCards();
    }, 100);
    
    // Initialize lazy loading
    lazyLoadImages();
    
    // Add ripple effects to buttons
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .btn, .hands-free-toggle')) {
            addRippleEffect(e.target, e);
        }
    });
    
    // Add smooth scrolling to anchors
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            smoothScrollTo(target, 100);
        });
    });
    
    // Initialize parallax if elements exist
    if (document.querySelectorAll('.parallax').length > 0) {
        initParallax();
    }
    
    console.log('✨ UI Enhancements loaded!');
}

// ============================================
// Export functions for use in other scripts
// ============================================
window.UIEnhancements = {
    animateRecipeCards,
    createVoiceWaveform,
    showTypingIndicator,
    removeTypingIndicator,
    showEnhancedNotification,
    showSkeletonCards,
    addRippleEffect,
    smoothScrollTo,
    showEnhancedModal,
    animateProgressBar
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUIEnhancements);
} else {
    initUIEnhancements();
}

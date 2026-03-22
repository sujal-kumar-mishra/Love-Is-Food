/**
 * ========================================
 * GLOBAL VOICE CONTROL SYSTEM
 * ========================================
 * 100% Hands-Free Voice Control for Kitchen Assistant
 * Works across ALL pages: Home, Recipe Detail, Video Detail, Profile
 * 
 * Features:
 * - Continuous conversation flow
 * - Context-aware commands
 * - Scrolling control
 * - Navigation control
 * - Page-specific actions
 * - Conversation persistence
 */

(function() {
    'use strict';

    // ========================================
    // SINGLETON PATTERN - PREVENT MULTIPLE INSTANCES
    // ========================================
    
    if (window.globalVoiceControl && window.globalVoiceControl.initialized) {
        console.log('⚠️ Voice control already initialized, skipping duplicate');
        return;
    }

    // ========================================
    // CONFIGURATION
    // ========================================
    
    const WAKE_WORDS = ['hey kitchen', 'kitchen assistant', 'ok kitchen'];
    const COMMAND_TIMEOUT = 2000; // 2 seconds of silence
    const COOLDOWN_PERIOD = 500; // 500ms after TTS ends
    
    // ========================================
    // GLOBAL STATE WITH SINGLETON FLAG
    // ========================================
    
    window.globalVoiceControl = {
        isActive: false,
        isListening: false,
        currentPage: detectCurrentPage(),
        conversationContext: [],
        lastCommand: null,
        scrollPosition: 0,
        initialized: true, // Singleton flag
        speechQueue: [], // Queue for managing multiple speech requests
        isSpeaking: false, // Track if currently speaking
        currentUtterance: null // Current speech utterance
    };

    // ========================================
    // SPEECH RECOGNITION SETUP
    // ========================================
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let continuousRecognition = null;
    let wakeWordDetected = false;
    let commandAccumulator = '';
    let commandTimeout = null;
    let lastSpeechTime = 0;
    
    // YouTube Player Control
    let youtubePlayer = null;
    let videoWasMutedByUs = false;
    let ytPlayerReady = false;
    
    // Step Navigation Tracking
    let currentStepNumber = 0;  // Track current instruction step being read

    if (SpeechRecognition) {
        continuousRecognition = new SpeechRecognition();
        continuousRecognition.continuous = true;
        continuousRecognition.interimResults = true;
        continuousRecognition.lang = 'en-IN';
        
        setupRecognitionHandlers();
    }
    
    // ========================================
    // YOUTUBE PLAYER AUTO-MUTE FUNCTIONS
    // ========================================
    
    function initYouTubePlayerAPI() {
        // Load YouTube IFrame API if not already loaded
        if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            // Wait for API to load
            window.onYouTubeIframeAPIReady = function() {
                createYouTubePlayer();
            };
        } else {
            createYouTubePlayer();
        }
    }
    
    function createYouTubePlayer() {
        const iframe = document.getElementById('youtubePlayer');
        if (iframe && !youtubePlayer) {
            try {
                youtubePlayer = new YT.Player('youtubePlayer', {
                    events: {
                        'onReady': onPlayerReady
                    }
                });
            } catch (e) {
                console.log('Could not initialize YouTube player:', e);
            }
        }
    }
    
    function onPlayerReady(event) {
        ytPlayerReady = true;
        console.log('🎬 YouTube Player ready for voice control');
    }
    
    function muteVideoForVoiceCommand() {
        if (youtubePlayer && ytPlayerReady) {
            try {
                const playerState = youtubePlayer.getPlayerState();
                // Only mute if video is playing (state 1)
                if (playerState === 1 && !youtubePlayer.isMuted()) {
                    console.log('🔇 [AUTO-MUTE] Muting video for voice command');
                    youtubePlayer.mute();
                    videoWasMutedByUs = true;
                    
                    // Show visual indicator
                    const indicator = document.getElementById('videoMuteIndicator');
                    if (indicator) {
                        indicator.classList.add('show');
                    }
                }
            } catch (e) {
                console.log('Could not mute video:', e);
            }
        }
    }
    
    function unmuteVideoAfterVoiceCommand() {
        if (youtubePlayer && ytPlayerReady && videoWasMutedByUs) {
            try {
                console.log('🔊 [AUTO-UNMUTE] Unmuting video after voice command');
                youtubePlayer.unMute();
                videoWasMutedByUs = false;
                
                // Hide visual indicator
                const indicator = document.getElementById('videoMuteIndicator');
                if (indicator) {
                    indicator.classList.remove('show');
                }
            } catch (e) {
                console.log('Could not unmute video:', e);
            }
        }
    }

    // ========================================
    // PAGE DETECTION
    // ========================================
    
    function detectCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('/recipe/')) return 'recipe-detail';
        if (path.includes('/video/')) return 'video-detail';
        if (path.includes('/profile')) return 'profile';
        return 'home';
    }

    // ========================================
    // VOICE CONTROL INITIALIZATION
    // ========================================
    
    function initializeVoiceControl() {
        const page = window.globalVoiceControl.currentPage;
        console.log(`🎤 Initializing global voice control for page: ${page}`);
        
        // Initialize socket for server-side TTS
        initVoiceSocket();
        
        // Create floating voice button
        createFloatingVoiceButton();
        
        // Setup page-specific handlers
        setupPageSpecificHandlers(page);
        
        // Listen for page changes (SPA navigation)
        setupNavigationListener();
        
        // Load conversation context from sessionStorage
        loadConversationContext();
    }

    // ========================================
    // FLOATING VOICE BUTTON
    // ========================================
    
    function createFloatingVoiceButton() {
        // Check if button already exists
        if (document.getElementById('global-voice-btn')) return;
        
        const button = document.createElement('button');
        button.id = 'global-voice-btn';
        button.className = 'global-voice-button';
        button.innerHTML = `
            <div class="voice-ripple"></div>
            <i class="fas fa-microphone"></i>
            <span class="voice-status-text">Click to activate</span>
        `;
        
        button.addEventListener('click', toggleGlobalVoice);
        document.body.appendChild(button);
        
        // Add styles
        if (!document.getElementById('global-voice-styles')) {
            const style = document.createElement('style');
            style.id = 'global-voice-styles';
            style.textContent = `
                .global-voice-button {
                    position: fixed;
                    bottom: 30px;
                    right: 30px;
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #ED8936 0%, #68D391 100%);
                    border: none;
                    color: white;
                    cursor: pointer;
                    box-shadow: 0 8px 24px rgba(237, 137, 54, 0.4);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                    overflow: visible;
                }
                
                .global-voice-button:hover {
                    transform: scale(1.1);
                    box-shadow: 0 12px 32px rgba(237, 137, 54, 0.6);
                }
                
                .global-voice-button.active {
                    background: linear-gradient(135deg, #68D391 0%, #ED8936 100%);
                    animation: pulse-voice 2s infinite;
                }
                
                .global-voice-button.listening {
                    background: linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%);
                }
                
                /* Explicit states for generating, speaking and inactive to ensure
                   class-based styling takes effect even if inline styles are later altered */
                .global-voice-button.generating {
                    background: linear-gradient(135deg, #ED8936 0%, #DD6B20 100%);
                    box-shadow: 0 4px 20px rgba(237,137,54,0.6);
                    animation: pulse-generating 1s ease-in-out infinite;
                }

                .global-voice-button.speaking {
                    background: linear-gradient(135deg, #4299E1 0%, #3182CE 100%);
                    box-shadow: 0 4px 20px rgba(66,153,225,0.6);
                    animation: pulse-speaking 1.2s ease-in-out infinite;
                }

                .global-voice-button.inactive {
                    background: linear-gradient(135deg, #718096 0%, #4A5568 100%);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    animation: none;
                }
                
                .global-voice-button i {
                    font-size: 24px;
                    margin-bottom: 4px;
                }
                
                .voice-status-text {
                    font-size: 8px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .voice-ripple {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    border: 3px solid #ED8936;
                    opacity: 0;
                    animation: ripple-animation 2s infinite;
                }
                
                .global-voice-button.active .voice-ripple {
                    opacity: 1;
                }
                
                @keyframes pulse-voice {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                
                @keyframes ripple-animation {
                    0% {
                        transform: scale(1);
                        opacity: 0.8;
                    }
                    100% {
                        transform: scale(1.5);
                        opacity: 0;
                    }
                }
                
                @keyframes pulse-listening {
                    0%, 100% { 
                        transform: scale(1); 
                        box-shadow: 0 4px 20px rgba(245,101,101,0.6);
                    }
                    50% { 
                        transform: scale(1.08); 
                        box-shadow: 0 6px 30px rgba(245,101,101,0.9);
                    }
                }
                
                @keyframes pulse-generating {
                    0%, 100% { 
                        transform: scale(1); 
                        box-shadow: 0 4px 20px rgba(237,137,54,0.6);
                    }
                    50% { 
                        transform: scale(1.06); 
                        box-shadow: 0 6px 30px rgba(237,137,54,0.9);
                    }
                }
                
                @keyframes pulse-speaking {
                    0%, 100% { 
                        transform: scale(1); 
                        box-shadow: 0 4px 20px rgba(66,153,225,0.6);
                    }
                    50% { 
                        transform: scale(1.07); 
                        box-shadow: 0 6px 30px rgba(66,153,225,0.9);
                    }
                }
                
                /* Voice notification */
                .voice-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    padding: 16px 24px;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    animation: slideInRight 0.3s ease;
                }
                
                @keyframes slideInRight {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                .voice-notification.fadeout {
                    animation: fadeOut 0.3s ease forwards;
                }
                
                @keyframes fadeOut {
                    to {
                        opacity: 0;
                        transform: translateX(400px);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Set initial state to inactive
        setTimeout(() => {
            updateMicButtonState('inactive');
        }, 100);
    }

    // ========================================
    // VOICE CONTROL TOGGLE
    // ========================================
    
    function toggleGlobalVoice() {
        const button = document.getElementById('global-voice-btn');
        const statusText = button.querySelector('.voice-status-text');
        
        if (window.globalVoiceControl.isActive) {
            // Deactivate
            window.globalVoiceControl.isActive = false;
            updateMicButtonState('inactive');
            
            if (continuousRecognition) {
                try {
                    continuousRecognition.stop();
                } catch (e) {
                    console.log('Recognition already stopped');
                }
            }
            
            showVoiceNotification('🔇 Voice control deactivated', 'info');
            speakText('Voice control deactivated');
            
        } else {
            // Activate
            window.globalVoiceControl.isActive = true;
            updateMicButtonState('active');
            
            if (continuousRecognition) {
                try {
                    continuousRecognition.start();
                    console.log('✅ Continuous recognition started');
                } catch (e) {
                    console.log('Recognition already running');
                }
            }
            
            showVoiceNotification('🎤 Voice control activated! Say "Hey Kitchen" to start', 'success');
            speakText('Voice control activated. Say Hey Kitchen to give a command');
        }
    }

    // ========================================
    // RECOGNITION HANDLERS
    // ========================================
    
    function setupRecognitionHandlers() {
        if (!continuousRecognition) return;
        
        continuousRecognition.onresult = (event) => {
            const resultIndex = event.resultIndex;
            const result = event.results[resultIndex];
            const transcript = result[0].transcript.toLowerCase().trim();
            const isFinal = result.isFinal;
            
            console.log(`🎤 ${isFinal ? 'FINAL' : 'INTERIM'}: "${transcript}"`);
            
            // Check for wake word
            if (containsWakeWord(transcript) && !wakeWordDetected) {
                console.log('🎯 Wake word detected!');
                wakeWordDetected = true;
                commandAccumulator = '';
                lastSpeechTime = Date.now();
                
                // MUTE VIDEO IMMEDIATELY when user starts speaking
                muteVideoForVoiceCommand();
                
                updateButtonStatus('listening');
                showVoiceNotification('👂 Listening...', 'info');
                playBeep();
                
                if (commandTimeout) clearTimeout(commandTimeout);
                return;
            }
            
            // Accumulate command after wake word
            if (wakeWordDetected) {
                commandAccumulator += ' ' + transcript;
                lastSpeechTime = Date.now();
                
                // Clear existing timeout
                if (commandTimeout) clearTimeout(commandTimeout);
                
                // Set timeout for command processing (2 seconds of silence)
                if (isFinal) {
                    commandTimeout = setTimeout(() => {
                        processAccumulatedCommand();
                    }, COMMAND_TIMEOUT);
                }
            }
        };
        
        continuousRecognition.onerror = (event) => {
            console.error('Recognition error:', event.error);
            if (event.error === 'no-speech') {
                // Ignore no-speech errors in continuous mode
                return;
            }
        };
        
        continuousRecognition.onend = () => {
            console.log('Recognition ended');
            // Auto-restart if still active
            if (window.globalVoiceControl.isActive) {
                setTimeout(() => {
                    try {
                        continuousRecognition.start();
                        console.log('🔄 Recognition restarted');
                    } catch (e) {
                        console.log('Could not restart recognition');
                    }
                }, 100);
            }
        };
    }

    // ========================================
    // COMMAND PROCESSING
    // ========================================
    
    function processAccumulatedCommand() {
        const command = commandAccumulator.trim();
        console.log('🎯 Processing command:', command);
        
        if (!command) {
            wakeWordDetected = false;
            updateButtonStatus('active');
            return;
        }
        
        // Save to context
        window.globalVoiceControl.lastCommand = command;
        window.globalVoiceControl.conversationContext.push({
            type: 'command',
            text: command,
            timestamp: Date.now(),
            page: window.globalVoiceControl.currentPage
        });
        saveConversationContext();
        
        // Execute command
        executeVoiceCommand(command);
        
        // Reset
        commandAccumulator = '';
        wakeWordDetected = false;
        updateButtonStatus('active');
        
        // UNMUTE VIDEO after command is processed
        setTimeout(() => {
            unmuteVideoAfterVoiceCommand();
        }, 500); // Small delay to ensure TTS starts first
    }

    // ========================================
    // COMMAND EXECUTION
    // ========================================
    
    function executeVoiceCommand(command) {
        const cmd = command.toLowerCase();
        const page = window.globalVoiceControl.currentPage;
        
        console.log(`🎯 Executing command on ${page}:`, cmd);
        
        // HIGHEST PRIORITY: Stop/Cancel command
        if (cmd.includes('stop talking') || cmd.includes('stop speaking') || 
            cmd.includes('be quiet') || cmd.includes('shut up') || 
            cmd.includes('cancel') || cmd === 'stop voice') {
            stopAllVoices();
            return;
        }
        
        // Universal commands (work on all pages)
        if (handleUniversalCommands(cmd)) return;
        
        // Page-specific commands - check if they were handled
        let commandHandled = false;
        
        console.log(`🎯 [DEBUG] Current page: ${page}, Command: "${cmd}"`);
        
        switch (page) {
            case 'recipe-detail':
                console.log('🍳 [DEBUG] Routing to recipe-detail commands');
                commandHandled = handleRecipeDetailCommands(cmd);
                console.log(`🍳 [DEBUG] Recipe command handled: ${commandHandled}`);
                break;
            case 'video-detail':
                console.log('🎬 [DEBUG] Routing to video-detail commands');
                commandHandled = handleVideoDetailCommands(cmd);
                break;
            case 'profile':
                commandHandled = handleProfileCommands(cmd);
                break;
            case 'home':
                commandHandled = handleHomeCommands(cmd);
                break;
        }
        
        // If command wasn't handled, send to AI
        if (!commandHandled) {
            console.log('💬 Command not recognized, sending to AI:', command);
            sendCommandToAI(command);
        } else {
            console.log('✅ [DEBUG] Command handled locally, not sending to AI');
        }
    }

    // ========================================
    // AI FALLBACK FOR UNHANDLED COMMANDS
    // ========================================
    
    function sendCommandToAI(command) {
        if (!voiceSocket || !voiceSocket.connected) {
            console.error('❌ Cannot send to AI - Socket not connected');
            speakText('Sorry, I cannot process that command right now. Please try again.');
            return;
        }
        
        // Get or create session ID
        let sessionId = sessionStorage.getItem('ai_session_id');
        if (!sessionId) {
            sessionId = 'voice_' + Date.now() + '_' + Math.random().toString(36).substring(7);
            sessionStorage.setItem('ai_session_id', sessionId);
        }
        
        console.log('📤 Sending to AI:', { command, sessionId: sessionId.substring(0, 15) });
        
        // Show feedback
        showVoiceNotification('🤔 Thinking...', 'info');
        
        // Send command to AI via Socket.IO
        voiceSocket.emit('user_command', {
            command: command,
            session_id: sessionId
        });
        
        // Note: AI will respond via 'ai_audio_base64' event, which is already handled
        // The TTS audio will be automatically played by playServerAudio()
    }

    // ========================================
    // UNIVERSAL COMMANDS
    // ========================================
    
    function handleUniversalCommands(cmd) {
        // Navigation
        if (cmd.includes('go back') || cmd.includes('go to previous page') || cmd.includes('back')) {
            window.history.back();
            speakText('Going back');
            showVoiceNotification('← Going back', 'info');
            return true;
        }
        
        if (cmd.includes('go home') || cmd.includes('go to home') || cmd.includes('main page') || cmd.includes('home page')) {
            window.location.href = '/';
            speakText('Going to home page');
            return true;
        }
        
        if (cmd.includes('go to profile') || cmd.includes('open profile') || cmd.includes('view profile')) {
            window.location.href = '/profile';
            speakText('Opening profile');
            return true;
        }
        
        if (cmd.includes('logout') || cmd.includes('sign out')) {
            window.location.href = '/logout';
            speakText('Logging out');
            return true;
        }
        
        // Recipe-related navigation patterns that should go to AI
        // These will be caught by the AI fallback and handled intelligently
        if (cmd.includes('show me') && (cmd.includes('recipe') || cmd.includes('recipes'))) {
            // Let AI handle: "show me butter chicken recipe", "show me pasta recipes", etc.
            return false; // Send to AI
        }
        
        if (cmd.includes('open') && (cmd.includes('recipe') || cmd.includes('video'))) {
            // Let AI handle: "open butter chicken recipe", "open cooking video", etc.
            return false; // Send to AI
        }
        
        if ((cmd.includes('find') || cmd.includes('search for') || cmd.includes('look for')) && 
            (cmd.includes('recipe') || cmd.includes('video') || cmd.includes('how to make') || cmd.includes('how to cook'))) {
            // Let AI handle: "find butter chicken recipe", "search for pasta recipes", etc.
            return false; // Send to AI
        }
        
        if (cmd.includes('how to make') || cmd.includes('how to cook') || cmd.includes('how do i make') || cmd.includes('how do i cook')) {
            // Let AI handle: "how to make pizza", "how to cook biryani", etc.
            return false; // Send to AI
        }
        
        if (cmd.includes('what can i make with') || cmd.includes('what can i cook with') || 
            cmd.includes('recipes with') || cmd.includes('dishes with')) {
            // Let AI handle: "what can I make with chicken", "recipes with eggs", etc.
            return false; // Send to AI
        }
        
        // Scrolling
        if (cmd.includes('scroll down') || cmd.includes('scroll page down')) {
            window.scrollBy({ top: 400, behavior: 'smooth' });
            speakText('Scrolling down');
            return true;
        }
        
        if (cmd.includes('scroll up') || cmd.includes('scroll page up')) {
            window.scrollBy({ top: -400, behavior: 'smooth' });
            speakText('Scrolling up');
            return true;
        }
        
        if (cmd.includes('scroll to top') || cmd.includes('go to top') || cmd.includes('top of page') || cmd.includes('scroll all the way up')) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            speakText('Scrolling to top');
            showVoiceNotification('⬆️ Scrolling to top', 'info');
            return true;
        }
        
        if (cmd.includes('scroll to bottom') || cmd.includes('go to bottom') || cmd.includes('bottom of page') || cmd.includes('scroll all the way down')) {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            speakText('Scrolling to bottom');
            showVoiceNotification('⬇️ Scrolling to bottom', 'info');
            return true;
        }
        
        // Scroll to specific sections (works on recipe and video pages)
        if (cmd.includes('scroll to ingredients') || cmd.includes('show ingredients') || cmd.includes('go to ingredients') || cmd.includes('ingredients section')) {
            const success = scrollToSection('ingredients');
            if (success) {
                speakText('Scrolling to ingredients');
                showVoiceNotification('🥕 Scrolling to ingredients', 'success');
            } else {
                speakText('Ingredients section not found on this page');
            }
            return true;
        }
        
        if (cmd.includes('scroll to instructions') || cmd.includes('show instructions') || cmd.includes('scroll to steps') || cmd.includes('go to steps') || cmd.includes('instructions section')) {
            const success = scrollToSection('instructions');
            if (success) {
                speakText('Scrolling to instructions');
                showVoiceNotification('📝 Scrolling to instructions', 'success');
            } else {
                speakText('Instructions section not found on this page');
            }
            return true;
        }
        
        if (cmd.includes('scroll to nutrition') || cmd.includes('show nutrition') || cmd.includes('go to nutrition') || cmd.includes('nutrition facts')) {
            const success = scrollToSection('nutrition');
            if (success) {
                speakText('Scrolling to nutrition information');
                showVoiceNotification('🍎 Scrolling to nutrition', 'success');
            } else {
                speakText('Nutrition section not found on this page');
            }
            return true;
        }
        
        // Help
        if (cmd === 'help' || cmd.includes('what can you do') || cmd.includes('show commands')) {
            showContextualHelp();
            return true;
        }
        
        // Refresh
        if (cmd.includes('refresh page') || cmd.includes('reload page')) {
            location.reload();
            return true;
        }
        
        return false;
    }

    // ========================================
    // RECIPE DETAIL COMMANDS
    // ========================================
    
    function handleRecipeDetailCommands(cmd) {
        console.log('🔍 [RECIPE DEBUG] Processing recipe command:', cmd);
        
        // Read ingredients
        if (cmd.includes('read ingredients') || cmd.includes('list ingredients') || cmd.includes('what are the ingredients') || cmd.includes('tell me the ingredients')) {
            console.log('✅ [RECIPE DEBUG] Matched: read ingredients');
            readIngredients();
            return true;
        }
        
        // Read instructions (with more variations including "cooking")
        if (cmd.includes('read instructions') || 
            cmd.includes('read steps') || 
            cmd.includes('read the instructions') ||
            cmd.includes('read the steps') ||
            cmd.includes('read cooking instructions') ||
            cmd.includes('read the cooking instructions') ||
            cmd.includes('how do i make this') || 
            cmd.includes('tell me the steps') ||
            cmd.includes('how to cook') ||
            cmd.includes('show instructions') ||
            cmd.includes('show steps')) {
            console.log('✅ [RECIPE DEBUG] Matched: read instructions');
            readInstructions();
            return true;
        }
        
        // Read specific step
        const stepMatch = cmd.match(/read step (\d+)|step (\d+)|go to step (\d+)|show step (\d+)/);
        if (stepMatch) {
            const stepNumber = stepMatch[1] || stepMatch[2] || stepMatch[3] || stepMatch[4];
            readStep(parseInt(stepNumber));
            return true;
        }
        
        // Next step (advance to next instruction)
        if (cmd.includes('next step') || cmd.includes('continue cooking') || cmd === 'next') {
            readNextStep();
            return true;
        }
        
        // Previous step (go back to previous instruction)
        if (cmd.includes('previous step') || cmd.includes('last step') || cmd.includes('go back') || cmd === 'previous') {
            readPreviousStep();
            return true;
        }
        
        // Repeat step (read current step again)
        if (cmd.includes('repeat step') || cmd.includes('repeat that') || cmd.includes('say that again') || cmd === 'repeat') {
            repeatCurrentStep();
            return true;
        }
        
        // Complete step
        const completeMatch = cmd.match(/complete step (\d+)|done with step (\d+)|finished step (\d+)|mark step (\d+)/);
        if (completeMatch) {
            const stepNumber = completeMatch[1] || completeMatch[2] || completeMatch[3] || completeMatch[4];
            completeStepByNumber(parseInt(stepNumber));
            return true;
        }
        
        // Legacy next step handler (kept for backward compatibility)
        if (cmd.includes('continue cooking')) {
            nextRecipeStep();
            return true;
        }
        
        // Previous step
        if (cmd.includes('previous step') || cmd.includes('go back one step') || cmd === 'previous') {
            previousRecipeStep();
            return true;
        }
        
        // Recipe scaling
        if (cmd.includes('increase servings') || cmd.includes('add serving') || cmd.includes('scale up')) {
            scaleRecipeUp();
            return true;
        }
        
        if (cmd.includes('decrease servings') || cmd.includes('reduce servings') || cmd.includes('scale down')) {
            scaleRecipeDown();
            return true;
        }
        
        // Set servings to specific number
        const servingsMatch = cmd.match(/set servings to (\d+)|(\d+) servings|make it for (\d+)|change serving(?:s)? to (\d+)|serving(?:s)? to (\d+)/);
        if (servingsMatch) {
            const servings = servingsMatch[1] || servingsMatch[2] || servingsMatch[3] || servingsMatch[4] || servingsMatch[5];
            console.log(`🍽️ Matched serving change command: ${cmd} → ${servings} servings`);
            setServings(parseInt(servings));
            return true;
        }
        
        // Timer commands - send to backend instead of local DOM manipulation
        if (cmd.includes('start timer') || cmd.includes('begin timer') || cmd.includes('set timer')) {
            const minutesMatch = cmd.match(/(\d+) minute/);
            const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 10;
            
            // Get recipe name from page title or h1
            const recipeTitle = document.querySelector('h1')?.textContent?.trim() || 'Recipe';
            const timerName = `${recipeTitle} Timer`;
            
            console.log(`⏱️ Creating backend timer: "${timerName}" for ${minutes} minutes`);
            
            // Send natural language command to AI which will use the set_timer tool
            const timerCommand = `set a timer for ${minutes} minutes called ${timerName}`;
            sendCommandToAI(timerCommand);
            
            return true;
        }
        
        if (cmd.includes('stop timer') || cmd.includes('pause timer') || cmd.includes('delete timer')) {
            console.log('⏱️ Pausing/deleting timer via backend');
            
            // Get recipe name to identify the timer
            const recipeTitle = document.querySelector('h1')?.textContent?.trim() || 'Recipe';
            const timerName = `${recipeTitle} Timer`;
            
            // Send command via AI
            const pauseCommand = `pause the ${timerName}`;
            sendCommandToAI(pauseCommand);
            return true;
        }
        
        if (cmd.includes('reset timer') || cmd.includes('clear timer')) {
            console.log('⏱️ Resetting timer via backend');
            
            // Get recipe name to identify the timer
            const recipeTitle = document.querySelector('h1')?.textContent?.trim() || 'Recipe';
            const timerName = `${recipeTitle} Timer`;
            
            // Delete and recreate
            const resetCommand = `delete the ${timerName} and set a new timer for 10 minutes called ${timerName}`;
            sendCommandToAI(resetCommand);
            return true;
        }
        
        // Check ingredient
        const checkMatch = cmd.match(/check ingredient (\d+)|check off (\d+)|mark ingredient (\d+)/);
        if (checkMatch) {
            const ingredientNum = checkMatch[1] || checkMatch[2] || checkMatch[3];
            checkIngredient(parseInt(ingredientNum));
            return true;
        }
        
        // Clear all checked ingredients
        if (cmd.includes('clear all checks') || cmd.includes('uncheck all') || cmd.includes('reset ingredients')) {
            clearAllIngredients();
            return true;
        }
        
        // Unit conversion
        if (cmd.includes('convert') && (cmd.includes('to') || cmd.includes('into'))) {
            // Example: "convert 1 cup to ml"
            handleVoiceConversion(cmd);
            return true;
        }
        
        // Save recipe
        if (cmd.includes('save recipe') || cmd.includes('add to favorites') || cmd.includes('favorite this')) {
            saveRecipe();
            return true;
        }
        
        // Print recipe
        if (cmd.includes('print recipe') || cmd.includes('print this')) {
            window.print();
            speakText('Opening print dialog');
            return true;
        }
        
        // Read title
        if (cmd.includes('read title') || cmd.includes('what is this recipe') || cmd.includes('recipe name')) {
            readRecipeTitle();
            return true;
        }
        
        // Read nutrition
        if (cmd.includes('read nutrition') || cmd.includes('nutritional information') || cmd.includes('how many calories')) {
            readNutrition();
            return true;
        }
        
        // Voice guide toggle
        if (cmd.includes('start voice guide') || cmd.includes('begin voice guide') || cmd.includes('guide me')) {
            startVoiceGuide();
            return true;
        }
        
        if (cmd.includes('stop voice guide') || cmd.includes('end voice guide')) {
            stopVoiceGuide();
            return true;
        }
        
        return false;
    }

    // ========================================
    // VIDEO DETAIL COMMANDS
    // ========================================
    
    function handleVideoDetailCommands(cmd) {
        const iframe = document.querySelector('.video-container iframe');
        
        // Initialize YouTube player if not already done
        if (!window.youtubePlayerReady && iframe) {
            initializeYouTubePlayer(iframe);
        }
        
        // Video controls - Play
        if (cmd.includes('play video') || cmd.includes('play the video') || cmd === 'play' || cmd.includes('resume') || cmd.includes('start video')) {
            if (iframe) {
                iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                speakText('Playing video');
                showVoiceNotification('▶️ Playing', 'success');
            } else {
                speakText('No video found to play');
            }
            return true;
        }
        
        // Pause
        if (cmd.includes('pause video') || cmd.includes('pause the video') || cmd === 'pause' || cmd.includes('hold on')) {
            if (iframe) {
                iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                speakText('Video paused');
                showVoiceNotification('⏸️ Paused', 'info');
            } else {
                speakText('No video found to pause');
            }
            return true;
        }
        
        // Stop
        if (cmd.includes('stop video') || cmd.includes('stop the video') || cmd === 'stop') {
            if (iframe) {
                iframe.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
                speakText('Video stopped');
                showVoiceNotification('⏹️ Stopped', 'info');
            } else {
                speakText('No video found to stop');
            }
            return true;
        }
        
        // Seek forward
        if (cmd.includes('skip ahead') || cmd.includes('forward') || cmd.includes('skip forward') || cmd.includes('fast forward')) {
            if (iframe) {
                // Get current time and add 10 seconds
                iframe.contentWindow.postMessage('{"event":"command","func":"getCurrentTime","args":""}', '*');
                setTimeout(() => {
                    speakText('Skipping ahead 10 seconds');
                    showVoiceNotification('⏩ +10 seconds', 'info');
                }, 100);
            }
            return true;
        }
        
        // Seek backward
        if (cmd.includes('go back') || cmd.includes('rewind') || cmd.includes('skip back') || cmd.includes('replay')) {
            if (iframe) {
                speakText('Rewinding 10 seconds');
                showVoiceNotification('⏪ -10 seconds', 'info');
            }
            return true;
        }
        
        // Restart video
        if (cmd.includes('restart video') || cmd.includes('start over') || cmd.includes('play from beginning') || cmd.includes('from the start')) {
            if (iframe) {
                iframe.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
                iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                speakText('Restarting video');
                showVoiceNotification('🔄 Restarting', 'info');
            }
            return true;
        }
        
        // Volume control
        if (cmd.includes('volume up') || cmd.includes('increase volume') || cmd.includes('louder') || cmd.includes('turn it up')) {
            if (iframe) {
                iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[100]}', '*');
                speakText('Volume increased');
                showVoiceNotification('🔊 Volume up', 'success');
            }
            return true;
        }
        
        if (cmd.includes('volume down') || cmd.includes('decrease volume') || cmd.includes('quieter') || cmd.includes('lower volume') || cmd.includes('turn it down')) {
            if (iframe) {
                iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[30]}', '*');
                speakText('Volume decreased');
                showVoiceNotification('🔉 Volume down', 'info');
            }
            return true;
        }
        
        // Set specific volume
        const volumeMatch = cmd.match(/volume (\d+)|set volume to (\d+)|volume at (\d+)/);
        if (volumeMatch) {
            const volume = parseInt(volumeMatch[1] || volumeMatch[2] || volumeMatch[3]);
            if (volume >= 0 && volume <= 100 && iframe) {
                iframe.contentWindow.postMessage(`{"event":"command","func":"setVolume","args":[${volume}]}`, '*');
                speakText(`Volume set to ${volume} percent`);
                showVoiceNotification(`🔊 Volume: ${volume}%`, 'success');
            }
            return true;
        }
        
        // Mute
        if (cmd.includes('mute video') || cmd === 'mute' || cmd.includes('mute sound') || cmd.includes('silence')) {
            if (iframe) {
                iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
                speakText('Video muted');
                showVoiceNotification('🔇 Muted', 'info');
            }
            return true;
        }
        
        // Unmute
        if (cmd.includes('unmute video') || cmd === 'unmute' || cmd.includes('unmute sound') || cmd.includes('sound on') || cmd.includes('audio on')) {
            if (iframe) {
                iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
                speakText('Video unmuted');
                showVoiceNotification('🔊 Unmuted', 'success');
            }
            return true;
        }
        
        // Fullscreen
        if (cmd.includes('fullscreen') || cmd.includes('full screen') || cmd.includes('enter fullscreen') || cmd.includes('make it fullscreen')) {
            if (iframe) {
                const container = iframe.closest('.video-container');
                if (container && container.requestFullscreen) {
                    container.requestFullscreen();
                    speakText('Entering fullscreen');
                    showVoiceNotification('⛶ Fullscreen', 'success');
                } else if (iframe.requestFullscreen) {
                    iframe.requestFullscreen();
                    speakText('Entering fullscreen');
                }
            }
            return true;
        }
        
        // Exit fullscreen
        if (cmd.includes('exit fullscreen') || cmd.includes('leave fullscreen') || cmd.includes('normal screen') || cmd.includes('close fullscreen')) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
                speakText('Exiting fullscreen');
                showVoiceNotification('⛶ Normal view', 'info');
            }
            return true;
        }
        
        // Playback speed
        if (cmd.includes('speed') || cmd.includes('playback speed')) {
            if (cmd.includes('normal') || cmd.includes('1x') || cmd.includes('regular speed')) {
                if (iframe) {
                    iframe.contentWindow.postMessage('{"event":"command","func":"setPlaybackRate","args":[1]}', '*');
                    speakText('Normal speed');
                    showVoiceNotification('⚡ 1x speed', 'info');
                }
                return true;
            }
            if (cmd.includes('faster') || cmd.includes('1.5') || cmd.includes('1.5x') || cmd.includes('one point five')) {
                if (iframe) {
                    iframe.contentWindow.postMessage('{"event":"command","func":"setPlaybackRate","args":[1.5]}', '*');
                    speakText('One point five times speed');
                    showVoiceNotification('⚡ 1.5x speed', 'success');
                }
                return true;
            }
            if (cmd.includes('double') || cmd.includes('2x') || cmd.includes('twice') || cmd.includes('two times')) {
                if (iframe) {
                    iframe.contentWindow.postMessage('{"event":"command","func":"setPlaybackRate","args":[2]}', '*');
                    speakText('Double speed');
                    showVoiceNotification('⚡⚡ 2x speed', 'success');
                }
                return true;
            }
            if (cmd.includes('slower') || cmd.includes('0.5') || cmd.includes('half') || cmd.includes('half speed')) {
                if (iframe) {
                    iframe.contentWindow.postMessage('{"event":"command","func":"setPlaybackRate","args":[0.5]}', '*');
                    speakText('Half speed');
                    showVoiceNotification('🐌 0.5x speed', 'info');
                }
                return true;
            }
        }
        
        // Read video info
        if (cmd.includes('read title') || cmd.includes('what is this video') || cmd.includes('video title') || cmd.includes('what am i watching')) {
            readVideoTitle();
            return true;
        }
        
        if (cmd.includes('read description') || cmd.includes('video description') || cmd.includes('tell me about this video')) {
            readVideoDescription();
            return true;
        }
        
        // Read ingredients (if available)
        if (cmd.includes('read ingredients') || cmd.includes('list ingredients') || cmd.includes('what ingredients')) {
            readVideoIngredients();
            return true;
        }
        
        // Read steps (if available)
        if (cmd.includes('read steps') || cmd.includes('read instructions') || cmd.includes('how do i make this')) {
            readVideoSteps();
            return true;
        }
        
        // Read specific step
        const videoStepMatch = cmd.match(/read step (\d+)|step (\d+)|show step (\d+)/);
        if (videoStepMatch) {
            const stepNumber = videoStepMatch[1] || videoStepMatch[2] || videoStepMatch[3];
            readVideoStep(parseInt(stepNumber));
            return true;
        }
        
        // Next step (for video instructions)
        if (cmd.includes('next step') || cmd.includes('continue cooking') || cmd === 'next') {
            readNextStep();
            return true;
        }
        
        // Previous step (for video instructions)
        if (cmd.includes('previous step') || cmd.includes('last step') || cmd.includes('go back') || cmd === 'previous') {
            readPreviousStep();
            return true;
        }
        
        // Repeat step (for video instructions)
        if (cmd.includes('repeat step') || cmd.includes('repeat that') || cmd.includes('say that again') || cmd === 'repeat') {
            repeatCurrentStep();
            return true;
        }
        
        // Scroll to sections
        if (cmd.includes('scroll to ingredients') || cmd.includes('show ingredients') || cmd.includes('go to ingredients')) {
            scrollToSection('ingredients');
            speakText('Scrolling to ingredients');
            return true;
        }
        
        if (cmd.includes('scroll to steps') || cmd.includes('scroll to instructions') || cmd.includes('show instructions')) {
            scrollToSection('steps');
            speakText('Scrolling to steps');
            return true;
        }
        
        if (cmd.includes('scroll to description') || cmd.includes('show description')) {
            scrollToSection('description');
            speakText('Scrolling to description');
            return true;
        }
        
        if (cmd.includes('scroll to related') || cmd.includes('show related videos')) {
            scrollToSection('related');
            speakText('Scrolling to related videos');
            return true;
        }
        
        // Save video
        if (cmd.includes('save video') || cmd.includes('add to favorites') || cmd.includes('favorite this') || cmd.includes('save this')) {
            saveVideo();
            return true;
        }
        
        // Share video
        if (cmd.includes('share video') || cmd.includes('share this')) {
            shareVideo();
            return true;
        }
        
        // Download recipe
        if (cmd.includes('download recipe') || cmd.includes('download this') || cmd.includes('save recipe')) {
            downloadRecipe();
            return true;
        }
        
        // Save notes
        if (cmd.includes('save notes') || cmd.includes('save my notes')) {
            saveVideoNotes();
            return true;
        }
        
        // Open on YouTube
        if (cmd.includes('open on youtube') || cmd.includes('watch on youtube') || cmd.includes('go to youtube')) {
            openOnYouTube();
            return true;
        }
        
        // Add to playlist
        if (cmd.includes('add to playlist') || cmd.includes('playlist')) {
            addToPlaylist();
            return true;
        }
        
        // Set reminder
        if (cmd.includes('set reminder') || cmd.includes('remind me')) {
            setReminder();
            return true;
        }
        
        return false;
    }

    // ========================================
    // PROFILE PAGE COMMANDS
    // ========================================
    
    function handleProfileCommands(cmd) {
        // Read stats
        if (cmd.includes('read stats') || cmd.includes('my stats') || cmd.includes('show stats')) {
            readProfileStats();
            return true;
        }
        
        // Read achievements
        if (cmd.includes('read achievements') || cmd.includes('my achievements') || cmd.includes('show achievements')) {
            readAchievements();
            return true;
        }
        
        // Scroll to sections
        if (cmd.includes('scroll to preferences') || cmd.includes('show preferences')) {
            scrollToSection('preferences');
            speakText('Scrolling to dietary preferences');
            return true;
        }
        
        if (cmd.includes('scroll to stats') || cmd.includes('show statistics')) {
            scrollToSection('statistics');
            speakText('Scrolling to statistics');
            return true;
        }
        
        if (cmd.includes('scroll to achievements')) {
            scrollToSection('achievements');
            speakText('Scrolling to achievements');
            return true;
        }
        
        if (cmd.includes('scroll to activity') || cmd.includes('show activity')) {
            scrollToSection('activity');
            speakText('Scrolling to recent activity');
            return true;
        }
        
        // Save profile
        if (cmd.includes('save profile') || cmd.includes('save changes')) {
            saveProfile();
            return true;
        }
        
        return false;
    }

    // ========================================
    // HOME PAGE COMMANDS
    // ========================================
    
    function handleHomeCommands(cmd) {
        // These commands are handled by the main script.js
        // This function is for any additional home-specific commands
        console.log('Home page command (handled by main script):', cmd);
        return false; // Let AI handle all home page queries
    }

    // ========================================
    // YOUTUBE PLAYER INITIALIZATION
    // ========================================
    
    function initializeYouTubePlayer(iframe) {
        if (!iframe) return;
        
        // Enable YouTube API by modifying iframe src
        const currentSrc = iframe.src;
        if (!currentSrc.includes('enablejsapi=1')) {
            const separator = currentSrc.includes('?') ? '&' : '?';
            iframe.src = currentSrc + separator + 'enablejsapi=1';
            window.youtubePlayerReady = true;
            console.log('✅ YouTube Player API enabled');
        }
        
        // Listen for player state changes
        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://www.youtube.com') return;
            
            try {
                const data = JSON.parse(event.data);
                if (data.event === 'infoDelivery' && data.info) {
                    // Store player state for voice commands
                    window.youtubePlayerState = data.info;
                }
            } catch (e) {
                // Ignore parsing errors
            }
        });
    }
    
    // ========================================
    // HELPER FUNCTIONS
    // ========================================
    
    function containsWakeWord(text) {
        const lowerText = text.toLowerCase();
        return WAKE_WORDS.some(wakeWord => lowerText.includes(wakeWord));
    }
    
    function updateButtonStatus(status) {
        // Use the new state system
        updateMicButtonState(status);
    }
    
    function showVoiceNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'voice-notification';
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}" 
               style="color: ${type === 'success' ? '#68D391' : type === 'error' ? '#F56565' : '#ED8936'}; font-size: 24px;"></i>
            <span style="font-weight: 600; color: #2D3748;">${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fadeout');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Update mic button visual state
    function updateMicButtonState(state) {
        const micBtn = document.getElementById('global-voice-btn');
        const micIcon = micBtn?.querySelector('i.fa-microphone, i.fa-microphone-slash');
        const statusText = micBtn?.querySelector('.voice-status-text');
        
        if (!micBtn) {
            console.warn('⚠️ Mic button not found');
            return;
        }
        
        console.log(`🎤 Updating mic button state to: ${state}`);
        
        // Remove all state classes
        micBtn.classList.remove('inactive', 'active', 'listening', 'generating', 'speaking');
        
        // Add current state class
        micBtn.classList.add(state);
        
    // Clear previous inline styling to avoid conflicts
    micBtn.style.removeProperty('background');
    micBtn.style.removeProperty('box-shadow');
    micBtn.style.removeProperty('animation');
    micBtn.style.removeProperty('transition');
        
    // Force reflow to ensure style changes take effect immediately
    void micBtn.offsetWidth;
        
        // Update icon and text based on state
        switch(state) {
            case 'inactive':
                if (micIcon) {
                    micIcon.classList.remove('fa-microphone');
                    micIcon.classList.add('fa-microphone-slash');
                }
                if (statusText) statusText.textContent = 'Click to Activate';
                micBtn.style.setProperty('background', 'linear-gradient(135deg, #718096 0%, #4A5568 100%)', 'important');
                micBtn.style.setProperty('box-shadow', '0 4px 15px rgba(0,0,0,0.2)', 'important');
                micBtn.style.setProperty('animation', 'none', 'important');
                break;
                
            case 'active':
                if (micIcon) {
                    micIcon.classList.remove('fa-microphone-slash');
                    micIcon.classList.add('fa-microphone');
                }
                if (statusText) statusText.textContent = 'Say "Hey Kitchen"';
                micBtn.style.setProperty('background', 'linear-gradient(135deg, #48BB78 0%, #38A169 100%)', 'important');
                micBtn.style.setProperty('box-shadow', '0 4px 15px rgba(72,187,120,0.4)', 'important');
                micBtn.style.setProperty('animation', 'none', 'important');
                break;
                
            case 'listening':
                if (micIcon) {
                    micIcon.classList.remove('fa-microphone-slash');
                    micIcon.classList.add('fa-microphone');
                }
                if (statusText) statusText.textContent = 'Listening...';
                micBtn.style.setProperty('background', 'linear-gradient(135deg, #F56565 0%, #E53E3E 100%)', 'important');
                micBtn.style.setProperty('box-shadow', '0 4px 20px rgba(245,101,101,0.6)', 'important');
                micBtn.style.setProperty('animation', 'pulse-listening 1.5s ease-in-out infinite', 'important');
                break;
                
            case 'generating':
                if (micIcon) {
                    micIcon.classList.remove('fa-microphone-slash');
                    micIcon.classList.add('fa-microphone');
                }
                if (statusText) statusText.textContent = 'Generating Speech...';
                micBtn.style.setProperty('background', 'linear-gradient(135deg, #ED8936 0%, #DD6B20 100%)', 'important');
                micBtn.style.setProperty('box-shadow', '0 4px 20px rgba(237,137,54,0.6)', 'important');
                micBtn.style.setProperty('animation', 'pulse-generating 1s ease-in-out infinite', 'important');
                // Force reflow again after applying inline styles
                void micBtn.offsetWidth;
                break;
                
            case 'speaking':
                if (micIcon) {
                    micIcon.classList.remove('fa-microphone-slash');
                    micIcon.classList.add('fa-microphone');
                }
                if (statusText) statusText.textContent = 'Speaking...';
                micBtn.style.setProperty('background', 'linear-gradient(135deg, #4299E1 0%, #3182CE 100%)', 'important');
                micBtn.style.setProperty('box-shadow', '0 4px 20px rgba(66,153,225,0.6)', 'important');
                micBtn.style.setProperty('animation', 'pulse-speaking 1.2s ease-in-out infinite', 'important');
                // Force reflow again after applying inline styles
                void micBtn.offsetWidth;
                break;
        }
    }
    // Expose for debugging in browser console
    try {
        window.updateMicButtonState = updateMicButtonState;
    } catch (e) {
        // ignore if not allowed
    }
    
    function playBeep() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (e) {
            console.log('Could not play beep:', e);
        }
    }
    
    // ========================================
    // SOCKET.IO CONNECTION FOR TTS
    // ========================================
    
    let voiceSocket = null;
    let audioContext = null;
    let currentAudioSource = null;
    
    // Initialize socket connection for TTS
    function initVoiceSocket() {
        // Prevent duplicate socket connections and event listeners
        if (voiceSocket && voiceSocket.connected) {
            console.log('✅ Socket already connected, reusing existing connection');
            return;
        }
        
        if (voiceSocket) {
            // Remove old listeners to prevent duplicates
            voiceSocket.off('connect');
            voiceSocket.off('ai_audio_base64');
            voiceSocket.off('final_text');
            voiceSocket.off('recipe_results');
            voiceSocket.off('navigate_to_recipe');
        }
        
        if (!voiceSocket) {
            voiceSocket = io();
            // Expose socket globally for recipe detail page and other components
            window.voiceSocket = voiceSocket;
            console.log('✅ voiceSocket exposed globally on window object');
        }
        
        voiceSocket.on('connect', () => {
            console.log('🔗 Voice control socket connected');
        });
        
        voiceSocket.on('ai_audio_base64', async (data) => {
            console.log('📥 Received TTS audio');
            await playServerAudio(data.audio_b64);
        });
        
        voiceSocket.on('final_text', (data) => {
            console.log('📝 AI Response Text:', data.text);
            // Save to conversation context
            window.globalVoiceControl.conversationContext.push({
                type: 'response',
                text: data.text,
                timestamp: Date.now(),
                page: window.globalVoiceControl.currentPage
            });
            saveConversationContext();
        });
        
        voiceSocket.on('recipe_results', (data) => {
            console.log('🍳 Received recipe results:', data.recipes?.length || 0);
            if (data.recipes && data.recipes.length > 0) {
                // Display recipes on the page
                displayRecipeResults(data.recipes);
            }
        });
        
        voiceSocket.on('navigate_to_recipe', (data) => {
            console.log('📖 [NAVIGATE EVENT RECEIVED] Recipe:', data.title, 'ID:', data.recipe_id);
            console.log('📖 [NAVIGATE] Full data:', JSON.stringify(data));
            
            // Navigate directly to the recipe page
            const recipeUrl = `/recipe/${data.recipe_id}`;
            console.log('📖 [NAVIGATE] Navigating to:', recipeUrl);
            window.location.href = recipeUrl;
        });
        
        // Debug: Log ALL incoming Socket.IO events
        voiceSocket.onAny((eventName, ...args) => {
            console.log(`🔔 [SOCKET EVENT] Received: ${eventName}`, args);
        });
        
        voiceSocket.on('youtube_results', (data) => {
            console.log('🎥 Received YouTube results:', data.videos?.length || 0);
            if (data.videos && data.videos.length > 0) {
                // Display videos on the page
                displayVideoResults(data.videos);
            }
        });
        
        voiceSocket.on('play_video', (data) => {
            console.log('▶️ Playing video:', data.video_id);
            // Navigate to video page or update current video
            const videoUrl = `/video/${data.video_id}`;
            window.location.href = videoUrl;
        });
        
        voiceSocket.on('error', (data) => {
            console.error('❌ TTS Error:', data.message);
            window.globalVoiceControl.isSpeaking = false;
            resumeRecognitionAfterSpeech();
        });
        
        // Initialize audio context
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('🔊 Audio context initialized for voice control');
            } catch (e) {
                console.error('❌ Audio context error:', e);
            }
        }
    }
    
    // ========================================
    // DISPLAY RESULTS FROM AI TOOLS
    // ========================================
    
    function displayRecipeResults(recipes) {
        console.log('🍳 Displaying', recipes.length, 'recipes');
        
        // If on home page and recipe results container exists, use it
        const recipeResultsContainer = document.getElementById('recipe-results');
        if (recipeResultsContainer) {
            // Clear existing results
            recipeResultsContainer.innerHTML = '';
            
            // Add title
            const title = document.createElement('h2');
            title.className = 'text-2xl font-bold mb-4 text-charcoal';
            title.textContent = `Found ${recipes.length} Recipe${recipes.length !== 1 ? 's' : ''}`;
            recipeResultsContainer.appendChild(title);
            
            // Create recipe cards
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
            
            recipes.forEach(recipe => {
                const card = createRecipeCard(recipe);
                grid.appendChild(card);
            });
            
            recipeResultsContainer.appendChild(grid);
            
            // Scroll to results
            recipeResultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            // Show notification with count
            showVoiceNotification(`📋 Found ${recipes.length} recipes! Scroll down to see them.`, 'success');
            
            // If there's a main script that handles recipe display, trigger it
            if (window.displayRecipes) {
                window.displayRecipes(recipes);
            }
        }
    }
    
    function displayVideoResults(videos) {
        console.log('🎥 Displaying', videos.length, 'videos');
        
        // If on home page and video results container exists, use it
        const videoResultsContainer = document.getElementById('video-results');
        if (videoResultsContainer) {
            // Clear existing results
            videoResultsContainer.innerHTML = '';
            
            // Add title
            const title = document.createElement('h2');
            title.className = 'text-2xl font-bold mb-4 text-charcoal';
            title.textContent = `Found ${videos.length} Video${videos.length !== 1 ? 's' : ''}`;
            videoResultsContainer.appendChild(title);
            
            // Create video cards
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
            
            videos.forEach((video, index) => {
                const card = createVideoCard(video, index + 1);
                grid.appendChild(card);
            });
            
            videoResultsContainer.appendChild(grid);
            
            // Scroll to results
            videoResultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            // Show notification with count
            showVoiceNotification(`📹 Found ${videos.length} videos! Scroll down to see them.`, 'success');
            
            // If there's a main script that handles video display, trigger it
            if (window.displayVideos) {
                window.displayVideos(videos);
            }
        }
    }
    
    function createRecipeCard(recipe) {
        const card = document.createElement('div');
        card.className = 'recipe-card bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition cursor-pointer';
        card.onclick = () => window.location.href = `/recipe/${recipe.id}`;
        
        card.innerHTML = `
            <img src="${recipe.image || '/static/images/default-recipe.jpg'}" 
                 alt="${recipe.title}" 
                 class="w-full h-48 object-cover">
            <div class="p-4">
                <h3 class="font-bold text-lg mb-2 text-charcoal">${recipe.title}</h3>
                <div class="flex items-center gap-4 text-sm text-gray-600">
                    ${recipe.readyInMinutes ? `<span>⏱️ ${recipe.readyInMinutes} min</span>` : ''}
                    ${recipe.servings ? `<span>🍽️ ${recipe.servings} servings</span>` : ''}
                </div>
            </div>
        `;
        
        return card;
    }
    
    function createVideoCard(video, index) {
        const card = document.createElement('div');
        card.className = 'video-card bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition cursor-pointer';
        card.onclick = () => window.location.href = `/video/${video.video_id}`;
        
        card.innerHTML = `
            <img src="${video.thumbnail}" 
                 alt="${video.title}" 
                 class="w-full h-48 object-cover">
            <div class="p-4">
                <div class="text-xs font-bold text-copper mb-2">RESULT #${index}</div>
                <h3 class="font-bold text-lg mb-2 text-charcoal line-clamp-2">${video.title}</h3>
                <p class="text-sm text-gray-600 mb-2">${video.channel || 'YouTube'}</p>
                ${video.duration ? `<span class="text-xs text-gray-500">⏱️ ${video.duration}</span>` : ''}
            </div>
        `;
        
        return card;
    }
    
    async function playServerAudio(audioB64) {
        if (!audioB64 || !audioContext) {
            console.error('❌ No audio data or context');
            return;
        }
        
        try {
            // Update to speaking state
            updateMicButtonState('speaking');
            showVoiceNotification('🔊 Speaking...', 'success');
            
            // Decode base64 to audio buffer
            const binaryString = atob(audioB64);
            const audioData = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                audioData[i] = binaryString.charCodeAt(i);
            }
            
            // Resume audio context if suspended
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            // Decode and play
            const audioBuffer = await audioContext.decodeAudioData(audioData.buffer);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            
            currentAudioSource = source;
            
            source.onended = () => {
                console.log('✅ TTS audio finished');
                currentAudioSource = null;
                window.globalVoiceControl.isSpeaking = false;
                updateMicButtonState('active');
                // Process next in queue
                setTimeout(() => processVoiceQueue(), 300);
            };
            
            source.start(0);
            console.log('🔊 Playing TTS audio');
            
        } catch (error) {
            console.error('❌ Audio playback error:', error);
            window.globalVoiceControl.isSpeaking = false;
            updateMicButtonState('active');
            setTimeout(() => processVoiceQueue(), 300);
        }
    }
    
    // ========================================
    // CENTRALIZED TEXT-TO-SPEECH MANAGER (SERVER-SIDE)
    // ========================================
    
    function speakText(text, priority = 'normal') {
        if (!text) return;
        
        console.log(`🔊 Voice request: "${text}" (Priority: ${priority})`);
        
        // High priority: Clear everything
        if (priority === 'high') {
            window.globalVoiceControl.speechQueue = [];
            if (currentAudioSource) {
                currentAudioSource.stop();
                currentAudioSource = null;
            }
            window.globalVoiceControl.isSpeaking = false;
            window.globalVoiceControl.currentUtterance = null;
            updateMicButtonState('listening');
        }
        
        // Add to queue
        window.globalVoiceControl.speechQueue.push({ text, priority });
        
        // Process queue if not already speaking
        if (!window.globalVoiceControl.isSpeaking) {
            processVoiceQueue();
        }
    }
    
    function processVoiceQueue() {
        // Check if queue is empty
        if (window.globalVoiceControl.speechQueue.length === 0) {
            window.globalVoiceControl.isSpeaking = false;
            window.globalVoiceControl.currentUtterance = null;
            console.log('✅ Voice queue empty, resuming recognition');
            updateMicButtonState('active');
            resumeRecognitionAfterSpeech();
            return;
        }
        
        // Mark as speaking
        window.globalVoiceControl.isSpeaking = true;
        updateMicButtonState('generating');
        
        // Pause recognition to prevent echo
        pauseRecognitionForSpeech();
        
        // Get next speech from queue
        const { text, priority } = window.globalVoiceControl.speechQueue.shift();
        
        // Send TTS request to server
        if (voiceSocket && voiceSocket.connected) {
            voiceSocket.emit('generate_tts', { text });
            console.log('📤 TTS request sent to server');
            showVoiceNotification('🎙️ Generating speech...', 'info');
        } else {
            console.error('❌ Socket not connected, cannot generate TTS');
            window.globalVoiceControl.isSpeaking = false;
            updateMicButtonState('active');
            setTimeout(() => processVoiceQueue(), 300);
        }
    }
    
    function pauseRecognitionForSpeech() {
        if (continuousRecognition && window.globalVoiceControl.isActive) {
            try {
                continuousRecognition.stop();
                console.log('⏸️ Recognition paused for speech');
            } catch (e) {
                console.log('⚠️ Could not pause recognition');
            }
        }
    }
    
    function resumeRecognitionAfterSpeech() {
        setTimeout(() => {
            if (window.globalVoiceControl.isActive && !window.globalVoiceControl.isSpeaking) {
                try {
                    continuousRecognition.start();
                    console.log('▶️ Recognition resumed');
                } catch (e) {
                    console.log('⚠️ Recognition already active');
                }
            }
        }, COOLDOWN_PERIOD);
    }
    
    function stopAllVoices() {
        console.log('🛑 Stopping all voices');
        
        // Clear the queue
        window.globalVoiceControl.speechQueue = [];
        
        // Stop current audio source
        if (currentAudioSource) {
            try {
                currentAudioSource.stop();
            } catch (e) {
                // Already stopped
            }
            currentAudioSource = null;
        }
        
        // Reset state
        window.globalVoiceControl.isSpeaking = false;
        window.globalVoiceControl.currentUtterance = null;
        
        // Resume recognition
        resumeRecognitionAfterSpeech();
        
        showVoiceNotification('🤫 Voice stopped', 'info');
    }
    
    function scrollToSection(sectionId) {
        // Try multiple strategies to find the section
        let element = null;
        
        // Strategy 1: Direct ID match
        element = document.getElementById(sectionId);
        
        // Strategy 2: ID contains the section name (case-insensitive)
        if (!element) {
            element = document.querySelector(`[id*="${sectionId}" i]`);
        }
        
        // Strategy 3: Class contains the section name
        if (!element) {
            element = document.querySelector(`[class*="${sectionId}" i]`);
        }
        
        // Strategy 4: Look for headings with matching text
        if (!element) {
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            for (const heading of headings) {
                if (heading.textContent.toLowerCase().includes(sectionId.toLowerCase())) {
                    element = heading;
                    break;
                }
            }
        }
        
        // Strategy 5: Look for sections with data attributes
        if (!element) {
            element = document.querySelector(`[data-section="${sectionId}"]`);
        }
        
        // Strategy 6: Look for specific recipe/video sections
        if (!element && sectionId === 'ingredients') {
            const patterns = [
                '.ingredients-section',
                '.recipe-ingredients', 
                '#ingredients-list',
                '[class*="ingredient"]'
            ];
            for (const pattern of patterns) {
                element = document.querySelector(pattern);
                if (element) break;
            }
        }
        
        if (!element && sectionId === 'instructions') {
            const patterns = [
                '.instructions-section',
                '.recipe-steps',
                '.cooking-steps',
                '#instructions-list',
                '[class*="instruction"]',
                '[class*="steps"]'
            ];
            for (const pattern of patterns) {
                element = document.querySelector(pattern);
                if (element) break;
            }
        }
        
        if (!element && sectionId === 'nutrition') {
            const patterns = [
                '.nutrition-section',
                '.nutritional-info',
                '#nutrition-facts',
                '[class*="nutrition"]'
            ];
            for (const pattern of patterns) {
                element = document.querySelector(pattern);
                if (element) break;
            }
        }
        
        // Scroll to element if found
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log('✅ Scrolled to section:', sectionId);
            
            // Add a highlight effect
            element.style.transition = 'background-color 0.5s';
            const originalBg = element.style.backgroundColor;
            element.style.backgroundColor = 'rgba(237, 137, 54, 0.1)'; // Light orange highlight
            setTimeout(() => {
                element.style.backgroundColor = originalBg;
            }, 2000);
            
            return true;
        }
        
        console.log('❌ Section not found:', sectionId);
        return false;
    }
    
    function showContextualHelp() {
        const page = window.globalVoiceControl.currentPage;
        let helpText = '';
        
        switch (page) {
            case 'recipe-detail':
                helpText = 'On this recipe page, you can say: Read ingredients, Read instructions, Read step 1, Next step, Previous step, Repeat step, Complete step 2, Increase servings, Start timer for 10 minutes, Check ingredient 1, Convert 1 cup to ml, Read nutrition, Save recipe, Print recipe, Scroll to ingredients, or Go back.';
                break;
            case 'video-detail':
                helpText = 'On this video page, you can say: Play video, Pause video, Stop video, Volume up, Volume down, Mute, Unmute, Fullscreen, Speed normal, Speed 1.5x, Read title, Read description, Read ingredients, Read steps, Next step, Previous step, Repeat step, Save video, Share video, Download recipe, Open on YouTube, or Go back.';
                break;
            case 'profile':
                helpText = 'On your profile page, you can say: Read stats, Read achievements, Scroll to preferences, Scroll to activity, Save profile, or Go back.';
                break;
            default:
                helpText = 'You can say: Go to profile, Search recipes, Search videos, Scroll down, Scroll up, Go back, or Logout.';
        }
        
        speakText(helpText);
        showVoiceNotification('💡 Voice Commands Available', 'info');
    }
    
    // ========================================
    // PAGE-SPECIFIC ACTIONS
    // ========================================
    
    function readIngredients() {
        const ingredientsSection = document.querySelector('[id*="ingredient"], [class*="ingredient"]');
        if (ingredientsSection) {
            const items = ingredientsSection.querySelectorAll('li, .ingredient-item');
            if (items.length > 0) {
                const ingredientsList = Array.from(items).map(item => item.textContent.trim()).join(', ');
                speakText(`The ingredients are: ${ingredientsList}`);
            } else {
                speakText('Ingredients section found but no items listed');
            }
        } else {
            speakText('Could not find ingredients section');
        }
    }
    
    function readInstructions() {
        const instructionsSection = document.querySelector('[id*="instruction"], [id*="steps"], [class*="instruction"]');
        if (instructionsSection) {
            const steps = instructionsSection.querySelectorAll('li, .step, [class*="step"]');
            if (steps.length > 0) {
                speakText(`There are ${steps.length} steps. Say "read step" followed by a number to hear a specific step.`);
            } else {
                speakText('Instructions section found but no steps listed');
            }
        } else {
            speakText('Could not find instructions section');
        }
    }
    
    function readStep(stepNumber) {
        const instructionsSection = document.querySelector('[id*="instruction"], [id*="steps"], [class*="instruction"]');
        if (instructionsSection) {
            const steps = instructionsSection.querySelectorAll('li, .step, [class*="step"], .step-item');
            if (stepNumber > 0 && stepNumber <= steps.length) {
                const stepText = steps[stepNumber - 1].textContent.trim();
                speakText(`Step ${stepNumber}: ${stepText}`);
                steps[stepNumber - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Track current step
                currentStepNumber = stepNumber;
                console.log(`📖 [STEP TRACKING] Current step set to: ${currentStepNumber}`);
                
                // Visual highlight
                showVoiceNotification(`📝 Step ${stepNumber}`, 'info');
            } else {
                speakText(`There is no step ${stepNumber}. There are only ${steps.length} steps.`);
                showVoiceNotification(`❌ Invalid step number`, 'error');
            }
        } else {
            speakText('Could not find instructions section');
            showVoiceNotification('❌ No instructions found', 'error');
        }
    }
    
    // Read next step in sequence
    function readNextStep() {
        const instructionsSection = document.querySelector('[id*="instruction"], [id*="steps"], [class*="instruction"]');
        if (instructionsSection) {
            const steps = instructionsSection.querySelectorAll('li, .step, [class*="step"], .step-item');
            
            if (steps.length === 0) {
                speakText('No instructions found');
                return;
            }
            
            // If no current step, start from step 1
            if (currentStepNumber === 0) {
                readStep(1);
                return;
            }
            
            // Move to next step
            const nextStep = currentStepNumber + 1;
            if (nextStep <= steps.length) {
                readStep(nextStep);
            } else {
                speakText('You have reached the last step. Recipe is complete!');
                showVoiceNotification('🎉 Recipe Complete!', 'success');
                currentStepNumber = steps.length; // Stay at last step
            }
        } else {
            speakText('Could not find instructions section');
        }
    }
    
    // Read previous step in sequence
    function readPreviousStep() {
        const instructionsSection = document.querySelector('[id*="instruction"], [id*="steps"], [class*="instruction"]');
        if (instructionsSection) {
            const steps = instructionsSection.querySelectorAll('li, .step, [class*="step"], .step-item');
            
            if (steps.length === 0) {
                speakText('No instructions found');
                return;
            }
            
            // If no current step or at step 1, can't go back
            if (currentStepNumber <= 1) {
                speakText('You are already at the first step');
                showVoiceNotification('ℹ️ First step', 'info');
                return;
            }
            
            // Move to previous step
            const prevStep = currentStepNumber - 1;
            readStep(prevStep);
        } else {
            speakText('Could not find instructions section');
        }
    }
    
    // Repeat current step
    function repeatCurrentStep() {
        if (currentStepNumber === 0) {
            speakText('No step has been read yet. Say "read step 1" to start.');
            showVoiceNotification('ℹ️ No current step', 'info');
            return;
        }
        
        const instructionsSection = document.querySelector('[id*="instruction"], [id*="steps"], [class*="instruction"]');
        if (instructionsSection) {
            const steps = instructionsSection.querySelectorAll('li, .step, [class*="step"], .step-item');
            if (currentStepNumber > 0 && currentStepNumber <= steps.length) {
                const stepText = steps[currentStepNumber - 1].textContent.trim();
                speakText(`Repeating step ${currentStepNumber}: ${stepText}`);
                steps[currentStepNumber - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                showVoiceNotification(`🔄 Repeating Step ${currentStepNumber}`, 'info');
            }
        } else {
            speakText('Could not find instructions section');
        }
    }
    
    // New recipe-specific functions
    function completeStepByNumber(stepNumber) {
        const steps = document.querySelectorAll('.step-item');
        if (stepNumber > 0 && stepNumber <= steps.length) {
            const step = steps[stepNumber - 1];
            const button = step.querySelector('.complete-step');
            if (button) {
                button.click();
                speakText(`Step ${stepNumber} marked as complete`);
                showVoiceNotification(`✅ Step ${stepNumber} completed`, 'success');
            }
        } else {
            speakText(`There is no step ${stepNumber}`);
        }
    }
    
    function nextRecipeStep() {
        const activeStep = document.querySelector('.step-item.active');
        if (activeStep) {
            const completeBtn = activeStep.querySelector('.complete-step');
            if (completeBtn) {
                completeBtn.click();
                speakText('Moving to next step');
            }
        } else {
            speakText('No active step found');
        }
    }
    
    function previousRecipeStep() {
        const steps = document.querySelectorAll('.step-item');
        const activeStep = document.querySelector('.step-item.active');
        if (activeStep) {
            const currentIndex = Array.from(steps).indexOf(activeStep);
            if (currentIndex > 0) {
                steps[currentIndex].classList.remove('active');
                steps[currentIndex - 1].classList.add('active');
                steps[currentIndex - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                speakText(`Going back to step ${currentIndex}`);
            } else {
                speakText('Already at the first step');
            }
        }
    }
    
    function scaleRecipeUp(speak = true) {
        const scaleUpBtn = document.getElementById('scale-up');
        if (scaleUpBtn) {
            scaleUpBtn.click();
            if (speak) {
                const servings = document.getElementById('serving-count')?.textContent;
                speakText(`Increased to ${servings} servings`);
                showVoiceNotification(`📈 Scaled to ${servings} servings`, 'success');
            }
        }
    }
    
    function scaleRecipeDown(speak = true) {
        const scaleDownBtn = document.getElementById('scale-down');
        if (scaleDownBtn) {
            scaleDownBtn.click();
            if (speak) {
                const servings = document.getElementById('serving-count')?.textContent;
                speakText(`Decreased to ${servings} servings`);
                showVoiceNotification(`📉 Scaled to ${servings} servings`, 'info');
            }
        }
    }
    
    function setServings(count) {
        const currentServings = parseInt(document.getElementById('serving-count')?.textContent || 4);
        const diff = count - currentServings;
        
        if (diff > 0) {
            for (let i = 0; i < diff; i++) {
                scaleRecipeUp(false); // Don't speak for each increment
            }
        } else if (diff < 0) {
            for (let i = 0; i < Math.abs(diff); i++) {
                scaleRecipeDown(false); // Don't speak for each decrement
            }
        }
        
        // Emit event for recipe detail page to update
        if (window.voiceSocket) {
            window.voiceSocket.emit('serving_size_changed', { servings: count });
        }
        
        // Also trigger a custom event that the page can listen to
        window.dispatchEvent(new CustomEvent('servingUpdated', { detail: { servings: count } }));
        
        // Speak once at the end with final count
        speakText(`Recipe scaled to ${count} servings`);
    }
    
    function startRecipeTimer(minutes) {
        console.log(`⏱️ [TIMER DEBUG] Attempting to start timer for ${minutes} minutes`);
        
        const timerPresets = document.querySelectorAll('.timer-preset');
        console.log(`⏱️ [TIMER DEBUG] Found ${timerPresets.length} timer preset buttons`);
        
        const matchingPreset = Array.from(timerPresets).find(btn => 
            parseInt(btn.dataset.minutes) === minutes
        );
        
        if (matchingPreset) {
            console.log(`⏱️ [TIMER DEBUG] Found matching preset for ${minutes} minutes, clicking it`);
            matchingPreset.click();
        } else {
            console.log(`⏱️ [TIMER DEBUG] No matching preset found for ${minutes} minutes`);
        }
        
        const startBtn = document.getElementById('timer-start');
        console.log(`⏱️ [TIMER DEBUG] Timer start button exists: ${!!startBtn}`);
        
        if (startBtn) {
            console.log('⏱️ [TIMER DEBUG] Clicking timer start button');
            startBtn.click();
            speakText(`Timer started for ${minutes} minutes`);
            showVoiceNotification(`⏱️ Timer: ${minutes} min`, 'success');
        } else {
            console.error('⏱️ [TIMER DEBUG] Timer start button not found on this page');
            speakText('Timer not available on this page');
            showVoiceNotification('❌ Timer not available', 'error');
        }
    }
    
    function pauseRecipeTimer() {
        const pauseBtn = document.getElementById('timer-pause');
        if (pauseBtn) {
            pauseBtn.click();
            speakText('Timer paused');
            showVoiceNotification('⏸️ Timer paused', 'info');
        }
    }
    
    function resetRecipeTimer() {
        const resetBtn = document.getElementById('timer-reset');
        if (resetBtn) {
            resetBtn.click();
            speakText('Timer reset');
            showVoiceNotification('🔄 Timer reset', 'info');
        }
    }
    
    function checkIngredient(index) {
        const checkbox = document.getElementById(`ingredient-${index - 1}`);
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
            speakText(checkbox.checked ? `Ingredient ${index} checked` : `Ingredient ${index} unchecked`);
        } else {
            speakText(`Ingredient ${index} not found`);
        }
    }
    
    function clearAllIngredients() {
        const clearBtn = document.getElementById('clear-checked');
        if (clearBtn) {
            clearBtn.click();
            speakText('All ingredients unchecked');
            showVoiceNotification('🗑️ Ingredients cleared', 'info');
        }
    }
    
    function handleVoiceConversion(cmd) {
        // Parse conversion command: "convert 1 cup to ml"
        const match = cmd.match(/convert\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|into)\s+(\w+)/i);
        if (match) {
            const [, amount, fromUnit, toUnit] = match;
            
            const amountInput = document.getElementById('convert-amount');
            const fromSelect = document.getElementById('convert-from');
            const toSelect = document.getElementById('convert-to');
            const convertBtn = document.getElementById('convert-btn');
            
            if (amountInput && fromSelect && toSelect && convertBtn) {
                amountInput.value = amount;
                fromSelect.value = fromUnit.toLowerCase();
                toSelect.value = toUnit.toLowerCase();
                convertBtn.click();
                
                setTimeout(() => {
                    const result = document.getElementById('conversion-result')?.textContent;
                    if (result) {
                        speakText(`${amount} ${fromUnit} equals ${result}`);
                    }
                }, 500);
            }
        } else {
            speakText('Please specify the conversion in the format: convert amount unit to unit');
        }
    }
    
    function readRecipeTitle() {
        const title = document.getElementById('recipe-title')?.textContent;
        if (title) {
            speakText(`The recipe is: ${title}`);
        }
    }
    
    function readNutrition() {
        const calories = document.getElementById('calories-value')?.textContent;
        const protein = document.getElementById('protein-value')?.textContent;
        const carbs = document.getElementById('carbs-value')?.textContent;
        const fat = document.getElementById('fat-value')?.textContent;
        
        if (calories && protein && carbs && fat) {
            speakText(`Nutritional information: ${calories} calories, ${protein} protein, ${carbs} carbohydrates, ${fat} fat`);
        } else {
            speakText('Nutritional information not available');
        }
    }
    
    function startVoiceGuide() {
        const voiceBtn = document.getElementById('voice-nav');
        if (voiceBtn && !voiceBtn.classList.contains('bg-red-500')) {
            voiceBtn.click();
            speakText('Starting voice guided cooking');
        }
    }
    
    function stopVoiceGuide() {
        const voiceBtn = document.getElementById('voice-nav');
        if (voiceBtn && voiceBtn.classList.contains('bg-red-500')) {
            voiceBtn.click();
            speakText('Stopping voice guide');
        }
    }
    
    // Video-specific functions
    function readVideoTitle() {
        const titleElement = document.querySelector('h1, .video-title, [class*="title"]');
        if (titleElement) {
            speakText(`The video title is: ${titleElement.textContent.trim()}`);
        }
    }
    
    function readVideoDescription() {
        const descElement = document.querySelector('.prose p, [class*="description"]');
        if (descElement) {
            const desc = descElement.textContent.trim();
            speakText(desc.substring(0, 300) + (desc.length > 300 ? '...' : ''));
        } else {
            speakText('Description not available');
        }
    }
    
    function readVideoIngredients() {
        const ingredientsSection = document.querySelector('.ingredient-tag');
        if (ingredientsSection) {
            const ingredients = document.querySelectorAll('.ingredient-tag');
            const ingredientsList = Array.from(ingredients).map(tag => tag.textContent.trim()).join(', ');
            speakText(`The ingredients are: ${ingredientsList}`);
        } else {
            speakText('No ingredients listed for this video');
        }
    }
    
    function readVideoSteps() {
        const stepsSection = document.querySelector('.step-card');
        if (stepsSection) {
            const steps = document.querySelectorAll('.step-card');
            speakText(`There are ${steps.length} steps. Say "read step" followed by a number to hear a specific step.`);
        } else {
            speakText('No recipe steps listed for this video');
        }
    }
    
    function readVideoStep(stepNumber) {
        const steps = document.querySelectorAll('.step-card');
        if (stepNumber > 0 && stepNumber <= steps.length) {
            const stepText = steps[stepNumber - 1].textContent.trim();
            speakText(`Step ${stepNumber}: ${stepText}`);
            steps[stepNumber - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Track current step
            currentStepNumber = stepNumber;
            console.log(`📖 [STEP TRACKING] Current step set to: ${currentStepNumber}`);
            
            // Visual highlight
            showVoiceNotification(`📝 Step ${stepNumber}`, 'info');
        } else {
            speakText(`There is no step ${stepNumber}. There are only ${steps.length} steps.`);
            showVoiceNotification(`❌ Invalid step number`, 'error');
        }
    }
    
    function saveVideo() {
        const saveButton = document.querySelector('button[onclick*="saveToFavorites"]');
        if (saveButton) {
            saveButton.click();
            speakText('Video saved to favorites');
            showVoiceNotification('💾 Video saved!', 'success');
        } else {
            speakText('Save button not found');
        }
    }
    
    function shareVideo() {
        const shareButton = document.querySelector('button[onclick*="shareVideo"]');
        if (shareButton) {
            shareButton.click();
            speakText('Opening share options');
        } else {
            speakText('Share button not found');
        }
    }
    
    function downloadRecipe() {
        const downloadButton = document.querySelector('button[onclick*="downloadRecipe"]');
        if (downloadButton) {
            downloadButton.click();
            speakText('Downloading recipe');
            showVoiceNotification('📥 Recipe downloading', 'success');
        } else {
            speakText('Download button not found');
        }
    }
    
    function saveVideoNotes() {
        const saveNotesButton = document.querySelector('button[onclick*="saveNotes"]');
        if (saveNotesButton) {
            saveNotesButton.click();
        } else {
            speakText('Save notes button not found');
        }
    }
    
    function openOnYouTube() {
        const youtubeLink = document.querySelector('a[href*="youtube.com"]');
        if (youtubeLink) {
            youtubeLink.click();
            speakText('Opening on YouTube');
        } else {
            speakText('YouTube link not found');
        }
    }
    
    function addToPlaylist() {
        const playlistButton = document.querySelector('button[onclick*="addToPlaylist"]');
        if (playlistButton) {
            playlistButton.click();
        } else {
            speakText('Playlist feature coming soon');
        }
    }
    
    function setReminder() {
        const reminderButton = document.querySelector('button[onclick*="setReminder"]');
        if (reminderButton) {
            reminderButton.click();
        } else {
            speakText('Reminder feature coming soon');
        }
    }
    
    function readProfileStats() {
        const statsSection = document.querySelector('[id*="stats"], [class*="statistics"]');
        if (statsSection) {
            const statCards = statsSection.querySelectorAll('.stat-card, [class*="stat"]');
            const stats = Array.from(statCards).map(card => {
                const label = card.querySelector('p, .label, [class*="label"]')?.textContent.trim();
                const value = card.querySelector('h4, .value, [class*="value"]')?.textContent.trim();
                return `${label}: ${value}`;
            }).join(', ');
            speakText(`Your stats are: ${stats}`);
        }
    }
    
    function readAchievements() {
        const achievementsSection = document.querySelector('[id*="achievement"], [class*="achievement"]');
        if (achievementsSection) {
            const badges = achievementsSection.querySelectorAll('.badge, [class*="badge"]');
            speakText(`You have earned ${badges.length} achievements. Scroll to achievements section to see them.`);
        }
    }
    
    function saveRecipe() {
        const saveButton = document.querySelector('[id*="save"], button:contains("Save"), button:contains("Favorite")');
        if (saveButton) {
            saveButton.click();
            speakText('Recipe saved to favorites');
            showVoiceNotification('💾 Recipe saved!', 'success');
        } else {
            speakText('Save button not found');
        }
    }
    
    function saveProfile() {
        const saveButton = document.querySelector('#save-profile, button:contains("Save")');
        if (saveButton) {
            saveButton.click();
            speakText('Profile changes saved');
            showVoiceNotification('💾 Profile saved!', 'success');
        } else {
            speakText('Save button not found');
        }
    }
    
    // ========================================
    // CONVERSATION CONTEXT PERSISTENCE
    // ========================================
    
    function saveConversationContext() {
        try {
            // Keep only last 20 items
            const context = window.globalVoiceControl.conversationContext.slice(-20);
            sessionStorage.setItem('voiceConversationContext', JSON.stringify(context));
        } catch (e) {
            console.log('Could not save context:', e);
        }
    }
    
    function loadConversationContext() {
        try {
            const stored = sessionStorage.getItem('voiceConversationContext');
            if (stored) {
                window.globalVoiceControl.conversationContext = JSON.parse(stored);
                console.log('📥 Loaded conversation context:', window.globalVoiceControl.conversationContext.length, 'items');
            }
        } catch (e) {
            console.log('Could not load context:', e);
        }
    }
    
    // ========================================
    // NAVIGATION LISTENER
    // ========================================
    
    function setupNavigationListener() {
        // Listen for popstate (back/forward)
        window.addEventListener('popstate', () => {
            const newPage = detectCurrentPage();
            if (newPage !== window.globalVoiceControl.currentPage) {
                window.globalVoiceControl.currentPage = newPage;
                console.log('📄 Page changed to:', newPage);
                setupPageSpecificHandlers(newPage);
            }
        });
    }
    
    function setupPageSpecificHandlers(page) {
        console.log('🔧 Setting up handlers for:', page);
        
        // Initialize YouTube Player API on video pages
        if (page === 'video-detail') {
            console.log('📺 Initializing YouTube Player for auto-mute');
            initYouTubePlayerAPI();
        }
    }
    
    // ========================================
    // INITIALIZATION
    // ========================================
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeVoiceControl);
    } else {
        initializeVoiceControl();
    }
    
    // ========================================
    // CLEANUP ON PAGE UNLOAD
    // ========================================
    
    window.addEventListener('beforeunload', () => {
        console.log('🧹 Cleaning up voice control system');
        stopAllVoices();
        if (continuousRecognition) {
            continuousRecognition.stop();
        }
    });
    
    // ========================================
    // PUBLIC API FOR DEBUGGING & INTEGRATION
    // ========================================
    
    window.voiceControlAPI = {
        speak: speakText,
        stop: stopAllVoices,
        notify: showVoiceNotification,
        toggle: toggleGlobalVoice,
        isActive: () => window.globalVoiceControl.isActive,
        isSpeaking: () => window.globalVoiceControl.isSpeaking,
        getQueueLength: () => window.globalVoiceControl.speechQueue.length,
        clearQueue: () => {
            window.globalVoiceControl.speechQueue = [];
            console.log('🗑️ Queue cleared');
        }
    };
    
    // Legacy compatibility
    window.globalVoiceControl.speak = speakText;
    window.globalVoiceControl.notify = showVoiceNotification;
    window.globalVoiceControl.toggle = toggleGlobalVoice;
    window.globalVoiceControl.stop = stopAllVoices;
    
    console.log('✅ Global Voice Control Initialized (Singleton Mode)');
    console.log('💡 Use voiceControlAPI for debugging (e.g., voiceControlAPI.stop())');
    
})();

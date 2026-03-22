document.addEventListener('DOMContentLoaded', () => {
    // --- WebSocket Connection & DOM Elements ---
    const socket = io();
    const micButton = document.getElementById('mic-button');
    const micStatus = document.querySelector('.mic-status');
    const chatContainer = document.getElementById('chat-container');
    const statusIndicator = document.getElementById('status-indicator');
    const videoResults = document.getElementById('video-results');
    const videoPlayerContainer = document.getElementById('video-player-container');
    const timersContainer = document.getElementById('timers-container');
    const conversionsContainer = document.getElementById('conversions-container');
    const substitutionsContainer = document.getElementById('substitutions-container');

    // Main view and sidebar elements
    const mainView = document.getElementById('main-view');
    const conversationView = document.getElementById('conversation-view');

    // Status bar elements
    const statusBar = document.getElementById('status-bar');
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');

    // Settings modal elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const settingsForm = document.getElementById('settings-form');
    
    // Settings values
    let userSettings = {
        ttsVoice: 'default',
        ttsSpeed: 1.0,
        ttsVolume: 80,
        timerNotifications: true,
        soundEffects: true
    };

    // ===== VIEW ROUTER SYSTEM =====
    let currentView = 'conversation';
    const viewHistory = ['conversation'];

    /**
     * Main View Router Function
     * Switches between different views in the main content area
     */
    function switchView(viewName, data = null) {
        console.log(`switchView called with: ${viewName}`);
        console.log(`Current view: ${currentView}`);
        
        // Hide all views
        const allViews = mainView.querySelectorAll('.view-container');
        console.log(`Found ${allViews.length} view containers`);
        allViews.forEach(view => {
            view.classList.remove('active-view');
            console.log(`Removed active-view from:`, view.id || view.className);
        });
        
        // Track history
        if (viewName !== currentView) {
            viewHistory.push(viewName);
            currentView = viewName;
            console.log(`Updated currentView to: ${currentView}`);
        }
        
        // Route to appropriate view
        switch(viewName) {
            case 'conversation':
                console.log('Routing to showConversationView()');
                showConversationView();
                break;
            case 'recipeSearch':
                showRecipeSearchView();
                break;
            case 'recipeResults':
                showRecipeResultsView(data);
                break;
            case 'videoSearch':
                showVideoSearchView();
                break;
            case 'unitConverter':
                showUnitConverterView();
                break;
            case 'substitutions':
                showSubstitutionsView();
                break;
            case 'myNotes':
                showMyNotesView();
                break;
            default:
                console.warn(`Unknown view: ${viewName}`);
                showConversationView();
        }
        
        console.log(`switchView completed for: ${viewName}`);
    }

    /**
     * Show Conversation View (Default)
     */
    function showConversationView() {
        console.log('showConversationView called');
        
        if (!conversationView) {
            console.error('conversationView element not found!');
            return;
        }
        
        conversationView.classList.add('active-view');
        console.log('Added active-view class to conversationView');
        
        // Manual message form should already exist in the DOM
        // Just need to ensure event listener is attached
        const manualMessageForm = document.getElementById('manual-message-form');
        const manualMessageInput = document.getElementById('manual-message-input');
        
        if (manualMessageForm && manualMessageInput) {
            // Remove any existing listeners by cloning
            const newForm = manualMessageForm.cloneNode(true);
            manualMessageForm.parentNode.replaceChild(newForm, manualMessageForm);
            
            // Get fresh references and attach listener
            const form = document.getElementById('manual-message-form');
            const input = document.getElementById('manual-message-input');
            
            if (form && input) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const message = input.value.trim();
                    if (message) {
                        updateSystemStatus('processing');
                        processCommand(message);
                        input.value = '';
                        input.focus();
                    }
                });
                console.log('Manual message form handler attached');
            }
        } else {
            console.warn('Manual message form or input not found');
            console.log('Form element:', document.getElementById('manual-message-form'));
            console.log('Input element:', document.getElementById('manual-message-input'));
        }
    }

    /**
     * Show Recipe Search View
     */
    function showRecipeSearchView() {
        const template = document.getElementById('recipe-search-view-template');
        if (!template) {
            console.error('Recipe search template not found');
            return;
        }
        
        // Clone template
        const viewContent = template.content.cloneNode(true);
        
        // Remove any previously injected dynamic views (but keep conversation view)
        const existingDynamicViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        existingDynamicViews.forEach(view => view.remove());
        
        // Append new view
        mainView.appendChild(viewContent);
        
        // Re-attach event listeners
        const recipeForm = document.getElementById('recipe-search-form');
        if (recipeForm) {
            recipeForm.addEventListener('submit', handleRecipeSearch);
        }
        
        // Get the newly added view and mark it active
        const newViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        if (newViews.length > 0) {
            newViews[newViews.length - 1].classList.add('active-view');
        }
    }

    /**
     * Show Recipe Results View
     */
    function showRecipeResultsView(recipes) {
        if (!recipes || recipes.length === 0) {
            showRecipeSearchView();
            return;
        }
        
        const template = document.getElementById('recipe-search-view-template');
        const viewContent = template.content.cloneNode(true);
        
        // Remove any previously injected dynamic views (but keep conversation view)
        const existingDynamicViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        existingDynamicViews.forEach(view => view.remove());
        
        // Append new view
        mainView.appendChild(viewContent);
        
        // Populate results
        const resultsContainer = document.getElementById('recipes-container');
        if (resultsContainer) {
            displayRecipeResults({ recipes: recipes });
        }
        
        // Re-attach form listener
        const recipeForm = document.getElementById('recipe-search-form');
        if (recipeForm) {
            recipeForm.addEventListener('submit', handleRecipeSearch);
        }
        
        // Get the newly added view and mark it active
        const newViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        if (newViews.length > 0) {
            newViews[newViews.length - 1].classList.add('active-view');
        }
    }

    /**
     * Show Video Search View
     */
    function showVideoSearchView() {
        console.log('showVideoSearchView called');
        const template = document.getElementById('video-search-view-template');
        if (!template) {
            console.error('Video search template not found');
            return;
        }
        
        const viewContent = template.content.cloneNode(true);
        
        // Remove any previously injected dynamic views (but keep conversation view)
        const existingDynamicViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        console.log('Removing existing dynamic views:', existingDynamicViews.length);
        existingDynamicViews.forEach(view => view.remove());
        
        // Append new view
        mainView.appendChild(viewContent);
        console.log('Video search view appended to mainView');
        
        // Get the newly added view and mark it active
        const newViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        console.log('New views found:', newViews.length);
        if (newViews.length > 0) {
            const newView = newViews[newViews.length - 1];
            newView.classList.add('active-view');
            console.log('Added active-view class to new video search view');
            
            // Verify critical elements exist
            setTimeout(() => {
                const youtubeForm = document.getElementById('youtube-form');
                const videoResults = document.getElementById('video-results');
                const videoPlayer = document.getElementById('video-player-container');
                
                console.log('YouTube form exists:', !!youtubeForm);
                console.log('Video results container exists:', !!videoResults);
                console.log('Video player container exists:', !!videoPlayer);
                
                // Re-attach event listeners
                if (youtubeForm) {
                    youtubeForm.addEventListener('submit', handleYoutubeSearch);
                    console.log('YouTube form submit listener attached');
                }
                
                // Re-attach video control listeners
                setupVideoControls();
            }, 50);
        }
    }

    /**
     * Show Unit Converter View
     */
    function showUnitConverterView() {
        const template = document.getElementById('unit-converter-view-template');
        if (!template) {
            console.error('Unit converter template not found');
            return;
        }
        
        const viewContent = template.content.cloneNode(true);
        
        // Remove any previously injected dynamic views (but keep conversation view)
        const existingDynamicViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        existingDynamicViews.forEach(view => view.remove());
        
        // Append new view
        mainView.appendChild(viewContent);
        
        // Re-attach event listeners
        const conversionForm = document.getElementById('conversion-form');
        if (conversionForm) {
            conversionForm.addEventListener('submit', handleConversionSubmit);
        }
        
        // Get the newly added view and mark it active
        const newViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        if (newViews.length > 0) {
            newViews[newViews.length - 1].classList.add('active-view');
        }
    }

    /**
     * Show Substitutions View
     */
    function showSubstitutionsView() {
        const template = document.getElementById('substitutions-view-template');
        if (!template) {
            console.error('Substitutions template not found');
            return;
        }
        
        const viewContent = template.content.cloneNode(true);
        
        // Remove any previously injected dynamic views (but keep conversation view)
        const existingDynamicViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        existingDynamicViews.forEach(view => view.remove());
        
        // Append new view
        mainView.appendChild(viewContent);
        
        // Get the newly added view and mark it active
        const newViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        if (newViews.length > 0) {
            newViews[newViews.length - 1].classList.add('active-view');
        }
    }

    /**
     * Show My Notes View
     */
    function showMyNotesView() {
        const template = document.getElementById('my-notes-view-template');
        if (!template) {
            console.error('My Notes template not found');
            return;
        }
        
        const viewContent = template.content.cloneNode(true);
        
        // Remove any previously injected dynamic views (but keep conversation view)
        const existingDynamicViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        existingDynamicViews.forEach(view => view.remove());
        
        // Append new view
        mainView.appendChild(viewContent);
        
        // Get the newly added view and mark it active
        const newViews = mainView.querySelectorAll('.view-container:not(#conversation-view)');
        if (newViews.length > 0) {
            newViews[newViews.length - 1].classList.add('active-view');
        }
        
        // Load notes
        loadUserNotes();
    }

    /**
     * Load User's Video Notes
     */
    async function loadUserNotes() {
        const notesContainer = document.getElementById('notes-container');
        const loadingIndicator = document.getElementById('notes-loading');
        
        if (!notesContainer) {
            console.error('Notes container not found');
            return;
        }
        
        // Show loading
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        notesContainer.innerHTML = '';
        
        try {
            const response = await fetch('/api/video/notes/all');
            const data = await response.json();
            
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            
            if (data.success && data.notes && data.notes.length > 0) {
                displayNotes(data.notes);
            } else {
                notesContainer.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: #999;">
                        <i class="fas fa-sticky-note" style="font-size: 4rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                        <h3 style="color: #666; margin-bottom: 0.5rem;">No Notes Yet</h3>
                        <p style="color: #999;">Start watching recipe videos and save notes to see them here!</p>
                        <button onclick="switchView('videoSearch')" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #ED8936 0%, #68D391 100%); color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">
                            <i class="fas fa-video"></i> Browse Recipe Videos
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            notesContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #e74c3c;">
                    <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3>Error Loading Notes</h3>
                    <p>Failed to load your notes. Please try again.</p>
                    <button onclick="loadUserNotes()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #ED8936; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    /**
     * Display Notes in the Container
     */
    function displayNotes(notes) {
        const notesContainer = document.getElementById('notes-container');
        if (!notesContainer) return;
        
        notesContainer.innerHTML = notes.map(note => `
            <div class="note-card" style="background: white; border-radius: 1rem; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid #FFC107; transition: all 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; gap: 1rem;">
                    <div style="flex: 1;">
                        <h3 style="color: #2D3748; font-size: 1.125rem; font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-video" style="color: #ED8936;"></i>
                            ${note.title}
                        </h3>
                        <p style="color: #999; font-size: 0.875rem; margin: 0;">
                            <i class="fas fa-clock"></i> 
                            ${new Date(note.updated_at).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="editNote('${note.video_id}')" 
                                style="padding: 0.5rem 1rem; background: #68D391; color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; font-weight: 600;"
                                title="Edit Note">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteNote('${note.video_id}')" 
                                style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; font-weight: 600;"
                                title="Delete Note">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div style="background: rgba(255, 193, 7, 0.05); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                    <p style="color: #2D3748; line-height: 1.6; margin: 0; white-space: pre-wrap;">${note.notes}</p>
                </div>
                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        <a href="${note.watch_url ? note.watch_url : '/video/' + note.video_id}" 
                           style="padding: 0.5rem 1rem; background: linear-gradient(135deg, #ED8936 0%, #68D391 100%); color: white; border: none; border-radius: 0.5rem; cursor: pointer; text-decoration: none; font-weight: 600; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.5rem;"
                           target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-external-link-alt"></i> View Recipe Video
                        </a>
                </div>
            </div>
        `).join('');
    }

    /**
     * Edit Note
     */
    function editNote(videoId) {
        window.location.href = `/video/${videoId}#notes`;
    }

    /**
     * Delete Note
     */
    async function deleteNote(videoId) {
        if (!confirm('Are you sure you want to delete this note?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/video/notes/${videoId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Reload notes
                loadUserNotes();
                showToast('✅ Note deleted successfully', 'success');
            } else {
                showToast('❌ Failed to delete note', 'error');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            showToast('❌ Error deleting note', 'error');
        }
    }

    /**
     * Show Toast Notification
     */
    function showToast(message, type = 'info') {
        const colors = {
            success: '#68D391',
            error: '#ef4444',
            warning: '#FFC107',
            info: '#3b82f6'
        };
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight: 600;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Make functions globally accessible
    window.loadUserNotes = loadUserNotes;
    window.editNote = editNote;
    window.deleteNote = deleteNote;
    window.showToast = showToast;

    /**
     * Go back to previous view
     */
    function goBack() {
        if (viewHistory.length > 1) {
            viewHistory.pop(); // Remove current
            const previousView = viewHistory[viewHistory.length - 1];
            switchView(previousView);
        } else {
            switchView('conversation');
        }
    }

    // Make switchView globally accessible
    window.switchView = switchView;
    window.goBack = goBack;

    // ===== END VIEW ROUTER SYSTEM =====

    // ===== FORM HANDLERS (Reusable for views) =====
    
    function handleRecipeSearch(e) {
        e.preventDefault();
        const query = document.getElementById('recipe-query').value;
        const diet = document.getElementById('recipe-diet')?.value || '';
        const cuisine = document.getElementById('recipe-cuisine')?.value || '';
        
        let command = `Find recipes for ${query}`;
        if (diet) command += ` that are ${diet}`;
        if (cuisine) command += ` in ${cuisine} style`;
        
        console.log('Recipe search submitted:', command);
        updateSystemStatus('processing');
        processCommand(command);
    }
    
    function handleYoutubeSearch(e) {
        e.preventDefault();
        const query = document.getElementById('youtube-query').value;
        const command = `Search for ${query} recipe on YouTube`;
        console.log('YouTube search submitted:', command);
        updateSystemStatus('processing');
        processCommand(command);
    }
    
    function handleConversionSubmit(e) {
        e.preventDefault();
        const amount = document.getElementById('convert-amount').value;
        const fromUnit = document.getElementById('convert-from').value;
        const toUnit = document.getElementById('convert-to').value;
        const command = `Convert ${amount} ${fromUnit} to ${toUnit}`;
        console.log('Conversion submitted:', command);
        updateSystemStatus('processing');
        processCommand(command);
    }
    
    function setupVideoControls() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const stopVideoBtn = document.getElementById('stop-video-btn');
        
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', togglePlayPause);
        }
        if (stopVideoBtn) {
            stopVideoBtn.addEventListener('click', stopVideo);
        }
    }

    // ===== END FORM HANDLERS =====

    // Debug: Check if elements are found
    console.log('DOM Elements Check:');
    console.log('micButton:', micButton);
    console.log('micStatus:', micStatus);
    console.log('chatContainer:', chatContainer);
    console.log('statusIndicator:', statusIndicator);

    // Timer tracking for real-time countdown
    let activeTimersData = {};
    let timerUpdateInterval = null;

    // Initialize microphone status (will be called after recognition setup)
    function initializeMicrophone() {
        if (!micStatus) {
            console.error('Mic status element not found');
            return;
        }
        
        if (!recognition) {
            micStatus.textContent = 'Speech recognition not supported';
            micButton.style.opacity = '0.5';
            return;
        }
        
        micStatus.textContent = 'Click to speak';
        console.log('Microphone initialized successfully');
    }

    // ===== FEATURE 1: Status Bar Management =====
    function updateSystemStatus(state) {
        if (!statusBar || !statusIcon || !statusText) return;

        // Remove all state classes
        statusBar.className = 'status-bar';

        switch(state) {
            case 'idle':
                statusBar.classList.add('status-idle');
                statusIcon.innerHTML = '<i class="fas fa-circle"></i>';
                statusText.textContent = 'Idle - Click the mic to start';
                break;
            case 'ready':
                statusBar.classList.add('status-ready');
                statusIcon.innerHTML = '<i class="fas fa-microphone"></i>';
                statusText.textContent = 'Ready - Microphone enabled';
                break;
            case 'listening':
                statusBar.classList.add('status-listening');
                statusIcon.innerHTML = '<i class="fas fa-microphone-alt"></i>';
                statusText.textContent = 'Listening - Speak now';
                break;
            case 'processing':
                statusBar.classList.add('status-processing');
                statusIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                statusText.textContent = 'Processing - AI thinking...';
                break;
            case 'hands-free':
                statusBar.classList.add('status-ready');
                statusIcon.innerHTML = '<i class="fas fa-broadcast-tower"></i>';
                statusText.textContent = 'Hands-free Mode - Say "Hey Kitchen"';
                break;
            case 'wake-word':
                statusBar.classList.add('status-listening');
                statusIcon.innerHTML = '<i class="fas fa-ear-listen"></i>';
                statusText.textContent = 'Wake word detected - Listening for command';
                break;
            default:
                statusBar.classList.add('status-idle');
                statusIcon.innerHTML = '<i class="fas fa-circle"></i>';
                statusText.textContent = 'Idle';
        }
    }

    // ===== FEATURE 3: Settings Modal Management =====
    function loadSettings() {
        const savedSettings = localStorage.getItem('kitchenAssistantSettings');
        if (savedSettings) {
            userSettings = { ...userSettings, ...JSON.parse(savedSettings) };
        }
        
        // Apply settings to form
        if (document.getElementById('tts-voice')) {
            document.getElementById('tts-voice').value = userSettings.ttsVoice;
        }
        if (document.getElementById('tts-speed')) {
            document.getElementById('tts-speed').value = userSettings.ttsSpeed;
            document.getElementById('speed-value').textContent = userSettings.ttsSpeed.toFixed(1) + 'x';
        }
        if (document.getElementById('tts-volume')) {
            document.getElementById('tts-volume').value = userSettings.ttsVolume;
            document.getElementById('volume-value').textContent = userSettings.ttsVolume + '%';
        }
        if (document.getElementById('timer-notifications')) {
            document.getElementById('timer-notifications').checked = userSettings.timerNotifications;
        }
        if (document.getElementById('sound-effects')) {
            document.getElementById('sound-effects').checked = userSettings.soundEffects;
        }
    }

    function saveSettings(event) {
        event.preventDefault();
        
        userSettings.ttsVoice = document.getElementById('tts-voice').value;
        userSettings.ttsSpeed = parseFloat(document.getElementById('tts-speed').value);
        userSettings.ttsVolume = parseInt(document.getElementById('tts-volume').value);
        userSettings.timerNotifications = document.getElementById('timer-notifications').checked;
        userSettings.soundEffects = document.getElementById('sound-effects').checked;
        
        localStorage.setItem('kitchenAssistantSettings', JSON.stringify(userSettings));
        
        // Show confirmation
        const submitBtn = settingsForm.querySelector('.settings-button');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            closeModal();
        }, 1000);
    }

    function openModal() {
        if (settingsModal) {
            settingsModal.classList.remove('modal-hidden');
        }
    }

    function closeModal() {
        if (settingsModal) {
            settingsModal.classList.add('modal-hidden');
        }
    }

    // Settings modal event listeners
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openModal);
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    // Home button event listener
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            console.log('Home button clicked - switching to conversation view');
            switchView('conversation');
        });
    }
    
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                closeModal();
            }
        });
    }
    
    if (settingsForm) {
        settingsForm.addEventListener('submit', saveSettings);
        
        // Update range value displays
        const speedInput = document.getElementById('tts-speed');
        const volumeInput = document.getElementById('tts-volume');
        
        if (speedInput) {
            speedInput.addEventListener('input', (e) => {
                document.getElementById('speed-value').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
            });
        }
        
        if (volumeInput) {
            volumeInput.addEventListener('input', (e) => {
                document.getElementById('volume-value').textContent = e.target.value + '%';
            });
        }
    }

    // Load settings on page load
    loadSettings();

    // ===== CONVERSATION HISTORY MODAL =====
    const historyBtn = document.getElementById('history-btn');
    const historyModal = document.getElementById('history-modal');
    const historyCloseBtn = document.getElementById('history-close-btn');
    const historyContainer = document.getElementById('history-container');
    const historyFilter = document.getElementById('history-filter');
    const historyRoleFilter = document.getElementById('history-role-filter');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const exportHistoryBtn = document.getElementById('export-history-btn');
    const refreshHistoryBtn = document.getElementById('refresh-history-btn');
    
    let conversationHistory = [];
    
    // Open history modal
    function openHistoryModal() {
        if (historyModal) {
            historyModal.classList.add('active');
            loadConversationHistory();
        }
    }
    
    // Close history modal
    function closeHistoryModal() {
        if (historyModal) {
            historyModal.classList.remove('active');
        }
    }
    
    // Load conversation history from API
    async function loadConversationHistory() {
        try {
            const limit = historyFilter.value === 'all' ? 10000 : parseInt(historyFilter.value);
            historyContainer.innerHTML = '<div class="history-loading"><i class="fas fa-spinner fa-spin"></i> Loading conversation history...</div>';
            
            const response = await fetch(`/api/user/conversations?limit=${limit}`);
            const data = await response.json();
            
            if (data.success && data.conversations.length > 0) {
                conversationHistory = data.conversations;
                displayConversationHistory();
            } else {
                historyContainer.innerHTML = `
                    <div class="history-empty">
                        <i class="fas fa-inbox"></i>
                        <h3>No Conversations Yet</h3>
                        <p>Start chatting with your kitchen assistant to see your conversation history!</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading conversation history:', error);
            historyContainer.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading History</h3>
                    <p>Unable to load conversation history. Please try again.</p>
                </div>
            `;
        }
    }
    
    // Display conversation history
    function displayConversationHistory() {
        const roleFilter = historyRoleFilter.value;
        
        // Filter conversations by role if needed
        let filteredHistory = conversationHistory;
        if (roleFilter !== 'all') {
            filteredHistory = conversationHistory.filter(conv => conv.role === roleFilter);
        }
        
        // Update stats
        const totalMessages = conversationHistory.length;
        const userMessages = conversationHistory.filter(c => c.role === 'user').length;
        const aiMessages = conversationHistory.filter(c => c.role === 'assistant').length;
        
        document.getElementById('total-conversations').textContent = totalMessages;
        document.getElementById('user-messages').textContent = userMessages;
        document.getElementById('ai-messages').textContent = aiMessages;
        
        // Display messages
        if (filteredHistory.length === 0) {
            historyContainer.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-filter"></i>
                    <h3>No Messages Match Filter</h3>
                    <p>Try changing the filter to see more messages.</p>
                </div>
            `;
            return;
        }
        
        const historyHTML = filteredHistory.map(conv => {
            const timestamp = new Date(conv.timestamp);
            const timeString = timestamp.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            
            const icon = conv.role === 'user' ? 'fa-user' : 'fa-robot';
            
            return `
                <div class="history-message ${conv.role}">
                    <div class="history-avatar">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="history-bubble">
                        <div class="history-content">${escapeHtml(conv.content)}</div>
                        <div class="history-timestamp">
                            <i class="fas fa-clock"></i> ${timeString}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        historyContainer.innerHTML = historyHTML;
        
        // Scroll to bottom
        setTimeout(() => {
            historyContainer.scrollTop = historyContainer.scrollHeight;
        }, 100);
    }
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Clear conversation history
    async function clearConversationHistory() {
        if (!confirm('Are you sure you want to clear all conversation history? This action cannot be undone.')) {
            return;
        }
        
        try {
            // Clear client-side storage first
            sessionStorage.removeItem('kitchen_session_id');
            sessionStorage.removeItem('kitchen_chat_history');
            chatHistory = [];
            sessionId = null;
            
            // Clear UI
            chatContainer.innerHTML = '';
            
            const response = await fetch('/api/user/conversations', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                conversationHistory = [];
                historyContainer.innerHTML = `
                    <div class="history-empty">
                        <i class="fas fa-check-circle"></i>
                        <h3>History Cleared</h3>
                        <p>Your conversation history has been successfully cleared.</p>
                        <p class="history-empty-subtext">Deleted ${data.deleted_count || 0} conversation(s)</p>
                    </div>
                `;
                
                // Update stats
                document.getElementById('total-conversations').textContent = '0';
                document.getElementById('user-messages').textContent = '0';
                document.getElementById('ai-messages').textContent = '0';
                
                // Show success notification
                showSmartNotification(
                    `🗑️ Successfully deleted ${data.deleted_count || 0} conversation(s)! Session reset.`, 
                    'success'
                );
                
                // Reconnect to get new session
                socket.disconnect();
                setTimeout(() => socket.connect(), 500);
            } else {
                showSmartNotification(
                    '❌ Failed to clear history: ' + (data.message || 'Unknown error'),
                    'error'
                );
            }
        } catch (error) {
            console.error('Error clearing history:', error);
            showSmartNotification(
                '❌ Error clearing conversation history. Please try again.',
                'error'
            );
        }
    }
    
    // Export conversation history as JSON
    function exportConversationHistory() {
        if (conversationHistory.length === 0) {
            alert('No conversation history to export!');
            return;
        }
        
        const dataStr = JSON.stringify(conversationHistory, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `kitchen-assistant-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert('Conversation history exported successfully!');
    }
    
    // History modal event listeners
    if (historyBtn) {
        historyBtn.addEventListener('click', openHistoryModal);
    }
    
    if (historyCloseBtn) {
        historyCloseBtn.addEventListener('click', closeHistoryModal);
    }
    
    if (historyModal) {
        historyModal.addEventListener('click', (e) => {
            if (e.target === historyModal) {
                closeHistoryModal();
            }
        });
    }
    
    if (historyFilter) {
        historyFilter.addEventListener('change', displayConversationHistory);
    }
    
    if (historyRoleFilter) {
        historyRoleFilter.addEventListener('change', displayConversationHistory);
    }
    
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearConversationHistory);
    }
    
    if (exportHistoryBtn) {
        exportHistoryBtn.addEventListener('click', exportConversationHistory);
    }
    
    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener('click', loadConversationHistory);
    }

    // --- State & Setup ---
    let player; // YouTube player object
    let currentVideoTitle = '';
    let isListening = false;
    let sessionId = sessionStorage.getItem('kitchen_session_id') || null; // Persist session
    let chatHistory = JSON.parse(sessionStorage.getItem('kitchen_chat_history') || '[]'); // Persist chat
    let activeTimers = [];
    let audioContext = null;
    let isAssistantSpeaking = false;
    let currentAudioSource = null;
    let assistantMessageBubble = null;
    let backendAudioReceived = false;
    
    // Smart conversation flow state
    let videoWasPlayingBeforeSpeech = false;
    let userAudioStream = null;
    let audioAnalyzer = null;
    let silenceDetectionTimer = null;
    let isSpeechDetected = false;
    let lastSpeechTime = 0;
    
    // Hands-free mode state
    let handsFreeMode = false;
    let wakeWordDetected = false;
    let continuousRecognition = null;
    let handsFreeToggleBtn = null;
    let commandAccumulator = '';
    let commandTimeout = null;
    let isProcessingCommand = false; // Prevent duplicate processing
    const WAKE_WORDS = ['hey kitchen', 'kitchen assistant', 'hey assistant', 'ok kitchen'];
    
    // Session persistence functions
    function saveSessionToStorage() {
        if (sessionId) {
            sessionStorage.setItem('kitchen_session_id', sessionId);
        }
        sessionStorage.setItem('kitchen_chat_history', JSON.stringify(chatHistory));
        console.log('💾 Session saved to storage');
    }
    
    function restoreChatFromStorage() {
        // Restore chat messages to UI
        if (chatHistory && chatHistory.length > 0) {
            console.log(`📥 Restoring ${chatHistory.length} chat messages`);
            chatHistory.forEach(msg => {
                if (msg.role && msg.content) {
                    addMessageToChat(msg.content, msg.role);
                }
            });
            scrollToBottom();
        }
    }
    
    // Restore chat on page load
    setTimeout(() => {
        restoreChatFromStorage();
    }, 100);

    // Video control elements
    const playPauseBtn = document.getElementById('play-pause-btn');
    const stopVideoBtn = document.getElementById('stop-video-btn');
    const videoTitleSpan = document.getElementById('video-title');

    // --- YouTube Player Setup ---
    window.onYouTubeIframeAPIReady = function() {
        console.log("YouTube API Ready");
    };

    function createPlayer(videoId, title = '') {
        currentVideoTitle = title;
        videoTitleSpan.textContent = currentVideoTitle || 'Playing video...';
        
        // Show video player
        videoPlayerContainer.classList.remove('video-player-hidden');
        
        if (player) {
            player.loadVideoById(videoId);
        } else {
            player = new YT.Player('youtube-player', {
                height: '315',
                width: '100%',
                videoId: videoId,
                playerVars: { 
                    'autoplay': 1, 
                    'controls': 1,
                    'rel': 0,
                    'modestbranding': 1
                },
                events: { 
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange
                }
            });
        }
        
        // Add fullscreen button if not exists
        addFullscreenButton();
    }
    
    function addFullscreenButton() {
        // Check if fullscreen button already exists
        if (document.getElementById('video-fullscreen-btn')) return;
        
        const videoControls = document.querySelector('.video-controls');
        if (videoControls) {
            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.id = 'video-fullscreen-btn';
            fullscreenBtn.className = 'control-button';
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
            fullscreenBtn.title = 'Fullscreen';
            fullscreenBtn.onclick = showVideoFullscreen;
            
            videoControls.appendChild(fullscreenBtn);
        }
    }

    function onPlayerReady(event) {
        console.log("Player Ready");
        updatePlayPauseButton();
        
        // Set up smart conversation flow
        setupSmartConversationFlow();
    }

    function onPlayerStateChange(event) {
        updatePlayPauseButton();
        
        // Update conversation flow based on video state
        if (event.data === YT.PlayerState.PLAYING) {
            console.log('Video is playing - Smart conversation mode active');
            updateMicStatus();
        } else if (event.data === YT.PlayerState.PAUSED) {
            console.log('Video paused');
            updateMicStatus();
        }
    }
    
    // Smart conversation flow setup
    function setupSmartConversationFlow() {
        console.log('Setting up smart conversation flow for video playback');
        // The audio detection will be initialized when user clicks mic button
    }
    
    // Update mic status based on video state
    function updateMicStatus() {
        if (!micStatus) return;
        
        if (isVideoPlaying()) {
            // Add video mode visual indicator
            micButton.classList.add('video-mode');
            
            if (isListening) {
                micStatus.textContent = 'Listening (Video auto-paused)...';
                updateSystemStatus('listening');
            } else {
                micStatus.textContent = 'Click to speak (Video will pause)';
                updateSystemStatus('ready');
            }
        } else {
            // Remove video mode indicator
            micButton.classList.remove('video-mode');
            
            if (isListening) {
                micStatus.textContent = 'Listening...';
                updateSystemStatus('listening');
            } else {
                micStatus.textContent = 'Click to speak';
                updateSystemStatus('idle');
            }
        }
    }
    
    // Check if video is currently playing
    function isVideoPlaying() {
        if (!player || !player.getPlayerState) return false;
        return player.getPlayerState() === YT.PlayerState.PLAYING;
    }
    
    // Initialize audio analyzer for noise detection
    async function initAudioAnalyzer() {
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Get user microphone stream
            userAudioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            // Create analyzer
            audioAnalyzer = audioContext.createAnalyser();
            audioAnalyzer.fftSize = 2048;
            audioAnalyzer.smoothingTimeConstant = 0.8;
            
            const source = audioContext.createMediaStreamSource(userAudioStream);
            source.connect(audioAnalyzer);
            
            console.log('Audio analyzer initialized for smart conversation');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio analyzer:', error);
            return false;
        }
    }
    
    // Detect if user is speaking (vs video audio)
    function detectUserSpeech() {
        if (!audioAnalyzer) return false;
        
        const bufferLength = audioAnalyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        audioAnalyzer.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        // Threshold for detecting speech (adjust as needed)
        const SPEECH_THRESHOLD = 30; // Lower = more sensitive
        
        return average > SPEECH_THRESHOLD;
    }
    
    // Start silence detection to auto-resume video
    function startSilenceDetection() {
        clearInterval(silenceDetectionTimer);
        
        silenceDetectionTimer = setInterval(() => {
            if (!isListening) {
                clearInterval(silenceDetectionTimer);
                return;
            }
            
            const isSpeaking = detectUserSpeech();
            
            if (isSpeaking) {
                lastSpeechTime = Date.now();
                isSpeechDetected = true;
            } else if (isSpeechDetected) {
                // Check if silence duration exceeds threshold
                const silenceDuration = Date.now() - lastSpeechTime;
                const SILENCE_THRESHOLD = 1500; // 1.5 seconds of silence
                
                if (silenceDuration > SILENCE_THRESHOLD && videoWasPlayingBeforeSpeech) {
                    console.log('Silence detected - auto-resuming video');
                    // Recognition will handle the resume
                }
            }
        }, 100); // Check every 100ms
    }

    function updatePlayPauseButton() {
        if (player && player.getPlayerState) {
            const state = player.getPlayerState();
            const icon = playPauseBtn.querySelector('i');
            
            if (state === YT.PlayerState.PLAYING) {
                icon.className = 'fas fa-pause';
            } else {
                icon.className = 'fas fa-play';
            }
        }
    }

    // Video control handlers
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', function() {
            if (player && player.getPlayerState) {
                const state = player.getPlayerState();
                if (state === YT.PlayerState.PLAYING) {
                    player.pauseVideo();
                } else {
                    player.playVideo();
                }
            }
        });
    }

    if (stopVideoBtn) {
        stopVideoBtn.addEventListener('click', function() {
            if (player) {
                player.stopVideo();
                videoPlayerContainer.classList.add('video-player-hidden');
                videoTitleSpan.textContent = 'No video selected';
            }
        });
    }

    // Voice control for video
    function handleVideoVoiceCommand(command) {
        const cmd = command.toLowerCase();
        console.log('Checking video voice command:', cmd);
        
        // Check if fullscreen player is active
        const fullscreenPlayer = window.fullscreenPlayer;
        const isFullscreen = document.getElementById('video-modal');
        
        // Use fullscreen player if available, otherwise use regular player
        const activePlayer = (isFullscreen && fullscreenPlayer) ? fullscreenPlayer : player;
        
        console.log('Active player:', isFullscreen ? 'fullscreen' : 'regular');
        console.log('Player exists:', !!activePlayer);
        
        if (cmd.includes('play video') || cmd.includes('play the video') || cmd === 'play') {
            if (activePlayer && activePlayer.playVideo) {
                activePlayer.playVideo();
                speakText('Playing video');
                return true;
            }
        } 
        
        if (cmd.includes('pause video') || cmd.includes('pause the video') || cmd === 'pause') {
            if (activePlayer && activePlayer.pauseVideo) {
                activePlayer.pauseVideo();
                speakText('Video paused');
                return true;
            }
        } 
        
        if (cmd.includes('stop video') || cmd.includes('stop the video') || cmd.includes('close video')) {
            if (isFullscreen) {
                closeVideoModal();
                speakText('Video closed');
            } else if (player) {
                player.stopVideo();
                videoPlayerContainer.classList.add('video-player-hidden');
                videoTitleSpan.textContent = 'No video selected';
                speakText('Video stopped');
            }
            return true;
        } 
        
        if (cmd.includes('fullscreen') || cmd.includes('full screen') || cmd.includes('go fullscreen')) {
            console.log('Fullscreen command detected!');
            if (!isFullscreen && player) {
                console.log('Opening video fullscreen...');
                showVideoFullscreen();
                speakText('Opening fullscreen');
                return true;
            }
        } 
        
        if (cmd.includes('exit fullscreen') || cmd.includes('close fullscreen') || cmd.includes('minimize')) {
            console.log('Close fullscreen command detected!');
            if (isFullscreen) {
                console.log('Closing video fullscreen...');
                closeVideoModal();
                speakText('Closing fullscreen');
                return true;
            }
        } 
        
        if (cmd.includes('volume up') || cmd.includes('increase volume') || cmd.includes('louder')) {
            if (activePlayer && activePlayer.setVolume) {
                const currentVolume = activePlayer.getVolume();
                const newVolume = Math.min(100, currentVolume + 10);
                activePlayer.setVolume(newVolume);
                speakText(`Volume ${Math.round(newVolume)}%`);
                return true;
            }
        } 
        
        if (cmd.includes('volume down') || cmd.includes('decrease volume') || cmd.includes('quieter') || cmd.includes('lower volume')) {
            if (activePlayer && activePlayer.setVolume) {
                const currentVolume = activePlayer.getVolume();
                const newVolume = Math.max(0, currentVolume - 10);
                activePlayer.setVolume(newVolume);
                speakText(`Volume ${Math.round(newVolume)}%`);
                return true;
            }
        }
        
        if (cmd.includes('mute') || cmd.includes('mute video')) {
            if (activePlayer && activePlayer.mute) {
                activePlayer.mute();
                speakText('Video muted');
                return true;
            }
        }
        
        if (cmd.includes('unmute') || cmd.includes('unmute video')) {
            if (activePlayer && activePlayer.unMute) {
                activePlayer.unMute();
                speakText('Video unmuted');
                return true;
            }
        }
        
        return false;
    }

    // === RECIPE DETECTION FROM AI RESPONSES ===
    function detectAndAddRecipe(responseText) {
        // Check if the response contains recipe-like content
        const hasIngredients = responseText.toLowerCase().includes('ingredients') || responseText.includes('* ') || responseText.includes('- ');
        const hasSteps = responseText.toLowerCase().includes('instructions') || responseText.toLowerCase().includes('steps') || 
                        /\d+\.\s/.test(responseText); // Look for numbered steps
        
        if (hasIngredients && hasSteps) {
            console.log('Recipe detected in AI response, adding to Recipe Database');
            
            // Extract recipe title (look for text before "Ingredients:" or first bold text)
            let recipeTitle = 'AI Recipe';
            const titleMatch = responseText.match(/(?:recipe for |making |how to make )([^:.\n]+)/i);
            if (titleMatch) {
                recipeTitle = titleMatch[1].trim();
            } else if (responseText.includes('**')) {
                const boldMatch = responseText.match(/\*\*([^*]+)\*\*/);
                if (boldMatch) {
                    recipeTitle = boldMatch[1];
                }
            }
            
            // Extract ingredients section
            let ingredientsText = '';
            const ingredientsMatch = responseText.match(/\*\*?Ingredients:?\*\*?([\s\S]*?)(?:\*\*?Instructions?:?\*\*?|\d+\.|$)/i);
            if (ingredientsMatch) {
                ingredientsText = ingredientsMatch[1].trim();
            }
            
            // Extract instructions section
            let instructionsText = '';
            const instructionsMatch = responseText.match(/\*\*?Instructions?:?\*\*?([\s\S]*?)(?:Enjoy|$)/i);
            if (instructionsMatch) {
                instructionsText = instructionsMatch[1].trim();
            }
            
            // Parse ingredients into array
            const ingredients = [];
            if (ingredientsText) {
                const ingredientLines = ingredientsText.split('\n').filter(line => line.trim());
                ingredientLines.forEach((line, index) => {
                    const cleanLine = line.replace(/^\*\s*/, '').replace(/^-\s*/, '').trim();
                    if (cleanLine) {
                        ingredients.push({
                            name: cleanLine,
                            amount: '',
                            unit: '',
                            original: cleanLine
                        });
                    }
                });
            }
            
            // Parse instructions into steps
            const instructions = [];
            if (instructionsText) {
                const stepLines = instructionsText.split('\n').filter(line => line.trim());
                let stepNumber = 1;
                stepLines.forEach((line) => {
                    const cleanLine = line.replace(/^\d+\.\s*/, '').replace(/^\*\*([^*]+)\*\*:?\s*/, '$1: ').trim();
                    if (cleanLine && cleanLine.length > 10) {
                        instructions.push({
                            number: stepNumber,
                            step: cleanLine
                        });
                        stepNumber++;
                    }
                });
            }
            
            // Create recipe object
            const aiRecipe = {
                id: 'ai_' + Date.now(), // Unique ID for AI recipes
                title: recipeTitle,
                image: '', // No image for AI recipes
                readyInMinutes: 30, // Default
                servings: 4, // Default
                ingredients: ingredients,
                instructions: instructions,
                sourceUrl: '',
                summary: `Recipe provided by AI assistant`,
                isAIGenerated: true
            };
            
            // Add to recipe display
            addAIRecipeToDisplay(aiRecipe);
        }
    }
    
    function addAIRecipeToDisplay(recipe) {
        const recipesContainer = document.querySelector('.recipes-container');
        if (!recipesContainer) return;
        
        // Clear "no content" message if it exists
        const noContent = recipesContainer.querySelector('.no-content');
        if (noContent) {
            noContent.remove();
        }
        
        // Create recipe card for AI recipe
        const cardDiv = document.createElement('div');
        cardDiv.className = 'recipe-card ai-recipe';
        cardDiv.onclick = () => showRecipeDetails(recipe.id);
        
        // Store recipe data for later access
        window.aiRecipes = window.aiRecipes || {};
        window.aiRecipes[recipe.id] = recipe;
        
        cardDiv.innerHTML = `
            <div class="recipe-image-container">
                <div class="recipe-image ai-recipe-placeholder">
                    <i class="fas fa-robot"></i>
                    <span>AI Recipe</span>
                </div>
            </div>
            <div class="recipe-content">
                <h3 class="recipe-title">${recipe.title}</h3>
                <div class="recipe-meta">
                    <div class="recipe-time">
                        <i class="fas fa-clock"></i>
                        <span>${recipe.readyInMinutes} min</span>
                    </div>
                    <div class="recipe-servings">
                        <i class="fas fa-users"></i>
                        <span>${recipe.servings} servings</span>
                    </div>
                </div>
                <div class="recipe-ingredients">
                    <strong>Ingredients (${recipe.ingredients.length}):</strong>
                    ${recipe.ingredients.slice(0, 3).map(ing => `<span class="ingredient-item">${ing.name}</span>`).join('')}
                    ${recipe.ingredients.length > 3 ? `<span class="more-ingredients">+${recipe.ingredients.length - 3} more</span>` : ''}
                </div>
                <div class="recipe-summary">${recipe.summary}</div>
                <div class="recipe-cta">
                    <button class="recipe-view-btn ai-recipe-btn" onclick="event.stopPropagation(); showFullRecipe('${recipe.id}')">
                        <i class="fas fa-utensils"></i> Cook This Recipe
                    </button>
                </div>
            </div>
        `;
        
        // Insert at the beginning of recipes container
        recipesContainer.insertBefore(cardDiv, recipesContainer.firstChild);
        
        // Add visual notification
        const notification = document.createElement('div');
        notification.className = 'recipe-notification';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            Recipe added to Recipe Database!
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // === SUBSTITUTION DETECTION AND DISPLAY ===
    function detectAndDisplaySubstitutions(responseText) {
        // Check if response is about substitutions
        const substitutionKeywords = ['substitute', 'instead of', 'replace', 'alternative', 'swap'];
        const lowerText = responseText.toLowerCase();
        const isSubstitutionResponse = substitutionKeywords.some(keyword => lowerText.includes(keyword));
        
        if (!isSubstitutionResponse) return;
        
        console.log('🔄 Substitution response detected, parsing...');
        
        // Try to extract ingredient name and substitution options
        let ingredient = '';
        const substitutions = [];
        
        // Extract ingredient (e.g., "butter", "eggs", "milk")
        const ingredientPatterns = [
            /substitute (?:for )?([a-z]+)/i,
            /instead of ([a-z]+)/i,
            /replace ([a-z]+)/i,
            /alternative.*?for ([a-z]+)/i
        ];
        
        for (const pattern of ingredientPatterns) {
            const match = responseText.match(pattern);
            if (match) {
                ingredient = match[1];
                break;
            }
        }
        
        // Extract substitution options (look for comma-separated list or "or" separated)
        const substitutionPattern = /can use ([^.!?]+?)(?:\.|,| as|$)/i;
        const subMatch = responseText.match(substitutionPattern);
        if (subMatch) {
            const options = subMatch[1].split(/,| or | and /).map(s => s.trim()).filter(s => s.length > 0);
            substitutions.push(...options);
        }
        
        // If we found ingredient and substitutions, display them
        if (ingredient && substitutions.length > 0) {
            console.log(`✅ Found ${substitutions.length} substitutions for ${ingredient}`);
            
            // Display in substitutions container if we're in that view
            if (currentView === 'substitutions') {
                displaySubstitutionsInContainer(ingredient, substitutions, responseText);
            }
            
            // Also check if we should switch to substitutions view
            const shouldSwitch = lowerText.includes('substitute') || lowerText.includes('instead of');
            if (shouldSwitch && currentView === 'conversation') {
                setTimeout(() => {
                    switchView('substitutions');
                    displaySubstitutionsInContainer(ingredient, substitutions, responseText);
                }, 500);
            }
        }
    }
    
    function displaySubstitutionsInContainer(ingredient, substitutions, fullResponse) {
        const container = document.getElementById('substitutions-container');
        if (!container) return;
        
        // Create beautiful substitution display
        let html = `
            <div class="substitution-result-card" style="background: white; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin-bottom: 1rem;">
                <div class="result-header" style="background: linear-gradient(135deg, rgba(104, 211, 145, 0.1) 0%, rgba(237, 137, 54, 0.1) 100%); padding: 1rem; border-radius: 0.75rem; margin-bottom: 1rem; border-left: 4px solid #68D391;">
                    <h3 style="margin: 0; display: flex; align-items: center; gap: 0.5rem; color: #2D3748; font-size: 1.25rem;">
                        <i class="fas fa-exchange-alt" style="color: #68D391;"></i> 
                        Substitutions for <span style="color: #ED8936; font-weight: 700;">${ingredient}</span>
                    </h3>
                </div>
                <div class="result-content">
                    <div class="substitution-options-grid" style="display: grid; gap: 0.75rem;">`;
        
        substitutions.forEach((sub, index) => {
            html += `
                        <div class="substitution-option" style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); padding: 1rem; border-radius: 0.5rem; border: 2px solid #e2e8f0; transition: all 0.3s ease; cursor: pointer;" onmouseover="this.style.borderColor='#68D391'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(104, 211, 145, 0.2)';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span style="display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 50%; background: #68D391; color: white; font-weight: 700; font-size: 0.875rem;">${index + 1}</span>
                                <p style="margin: 0; font-size: 1rem; font-weight: 600; color: #2D3748;">${sub}</p>
                            </div>
                        </div>`;
        });
        
        html += `
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 197, 253, 0.1) 100%); padding: 0.875rem; border-radius: 0.5rem; margin-top: 1rem; border-left: 3px solid #3b82f6;">
                        <p style="margin: 0; font-size: 0.875rem; color: #4b5563; display: flex; align-items: start; gap: 0.5rem;">
                            <i class="fas fa-lightbulb" style="color: #fbbf24; margin-top: 0.125rem;"></i>
                            <span><strong>AI Response:</strong> ${fullResponse}</span>
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Show notification
        showSmartNotification(`✅ Found ${substitutions.length} substitution${substitutions.length > 1 ? 's' : ''} for ${ingredient}`, 'success');
    }

    // === RECIPE VOICE COMMANDS ===
    function handleRecipeVoiceCommand(command) {
        const cmd = command.toLowerCase();
        
        // Handle "view full recipe" or "show full recipe" commands
        if (cmd.includes('view full recipe') || cmd.includes('show full recipe') || cmd.includes('full recipe') || cmd.includes('recipe details')) {
            // Try to find the first visible recipe card
            const recipeCards = document.querySelectorAll('.recipe-card');
            for (let card of recipeCards) {
                const viewBtn = card.querySelector('.recipe-view-btn');
                if (viewBtn) {
                    // Extract recipe ID from the onclick attribute
                    const onclickAttr = viewBtn.getAttribute('onclick');
                    if (onclickAttr) {
                        const match = onclickAttr.match(/showFullRecipe\('([^']+)'\)/);
                        if (match) {
                            const recipeId = match[1];
                            console.log('Voice command: Showing full recipe for ID:', recipeId);
                            showFullRecipe(recipeId);
                            return true;
                        }
                    }
                }
            }
            
            // If no recipe found, inform user
            if (recipeCards.length === 0) {
                addMessageToChat('Please search for recipes first, then say "view full recipe".', 'assistant');
            } else {
                addMessageToChat('I found recipes but couldn\'t open the details. Please try clicking "View Full Recipe" button.', 'assistant');
            }
            return true;
        }
        
        // Handle "close recipe" or "close full recipe" commands
        else if (cmd.includes('close recipe') || cmd.includes('close full recipe') || cmd.includes('exit recipe')) {
            const modal = document.getElementById('recipe-modal');
            if (modal) {
                closeRecipeModal();
                return true;
            }
        }
        
        return false;
    }

    // === NAVIGATION VOICE COMMANDS ===
    function handleNavigationVoiceCommand(command) {
        const cmd = command.toLowerCase();
        
        // View switching commands
        if (cmd.includes('open conversation') || cmd.includes('show conversation') || cmd.includes('go to conversation') || cmd.includes('go home')) {
            switchView('conversation');
            speakText('Opening conversation view');
            showSmartNotification('📱 Switched to Conversation', 'info');
            return true;
        }
        
        if (cmd.includes('open recipe search') || cmd.includes('show recipe search') || cmd.includes('go to recipe search') || cmd.includes('search recipes')) {
            switchView('recipeSearch');
            speakText('Opening recipe search');
            showSmartNotification('🔍 Switched to Recipe Search', 'info');
            return true;
        }
        
        if (cmd.includes('open video search') || cmd.includes('show video search') || cmd.includes('go to video search') || cmd.includes('search videos') || cmd.includes('youtube search')) {
            switchView('videoSearch');
            speakText('Opening video search');
            showSmartNotification('🎥 Switched to Video Search', 'info');
            return true;
        }
        
        if (cmd.includes('open unit converter') || cmd.includes('show unit converter') || cmd.includes('go to converter') || cmd.includes('open converter')) {
            switchView('unitConverter');
            speakText('Opening unit converter');
            showSmartNotification('⚖️ Switched to Unit Converter', 'info');
            return true;
        }
        
        if (cmd.includes('open substitutions') || cmd.includes('show substitutions') || cmd.includes('go to substitutions')) {
            switchView('substitutions');
            speakText('Opening substitutions');
            showSmartNotification('🔄 Switched to Substitutions', 'info');
            return true;
        }
        
        // Settings commands
        if (cmd.includes('open settings') || cmd.includes('show settings')) {
            openModal();
            speakText('Opening settings');
            showSmartNotification('⚙️ Settings opened', 'info');
            return true;
        }
        
        if (cmd.includes('close settings')) {
            closeModal();
            speakText('Closing settings');
            return true;
        }
        
        // Hands-free mode toggle
        if (cmd.includes('enable hands free') || cmd.includes('turn on hands free') || cmd.includes('activate hands free')) {
            if (!handsFreeMode) {
                toggleHandsFreeMode();
                return true;
            }
        }
        
        if (cmd.includes('disable hands free') || cmd.includes('turn off hands free') || cmd.includes('deactivate hands free')) {
            if (handsFreeMode) {
                toggleHandsFreeMode();
                return true;
            }
        }
        
        // Help command - more specific patterns to avoid false positives
        if (cmd === 'help' || 
            cmd === 'what can you do' || 
            cmd === 'what can you do?' || 
            cmd === 'show commands' || 
            cmd === 'list commands' ||
            cmd === 'show me commands') {
            const helpMessage = `I can help with:
• Recipe Search - say "open recipe search" or "find recipes"
• Video Search - say "open video search" or "search videos"  
• Unit Converter - say "open unit converter" or "convert units"
• Substitutions - say "open substitutions"
• Timers - say "set a timer for 5 minutes"
• Navigation - say "go home" or "open settings"
• Hands-free Mode - say "enable hands free"`;
            
            addConversationMessage('assistant', helpMessage);
            speakText('I can help with recipes, videos, conversions, timers, and more. Check the conversation for details.');
            return true;
        }
        
        return false;
    }

    // --- Speech Recognition Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-IN';
        recognition.interimResults = false;
        console.log('Speech Recognition initialized successfully');
        
        // Initialize continuous recognition for hands-free mode
        continuousRecognition = new SpeechRecognition();
        continuousRecognition.continuous = true;
        continuousRecognition.interimResults = true;
        continuousRecognition.lang = 'en-IN';
        console.log('Continuous Recognition initialized for hands-free mode');
    } else {
        console.error('Speech Recognition not supported in this browser');
        micStatus.textContent = 'Speech recognition not supported';
        micButton.style.opacity = '0.5';
        micButton.style.cursor = 'not-allowed';
    }

    // ===== HANDS-FREE MODE FUNCTIONS =====
    
    // Check if text contains wake word
    function containsWakeWord(text) {
        const lowerText = text.toLowerCase();
        return WAKE_WORDS.some(wakeWord => lowerText.includes(wakeWord));
    }
    
    // Extract command after wake word
    function extractCommandAfterWakeWord(text) {
        console.log('🔎 Extracting command from:', text);
        
        // Remove punctuation for matching
        const cleanedText = text.replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ');
        const lowerText = cleanedText.toLowerCase().trim();
        
        console.log('🧹 Cleaned text:', cleanedText);
        console.log('🔤 Lowercase text:', lowerText);
        console.log('🎯 Wake words to check:', WAKE_WORDS);
        
        for (const wakeWord of WAKE_WORDS) {
            const wakeWordIndex = lowerText.indexOf(wakeWord);
            console.log(`   Checking "${wakeWord}" - index: ${wakeWordIndex}`);
            
            if (wakeWordIndex !== -1) {
                // Get text after wake word (from cleaned text to preserve original capitalization)
                const command = cleanedText.substring(wakeWordIndex + wakeWord.length).trim();
                console.log(`✂️ Extracted command: "${command}"`);
                return command || null;
            }
        }
        console.log('❌ No wake word found in text');
        return null;
    }
    
    // Start hands-free mode
    function startHandsFreeMode() {
        if (!continuousRecognition) {
            console.error('Continuous recognition not available');
            showSmartNotification('⚠️ Hands-free mode not supported in this browser', 'warning');
            return false;
        }
        
        handsFreeMode = true;
        wakeWordDetected = false;
        
        console.log('🎙️ Starting hands-free mode - continuous listening');
        
        try {
            continuousRecognition.start();
            micStatus.textContent = 'Hands-free: Say "Hey Kitchen" to activate';
            micButton.classList.add('hands-free-active');
            updateSystemStatus('hands-free');
            showSmartNotification('🎙️ Hands-free mode activated! Say "Hey Kitchen" to start', 'success');
            
            // Update UI
            if (handsFreeToggleBtn) {
                handsFreeToggleBtn.textContent = 'Disable Hands-Free';
                handsFreeToggleBtn.classList.add('active');
            }
            
            return true;
        } catch (error) {
            console.error('Error starting hands-free mode:', error);
            handsFreeMode = false;
            showSmartNotification('⚠️ Failed to start hands-free mode', 'warning');
            return false;
        }
    }
    
    // Stop hands-free mode
    function stopHandsFreeMode() {
        handsFreeMode = false;
        wakeWordDetected = false;
        
        console.log('🔇 Stopping hands-free mode');
        
        if (continuousRecognition) {
            try {
                continuousRecognition.stop();
            } catch (error) {
                console.error('Error stopping continuous recognition:', error);
            }
        }
        
        micStatus.textContent = 'Click to speak';
        micButton.classList.remove('hands-free-active');
        showSmartNotification('🔇 Hands-free mode disabled', 'info');
        
        // Update UI
        if (handsFreeToggleBtn) {
            handsFreeToggleBtn.textContent = 'Enable Hands-Free';
            handsFreeToggleBtn.classList.remove('active');
        }
    }
    
    // Toggle hands-free mode
    function toggleHandsFreeMode() {
        if (handsFreeMode) {
            stopHandsFreeMode();
        } else {
            startHandsFreeMode();
        }
    }
    
    // Setup continuous recognition handlers
    if (continuousRecognition) {
        continuousRecognition.onstart = () => {
            console.log('Continuous recognition started');
        };
        
        continuousRecognition.onresult = (event) => {
            const resultIndex = event.resultIndex;
            const transcript = event.results[resultIndex][0].transcript;
            const isFinal = event.results[resultIndex].isFinal;
            
            console.log('Continuous recognition:', transcript, 'Final:', isFinal);
            
            // Check for wake word in both interim and final results
            if (containsWakeWord(transcript) && !wakeWordDetected) {
                console.log('🎯 Wake word detected!');
                wakeWordDetected = true;
                commandAccumulator = ''; // Clear accumulator for new command
                lastSpeechTime = Date.now();
                
                // Visual & Audio feedback (NO VOICE - just a beep sound)
                micStatus.textContent = '🎤 Listening...';
                micButton.classList.add('wake-word-detected');
                updateSystemStatus('wake-word');
                
                // Play a subtle beep sound to acknowledge (instead of speaking)
                try {
                    const beep = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77eeeTRAMUKfj8LZjHAY4ktfyzHksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQUrgc7y2Yk2CBlou+3nnk0QDFC'); 
                    beep.volume = 0.3;
                    beep.play().catch(e => console.log('Beep failed:', e));
                } catch (e) {
                    console.log('Audio beep not supported');
                }
                
                // Show visual notification
                showSmartNotification('🎤 I\'m listening...', 'info');
                
                console.log('👂 Ready for command - NO greeting speech to avoid echo');
                
                // Clear any existing timeout
                if (commandTimeout) {
                    clearTimeout(commandTimeout);
                }
                return; // Don't process further until next speech
            }
            
            // If wake word was detected, accumulate the user's command (without wake word)
            if (wakeWordDetected) {
                // Just use the current transcript as the command
                // (wake word was already detected, this is the actual command)
                commandAccumulator = transcript;
                lastSpeechTime = Date.now();
                
                if (isFinal) {
                    console.log('✅ Final command received:', commandAccumulator);
                } else {
                    console.log('⏳ Listening to command (interim):', commandAccumulator);
                }
                
                // Clear previous timeout
                if (commandTimeout) {
                    clearTimeout(commandTimeout);
                }
                
                // Wait for 2 seconds of silence before processing
                commandTimeout = setTimeout(() => {
                    if (wakeWordDetected && commandAccumulator && commandAccumulator.trim().length > 0 && !isProcessingCommand) {
                        isProcessingCommand = true; // Set flag to prevent duplicate processing
                        
                        console.log('🎬 Processing user command');
                        console.log('📋 Command text:', commandAccumulator);
                        
                        const command = commandAccumulator.trim();
                        
                        if (command.length > 2) {
                            console.log('📝 Sending command to AI:', command);
                            
                            // Pause video if playing
                            if (isVideoPlaying()) {
                                videoWasPlayingBeforeSpeech = true;
                                player.pauseVideo();
                            }
                            
                            // Process the command
                            processCommand(command);
                        } else {
                            console.log('⚠️ Command too short, ignoring');
                            isProcessingCommand = false; // Reset flag
                        }
                        
                        // Reset state
                        wakeWordDetected = false;
                        commandAccumulator = '';
                        micButton.classList.remove('wake-word-detected');
                        
                        // Update status
                        setTimeout(() => {
                            isProcessingCommand = false; // Reset flag after processing
                            if (handsFreeMode) {
                                micStatus.textContent = 'Hands-free: Say "Hey Kitchen" to activate';
                            }
                        }, 1000);
                    }
                }, 2000); // 2 second delay for command completion (reduced from 3s)
            }
        };
        
        continuousRecognition.onerror = (event) => {
            console.error('Continuous recognition error:', event.error);
            
            if (event.error === 'no-speech') {
                // Ignore no-speech errors in continuous mode - this is normal
                return;
            }
            
            if (event.error === 'aborted') {
                // Silent handling - this happens during normal stop/start cycles
                // Don't show error to user
                if (handsFreeMode) {
                    setTimeout(() => {
                        if (handsFreeMode && !continuousRecognition) {
                            try {
                                continuousRecognition.start();
                            } catch (e) {
                                // Silently fail - browser might already be recognizing
                            }
                        }
                    }, 500);
                }
                return;
            }
            
            // Only show errors for actual problems (not abort/no-speech)
            if (event.error !== 'aborted' && event.error !== 'no-speech') {
                if (handsFreeMode) {
                    console.warn(`⚠️ Recognition error: ${event.error}`);
                }
            }
        };
        
        continuousRecognition.onend = () => {
            console.log('Continuous recognition ended');
            
            // Auto-restart if still in hands-free mode
            if (handsFreeMode) {
                console.log('Auto-restarting continuous recognition...');
                setTimeout(() => {
                    if (handsFreeMode) {
                        try {
                            continuousRecognition.start();
                        } catch (error) {
                            console.error('Failed to restart continuous recognition:', error);
                        }
                    }
                }, 500);
            }
        };
    }

    // --- Event Listeners ---
    micButton.addEventListener('click', async () => {
        console.log('Microphone button clicked');
        if (!recognition) {
            console.error('Speech recognition not available');
            micStatus.textContent = 'Speech recognition not supported';
            return;
        }
        
        // Request microphone permission and initialize audio analyzer
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Microphone permission granted');
            stream.getTracks().forEach(track => track.stop()); // Stop the stream, we just needed permission
            micStatus.textContent = 'Microphone ready';
            
            // Initialize audio analyzer for smart conversation
            if (!audioAnalyzer) {
                await initAudioAnalyzer();
            }
        } catch (error) {
            console.error('Microphone permission denied:', error);
            micStatus.textContent = 'Microphone permission required';
            return;
        }
        
        initAudioContext();
        toggleListening();
    });

    // Only set up recognition event handlers if recognition is available
    if (recognition) {
        recognition.onstart = () => { 
            console.log('Speech recognition started');
            isListening = true; 
            micButton.classList.add('listening'); 
            updateSystemStatus('listening');
            
            // Smart pause: Pause video if playing
            if (isVideoPlaying()) {
                console.log('Video is playing - pausing for user speech');
                videoWasPlayingBeforeSpeech = true;
                player.pauseVideo();
                micStatus.textContent = 'Listening... (Video paused)';
                micStatus.classList.add('video-paused');
                
                // Show notification
                showSmartNotification('🎤 Video paused - I\'m listening...', 'info');
                
                // Start detecting silence to auto-resume
                startSilenceDetection();
            } else {
                videoWasPlayingBeforeSpeech = false;
                micStatus.textContent = 'Listening...';
            }
        };
        
        recognition.onend = () => { 
            console.log('Speech recognition ended');
            isListening = false; 
            micButton.classList.remove('listening');
            micStatus.classList.remove('video-paused');
            updateSystemStatus('idle');
            
            // 🔊 AUTO-UNMUTE: Restore video audio after speech recognition
            unmuteVideoAfterSpeechRecognition();
            
            // Stop silence detection
            clearInterval(silenceDetectionTimer);
            isSpeechDetected = false;
            
            // Smart resume: Resume video if it was playing before
            if (videoWasPlayingBeforeSpeech && player) {
                console.log('Auto-resuming video after speech');
                setTimeout(() => {
                    if (player && !isAssistantSpeaking) {
                        player.playVideo();
                        showSmartNotification('▶️ Video resumed', 'success');
                        videoWasPlayingBeforeSpeech = false;
                    }
                }, 500); // Small delay for smooth transition
            }
            
            updateMicStatus();
        };
        
        recognition.onerror = (event) => { 
            console.error('Recognition error:', event.error);
            isListening = false;
            micButton.classList.remove('listening');
            micStatus.classList.remove('video-paused');
            
            // Clear silence detection
            clearInterval(silenceDetectionTimer);
            
            // Resume video on error if it was playing
            if (videoWasPlayingBeforeSpeech && player) {
                player.playVideo();
                videoWasPlayingBeforeSpeech = false;
            }
            
            micStatus.textContent = `Error: ${event.error}`;
            if (event.error !== 'no-speech') {
                addMessageToChat(`Recognition Error: ${event.error}`, 'assistant'); 
            }
        };
    }

    // Initialize microphone after recognition setup
    initializeMicrophone();
    
    // Initialize hands-free toggle button
    handsFreeToggleBtn = document.getElementById('hands-free-toggle');
    if (handsFreeToggleBtn) {
        handsFreeToggleBtn.addEventListener('click', toggleHandsFreeMode);
        console.log('Hands-free toggle button initialized');
    }

    recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase().trim();
        console.log('Speech recognition result:', event.results[0][0].transcript);
        
        // --- Local YouTube Playback Control ---
        if (player && player.getPlayerState) {
            if (command.includes("pause video") || command.includes("pause")) {
                player.pauseVideo();
                addMessageToChat("Pausing video.", 'user');
                return; // Stop processing, command handled locally
            }
            if (command.includes("play video") || command.includes("resume")) {
                player.playVideo();
                addMessageToChat("Playing video.", 'user');
                return;
            }
            if (command.includes("stop video") || command.includes("close player")) {
                player.stopVideo();
                videoPlayerContainer.style.display = 'none';
                chatContainer.style.display = 'flex'; // Show chat again
                addMessageToChat("Stopping video.", 'user');
                return;
            }
        }
        
        // If not a local command, send to backend
        console.log('Sending to backend:', event.results[0][0].transcript);
        processCommand(event.results[0][0].transcript);
    };

    // --- Central function to handle sending commands to backend ---
    function processCommand(commandText) {
        console.log('Processing command:', commandText);
        
        // Check if it's a navigation voice command first
        if (handleNavigationVoiceCommand(commandText)) {
            console.log('Handled as navigation voice command');
            return;
        }
        
        // Check if it's a video voice command
        if (handleVideoVoiceCommand(commandText)) {
            console.log('Handled as video voice command');
            return;
        }
        
        // Check if it's a recipe voice command
        if (handleRecipeVoiceCommand(commandText)) {
            console.log('Handled as recipe voice command');
            return;
        }
        
        console.log('Session ID:', sessionId);
        console.log('Socket ID:', socket.id);
        console.log('💬 Adding user message to chat:', commandText);
        addMessageToChat(commandText, 'user');
        updateHistory("user", commandText);
        assistantMessageBubble = createMessageBubble('', 'assistant');
        console.log('📝 Created assistant message bubble:', assistantMessageBubble);
        updateSystemStatus('processing');
        console.log('📤 Emitting user_command to backend');
        socket.emit('user_command', { 
            command: commandText, 
            history: chatHistory,
            session_id: sessionId
        });
    }

    // --- WebSocket Event Handlers ---
    socket.on('connect', () => { console.log('Connected to server'); });
    socket.on('disconnect', () => { console.log('Disconnected from server'); });
    socket.on('error', (data) => { 
        console.error('Server error:', data.message); 
        addMessageToChat(`Error: ${data.message}`, 'assistant');
    });

    // Debug: Catch all events to see what we're receiving
    socket.onAny((eventName, ...args) => {
        console.log('WebSocket event received:', eventName, args);
    });

    // Add handlers for all backend events
    socket.on('session_id', (data) => {
        console.log('Session ID received from server:', data.session_id);
        
        // Only use new session if we don't have one already
        if (!sessionId) {
            sessionId = data.session_id;
            saveSessionToStorage();
            console.log('✅ New session ID saved:', sessionId);
        } else {
            console.log('♻️ Using existing session ID:', sessionId);
            // Inform server of our existing session
            socket.emit('restore_session', { session_id: sessionId });
        }
    });
    
    socket.on('session_restored', (data) => {
        console.log('✅ Session restored:', data);
        console.log(`📚 Server has ${data.message_count} messages in history`);
        showSmartNotification('💬 Chat history restored', 'success');
    });

    socket.on('timer_set', (data) => {
        console.log('Timer set:', data);
        
        // Add voice feedback for timer set
        if (data.name && data.duration) {
            const minutes = Math.floor(data.duration / 60);
            const voiceFeedback = `Timer set for ${minutes} minute${minutes !== 1 ? 's' : ''}`;
            speakText(voiceFeedback);
            showSmartNotification(`⏱️ ${voiceFeedback}`, 'success');
        }
        
        // Request updated timers list to display
        socket.emit('get_timers');
    });

    socket.on('timer_update', (data) => {
        console.log('Timer update:', data);
        updateTimerDisplay(data);
    });

    socket.on('timer_finished', (data) => {
        console.log('Timer finished:', data);
        handleTimerFinished(data);
    });

    socket.on('timer_deleted', (data) => {
        console.log('Timer deleted:', data);
        // Backend automatically sends updated timers_list after deletion
        // No need to request it again - this was causing duplicate timers
    });

    socket.on('timers_list', (data) => {
        console.log('Timers list received:', data);
        console.log('Timer data structure:', JSON.stringify(data, null, 2));
        displayActiveTimers(data);
    });

    socket.on('conversion_result', (data) => {
        console.log('Conversion result:', data);
        updateSystemStatus('ready');
        
        // Add voice feedback for conversion
        if (!data.error && data.result) {
            const voiceFeedback = `${data.amount || ''} ${data.from_unit || ''} equals ${data.result}`;
            speakText(voiceFeedback);
        }
        
        // Display result (will show in conversation and converter view if active)
        displayConversionResult(data);
        
        // If user is NOT in conversation or converter view, switch to show the result
        // This helps when user asks for conversion while in another view
        if (currentView !== 'conversation' && currentView !== 'unitConverter') {
            // Add a small delay before switching to conversation to show the result
            setTimeout(() => {
                switchView('conversation');
            }, 100);
        }
    });

    socket.on('substitution_result', (data) => {
        console.log('Substitution result:', data);
        updateSystemStatus('ready');
        
        // Display result (will show in conversation and substitutions view if active)
        displaySubstitutionResult(data);
        
        // If user is NOT in conversation or substitutions view, switch to show the result
        if (currentView !== 'conversation' && currentView !== 'substitutions') {
            setTimeout(() => {
                switchView('conversation');
            }, 100);
        }
    });

    socket.on('youtube_results', (data) => {
        updateSystemStatus('ready');
        console.log('YouTube results received:', data);
        console.log('Videos:', data.videos);
        
        // Add conversation message FIRST for context
        const videoCount = data.videos?.length || 0;
        if (videoCount > 0) {
            addConversationMessage('assistant', 
                `🎥 Found ${videoCount} recipe video${videoCount > 1 ? 's' : ''}! Switching to Video Search view to show you the results...`
            );
            // Voice feedback
            speakText(`I found ${videoCount} recipe video${videoCount > 1 ? 's' : ''}. Switching to video search.`);
        } else {
            addConversationMessage('assistant', 
                `Sorry, I couldn't find any videos for that search. Try a different query!`
            );
            speakText(`Sorry, I couldn't find any videos. Try a different search.`);
        }
        
        // Then switch to video search view
        switchView('videoSearch');
        
        // Wait for view to render, then display results
        setTimeout(() => {
            const videoResultsContainer = document.getElementById('video-results');
            console.log('Looking for video-results container:', videoResultsContainer);
            
            if (videoResultsContainer) {
                console.log('Found video-results container, displaying videos');
                displayYouTubeResults(data.videos);
            } else {
                console.error('video-results container not found after view switch');
                // Debug: List all elements in main view
                const allElements = mainView.querySelectorAll('*');
                console.log('All elements in main view:', allElements.length);
                console.log('Active view:', mainView.querySelector('.active-view'));
                
                // Try again with longer delay
                setTimeout(() => {
                    const retryContainer = document.getElementById('video-results');
                    console.log('Retry: video-results container:', retryContainer);
                    if (retryContainer) {
                        displayYouTubeResults(data.videos);
                    } else {
                        console.error('Still cannot find video-results container');
                    }
                }, 300);
            }
        }, 200);
    });

    socket.on('play_video', (data) => {
        console.log('▶️ play_video event received:', data);
        updateSystemStatus('ready');
        
        // Redirect to video detail page instead of playing inline
        if (data.video_id) {
            console.log('🎬 Redirecting to video detail page:', data.video_id);
            window.location.href = `/video/${data.video_id}`;
        } else {
            console.error('No video_id provided in play_video event');
        }
    });

    socket.on('recipe_results', (data) => {
        console.log('Recipe results:', data);
        updateSystemStatus('ready');
        
        // Add conversation message for context
        const recipeCount = data.recipes?.length || 0;
        if (recipeCount > 0) {
            addConversationMessage('assistant', 
                `🍳 Found ${recipeCount} delicious recipe${recipeCount > 1 ? 's' : ''} for you! Switching to Recipe Search view...`
            );
            // Voice feedback
            speakText(`I found ${recipeCount} delicious recipe${recipeCount > 1 ? 's' : ''} for you.`);
        } else {
            addConversationMessage('assistant', 
                `Sorry, I couldn't find any recipes matching your criteria. Try adjusting your search!`
            );
            speakText(`Sorry, I couldn't find any recipes. Try a different search.`);
        }
        
        // Switch to recipe results view
        if (data.recipes && data.recipes.length > 0) {
            switchView('recipeResults', data.recipes);
        } else {
            switchView('recipeSearch');
        }
    });
    
    socket.on('navigate_to_recipe', (data) => {
        console.log('📖 [NAVIGATE] Received navigate_to_recipe event');
        console.log('📖 [NAVIGATE] Recipe:', data.title, 'ID:', data.recipe_id);
        console.log('📖 [NAVIGATE] Full data:', JSON.stringify(data));
        
        // Navigate directly to the recipe page
        const recipeUrl = `/recipe/${data.recipe_id}`;
        console.log('📖 [NAVIGATE] Navigating to:', recipeUrl);
        window.location.href = recipeUrl;
    });
    
    socket.on('final_text', (data) => {
        console.log('📥 Received final_text:', data);
        console.log('📝 assistantMessageBubble exists:', !!assistantMessageBubble);
        updateSystemStatus('ready');
        
        // Clean and format the response text
        const cleanResponse = data.text
            ?.replace(/🎤\s*User.*?:\s*/g, '') // Remove user prefixes from logs
            ?.replace(/🤖\s*AI.*?:\s*/g, '') // Remove AI prefixes from logs
            ?.trim() || '';
        
        console.log('🧹 Cleaned response:', cleanResponse);
        
        if (assistantMessageBubble) {
            console.log('✅ Updating assistant message bubble');
            // Format for display (HTML)
            const displayText = cleanResponse
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/\n\n/g, '<br><br>')
                .replace(/\n/g, '<br>');
            
            assistantMessageBubble.innerHTML = displayText;
            updateHistory("assistant", cleanResponse);
            scrollToBottom();
            
            // Check if the response contains a recipe and add it to Recipe Database
            detectAndAddRecipe(cleanResponse);
            
            // Check if the response contains substitution information
            detectAndDisplaySubstitutions(cleanResponse);
            
        } else {
            console.error('assistantMessageBubble is null');
            // Create a new message bubble if it doesn't exist
            addMessageToChat(cleanResponse, 'assistant');
            updateHistory("assistant", cleanResponse);
            
            // Check if the response contains a recipe
            detectAndAddRecipe(cleanResponse);
            
            // Check if the response contains substitution information
            detectAndDisplaySubstitutions(cleanResponse);
        }
        
        // DO NOT use browser TTS - only backend audio will be used
        // Reset the flag, backend audio is coming separately via ai_audio_base64
        backendAudioReceived = false;
    });

    socket.on('ai_audio_chunk', async (data) => {
        console.log('Received ai_audio_chunk:', data);
        const audioData = new Uint8Array(data.audio).buffer;
        await playAudio(audioData);
        assistantMessageBubble = null;
        setTimeout(startListening, 300); // Auto-listen for next turn
    });

    // Handle base64 audio if that's what the backend is sending
    socket.on('ai_audio_base64', async (data) => {
        console.log('📥 Received ai_audio_base64 event');
        console.log('📊 Data keys:', Object.keys(data));
        console.log('📊 Audio B64 length:', data.audio_b64?.length || 'N/A');
        
        backendAudioReceived = true; // Set flag to prevent browser TTS
        
        // Cancel any ongoing browser TTS
        if (speechSynthesis.speaking) {
            console.log('🚫 Canceling browser TTS as backend audio received');
            speechSynthesis.cancel();
        }
        
        // Check if audioContext exists
        if (!audioContext) {
            console.error('❌ AudioContext not initialized! Creating now...');
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('✅ AudioContext created');
            } catch (e) {
                console.error('❌ Failed to create AudioContext:', e);
                return;
            }
        }
        
        console.log('🔊 AudioContext state:', audioContext.state);
        
        // Resume audioContext if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
            console.log('⚠️ AudioContext suspended, resuming...');
            try {
                await audioContext.resume();
                console.log('✅ AudioContext resumed, state:', audioContext.state);
            } catch (e) {
                console.error('❌ Failed to resume AudioContext:', e);
            }
        }
        
        try {
            // Check if audio data exists and is valid
            const audioB64 = data.audio_b64 || data.audio;
            if (!audioB64 || typeof audioB64 !== 'string') {
                console.error('❌ Invalid base64 audio data:', typeof audioB64);
                return;
            }
            
            console.log('✅ Audio data valid, length:', audioB64.length);
            
            // Validate base64 format
            const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
            if (!base64Pattern.test(audioB64)) {
                console.error('❌ Invalid base64 format');
                return;
            }
            
            console.log('✅ Base64 format valid');
            
            // Decode base64 to audio data
            console.log('🔄 Decoding base64...');
            const binaryString = atob(audioB64);
            const audioData = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                audioData[i] = binaryString.charCodeAt(i);
            }
            
            console.log('✅ Decoded to', audioData.length, 'bytes');
            console.log('🎵 Calling playAudio...');
            
            await playAudio(audioData.buffer);
            
            console.log('✅ playAudio completed');
            assistantMessageBubble = null;
        } catch (error) {
            console.error('❌ Error playing base64 audio:', error);
            console.error('❌ Error stack:', error.stack);
            // Don't fail silently - the browser TTS will handle it
        }
    });

    // --- Manual Form Handlers ---
    // Timer Form (in manual controls panel)
    document.getElementById('timer-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const minutes = document.getElementById('timer-minutes').value;
        const name = document.getElementById('timer-name').value || 'timer';
        const command = `Set a ${name} timer for ${minutes} minutes`;
        console.log('Manual timer form submitted:', command);
        processCommand(command);
        // Clear form
        document.getElementById('timer-name').value = '';
    });

    // Inline Timer Form (in active timers section)
    document.getElementById('timer-form-inline')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const minutes = document.getElementById('timer-minutes-inline').value;
        const name = document.getElementById('timer-name-inline').value || 'timer';
        const command = `Set a ${name} timer for ${minutes} minutes`;
        console.log('Inline timer form submitted:', command);
        processCommand(command);
        // Clear form
        document.getElementById('timer-name-inline').value = '';
        document.getElementById('timer-minutes-inline').value = '5'; // Reset to default
    });

    // Conversion Form
    document.getElementById('conversion-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = document.getElementById('convert-amount').value;
        const fromUnit = document.getElementById('convert-from').value;
        const toUnit = document.getElementById('convert-to').value;
        const command = `Convert ${amount} ${fromUnit} to ${toUnit}`;
        console.log('Manual conversion form submitted:', command);
        processCommand(command);
        // Clear form
        document.getElementById('convert-amount').value = '';
    });

    // YouTube Search Form
    document.getElementById('youtube-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('youtube-query').value;
        const command = `Search for ${query} recipe on YouTube`;
        console.log('Manual YouTube form submitted:', command);
        processCommand(command);
        // Clear form
        document.getElementById('youtube-query').value = '';
    });

    // Recipe Search Form
    document.getElementById('recipe-search-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('recipe-query').value;
        const diet = document.getElementById('recipe-diet').value;
        const cuisine = document.getElementById('recipe-cuisine').value;
        
        let command = `Find recipes for ${query}`;
        if (diet) command += ` that are ${diet}`;
        if (cuisine) command += ` in ${cuisine} style`;
        
        console.log('Manual recipe form submitted:', command);
        processCommand(command);
        // Clear form
        document.getElementById('recipe-query').value = '';
        document.getElementById('recipe-diet').value = '';
        document.getElementById('recipe-cuisine').value = '';
    });

    // --- YouTube Video Auto-Ducking (Mute during speech recognition) ---
    let videoWasMuted = false; // Track if we auto-muted the video
    
    function muteVideoForSpeechRecognition() {
        // Check if there's an active YouTube player
        const activePlayer = getActivePlayer();
        if (activePlayer) {
            try {
                // Check if video is currently playing and NOT already muted
                if (activePlayer.getPlayerState && activePlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                    if (!activePlayer.isMuted()) {
                        console.log('🔇 Auto-muting video for speech recognition');
                        activePlayer.mute();
                        videoWasMuted = true; // Remember we muted it
                        
                        // Show visual indicator on video
                        const muteIndicator = document.getElementById('videoMuteIndicator');
                        if (muteIndicator) {
                            muteIndicator.classList.add('show');
                        }
                        
                        // Visual feedback
                        showSmartNotification('🔇 Video muted for voice command', 'info', 1000);
                    }
                }
            } catch (e) {
                console.log('Could not mute video:', e);
            }
        }
    }
    
    function unmuteVideoAfterSpeechRecognition() {
        // Only unmute if WE muted it (not if user manually muted)
        const activePlayer = getActivePlayer();
        if (activePlayer && videoWasMuted) {
            try {
                console.log('🔊 Auto-unmuting video after speech recognition');
                activePlayer.unMute();
                videoWasMuted = false; // Reset flag
                
                // Hide visual indicator
                const muteIndicator = document.getElementById('videoMuteIndicator');
                if (muteIndicator) {
                    muteIndicator.classList.remove('show');
                }
                
                // Visual feedback
                showSmartNotification('🔊 Video unmuted', 'success', 1000);
            } catch (e) {
                console.log('Could not unmute video:', e);
            }
        }
    }
    
    function getActivePlayer() {
        // Check for regular player
        if (typeof player !== 'undefined' && player && player.getPlayerState) {
            return player;
        }
        // Check for fullscreen player
        if (typeof fullscreenPlayer !== 'undefined' && fullscreenPlayer && fullscreenPlayer.getPlayerState) {
            return fullscreenPlayer;
        }
        return null;
    }

    // --- Helper Functions ---
    function toggleListening() {
        if (!recognition) {
            console.error('Speech recognition not available');
            return;
        }
        
        if (isListening) {
            console.log('Stopping speech recognition');
            recognition.stop();
        } else {
            // "Click-to-interrupt" logic
            if (isAssistantSpeaking && currentAudioSource) {
                currentAudioSource.stop(); // Stop the audio playback
            }
            startListening();
        }
    }

    function startListening() {
        if (!recognition) {
            console.error('Speech recognition not available');
            return;
        }
        
        if (!isListening) {
            try { 
                console.log('Starting speech recognition');
                
                // 🔇 AUTO-MUTE: Mute YouTube video when user starts speaking
                muteVideoForSpeechRecognition();
                
                micStatus.textContent = 'Starting...';
                recognition.start(); 
            } catch(e) { 
                console.error('Error starting recognition:', e);
                micStatus.textContent = 'Error starting microphone';
            }
        }
    }

    async function playAudio(audioData) {
        console.log('🎵 playAudio called');
        console.log('📊 audioData:', audioData ? 'exists' : 'null', audioData?.byteLength || 'N/A', 'bytes');
        console.log('📊 isAssistantSpeaking:', isAssistantSpeaking);
        console.log('📊 audioContext:', audioContext ? audioContext.state : 'null');
        
        if (!audioData) {
            console.error('❌ No audio data provided');
            return;
        }
        
        if (isAssistantSpeaking) {
            console.warn('⚠️ Assistant already speaking, skipping');
            return;
        }
        
        if (!audioContext) {
            console.error('❌ No audioContext available');
            return;
        }
        
        isAssistantSpeaking = true;
        statusIndicator.style.backgroundColor = '#007aff';
        micStatus.textContent = 'Assistant speaking...';
        console.log('✅ Set isAssistantSpeaking = true');
        
        // CRITICAL: Pause continuous recognition during AI speech to prevent echo
        let recognitionWasPaused = false;
        if (handsFreeMode && continuousRecognition) {
            try {
                continuousRecognition.stop();
                recognitionWasPaused = true;
                console.log('⏸️ Paused hands-free recognition during AI speech');
            } catch (e) {
                console.log('⚠️ Recognition already stopped:', e.message);
            }
        }
        
        // Smart pause: Pause video when AI is speaking to avoid confusion
        let videoWasPausedForAI = false;
        if (isVideoPlaying()) {
            console.log('⏸️ Pausing video while AI assistant speaks');
            player.pauseVideo();
            videoWasPausedForAI = true;
            showSmartNotification('🤖 AI speaking - Video paused', 'info');
        }
        
        try {
            console.log('🔄 Decoding audio buffer...');
            const audioBuffer = await audioContext.decodeAudioData(audioData);
            console.log('✅ Audio decoded, duration:', audioBuffer.duration, 'seconds');
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            
            console.log('▶️ Starting audio playback...');
            source.start(0);
            currentAudioSource = source; // Store for interruption
            
            return new Promise(resolve => {
                source.onended = () => {
                    console.log('✅ Backend audio playback ended');
                    isAssistantSpeaking = false;
                    statusIndicator.style.backgroundColor = '#34c759';
                    
                    // CRITICAL: Resume hands-free recognition after AI speech
                    if (recognitionWasPaused && handsFreeMode) {
                        setTimeout(() => {
                            try {
                                continuousRecognition.start();
                                micStatus.textContent = 'Hands-free: Say "Hey Kitchen" to activate';
                                console.log('▶️ Resumed hands-free recognition after AI speech');
                            } catch (e) {
                                console.log('⚠️ Recognition already running:', e.message);
                            }
                        }, 500); // 500ms delay to let audio settle
                    } else {
                        micStatus.textContent = 'Click to speak';
                    }
                    
                    // Smart resume: Resume video after AI finishes speaking
                    if (videoWasPausedForAI && player) {
                        console.log('▶️ Resuming video after AI speech');
                        setTimeout(() => {
                            if (player && !isListening) {
                                player.playVideo();
                                showSmartNotification('▶️ Video resumed', 'success');
                            }
                        }, 300);
                    }
                    
                    // Auto-start listening after backend audio ends (ONLY in non-hands-free mode)
                    if (!handsFreeMode) {
                        setTimeout(() => {
                            if (!isListening && !isAssistantSpeaking) {
                                console.log('▶️ Auto-starting listening after backend audio');
                                startListening();
                            }
                        }, 500);
                    }
                    
                    resolve();
                };
            });
        } catch (error) {
            console.error("❌ Audio playback error:", error);
            console.error("❌ Error stack:", error.stack);
            isAssistantSpeaking = false;
            statusIndicator.style.backgroundColor = '#34c759';
            
            // Resume recognition on error if needed
            if (recognitionWasPaused && handsFreeMode) {
                try {
                    continuousRecognition.start();
                    console.log('▶️ Resumed recognition after audio error');
                } catch (e) {
                    console.log('⚠️ Could not resume recognition:', e.message);
                }
            }
            
            // Resume video on error
            if (videoWasPausedForAI && player) {
                player.playVideo();
            }
        }
    }
    
    function displayYouTubeResults(videos) {
        console.log('displayYouTubeResults called with:', videos);
        
        // Make sure we're in the video search view
        if (currentView !== 'videoSearch') {
            console.log('Not in videoSearch view, switching...');
            switchView('videoSearch');
            setTimeout(() => displayYouTubeResults(videos), 300);
            return;
        }
        
        // Display results in the dedicated YouTube section
        const videoResultsContainer = document.getElementById('video-results');
        if (!videoResultsContainer) {
            console.error('Video results container not found in DOM');
            console.log('Current view:', currentView);
            console.log('Main view children:', mainView.children);
            return;
        }

        console.log('Found video-results container, clearing and populating...');
        
        // Clear existing content
        videoResultsContainer.innerHTML = '';
        
        if (!videos || videos.length === 0) {
            videoResultsContainer.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>No recipe videos found. Try a different search!</p>
                </div>
            `;
            console.log('No videos to display');
            return;
        }

        console.log(`Displaying ${videos.length} videos`);
        
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'video-results-container';
        
        videos.forEach((video, index) => {
            console.log(`Creating card for video ${index + 1}:`, video.title);
            const card = document.createElement('div');
            card.className = 'video-card';
            
            // Handle fallback search results
            if (video.search_url || video.video_id === 'search_redirect') {
                card.innerHTML = `
                    <img src="${video.thumbnail}" alt="YouTube Search" class="video-thumbnail">
                    <div class="video-info">
                        <div class="result-number">Search Link</div>
                        <div class="title">${video.title}</div>
                        <div class="search-note">${video.note || 'Click to search on YouTube'}</div>
                        <a href="${video.search_url}" target="_blank" class="search-link">
                            <i class="fas fa-external-link-alt"></i> Open YouTube Search
                        </a>
                    </div>
                `;
            } else {
                // Normal video results - redirect to video detail page
                card.innerHTML = `
                    <img src="${video.thumbnail}" alt="Video thumbnail" class="video-thumbnail">
                    <div class="video-info">
                        <div class="result-number">Result #${video.result_number}</div>
                        <div class="title">${video.title}</div>
                        <div class="video-actions">
                            ${video.video_id ? `
                                <button onclick="window.location.href='/video/${video.video_id}'" class="play-button">
                                    <i class="fas fa-eye"></i> View Details
                                </button>
                                <button onclick="requestVideoPlay(${video.result_number})" class="voice-play-button">
                                    <i class="fas fa-volume-up"></i> Say "Play video ${video.result_number}"
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
                
                // Make entire card clickable (except buttons)
                if (video.video_id) {
                    card.style.cursor = 'pointer';
                    card.addEventListener('click', (e) => {
                        // Only redirect if clicking on card itself, not buttons
                        if (!e.target.closest('button')) {
                            window.location.href = `/video/${video.video_id}`;
                        }
                    });
                }
            }
            
            resultsContainer.appendChild(card);
        });
        
        videoResultsContainer.appendChild(resultsContainer);
        console.log('Video results displayed successfully');
        
        // Scroll results into view
        videoResultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Test functions (can be called from console)
    window.testMicrophone = function() {
        console.log('Testing microphone...');
        console.log('Speech Recognition available:', !!SpeechRecognition);
        console.log('Navigator mediaDevices available:', !!navigator.mediaDevices);
        console.log('Recognition object:', recognition);
        console.log('Mic button element:', micButton);
        console.log('Mic status element:', micStatus);
        
        if (recognition) {
            console.log('Attempting to start recognition...');
            try {
                recognition.start();
            } catch (e) {
                console.error('Recognition start error:', e);
            }
        }
    };

    // Test AI response display
    window.testResponse = function() {
        console.log('Testing AI response display...');
        const testText = "Hi there! I can help you with all sorts of cooking tasks.";
        
        // Create assistant message bubble
        const bubble = createMessageBubble('', 'assistant');
        console.log('Created bubble:', bubble);
        
        // Update with text
        bubble.textContent = testText;
        console.log('Updated bubble text');
        
        // Scroll to bottom
        scrollToBottom();
        console.log('Scrolled to bottom');
    };

    // Test WebSocket connection
    window.testWebSocket = function() {
        console.log('Testing WebSocket...');
        console.log('Socket connected:', socket.connected);
        console.log('Socket ID:', socket.id);
        
        // Send test command
        socket.emit('user_command', { command: 'test message', history: [] });
        console.log('Sent test command');
    };

    // Test TTS
    window.testTTS = function() {
        console.log('Testing TTS...');
        speakText('Hello! This is a test of the text to speech system.');
    };

    // Server-side TTS function (NO browser speechSynthesis)
    function speakText(text) {
        console.log('🔊 Server TTS Request:', text);
        
        // Clean text before sending to server
        const cleanText = text
            .replace(/[🎤🤖✅❌🛠️🔗]/g, '') // Remove emojis
            .replace(/\{"tool_name":[^}]+\}/g, '') // Remove JSON tool calls
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
            .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
            .replace(/`(.*?)`/g, '$1') // Remove code markdown
            .replace(/#{1,6}\s?/g, '') // Remove headings
            .replace(/\n+/g, '. ') // Replace newlines with periods
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/[^\w\s.,!?;:()-]/g, '') // Remove other special characters
            .trim();
        
        if (!cleanText || cleanText.length < 2) {
            console.log('No valid text to speak');
            isAssistantSpeaking = false;
            statusIndicator.style.backgroundColor = '#34c759';
            // Auto-start listening immediately if no text to speak
            setTimeout(() => startListening(), 500);
            return;
        }
        
        // Send TTS request to server
        socket.emit('generate_tts', { text: cleanText });
        
        console.log('📤 TTS request sent to server, waiting for audio...');
    }

    function initAudioContext() { 
        if (!audioContext) { 
            try { 
                audioContext = new (window.AudioContext || window.webkitAudioContext)(); 
                if (audioContext.state === 'suspended') { 
                    audioContext.resume(); 
                } 
                console.log('Audio context initialized');
            } catch (e) { 
                console.error("Web Audio API not supported.", e); 
            } 
        } 
    }
    
    function updateHistory(role, content) { 
        chatHistory.push({ role, content }); 
        if (chatHistory.length > 20) { 
            chatHistory = chatHistory.slice(-20); 
        }
        saveSessionToStorage(); // Save after each update
    }
    
    function scrollToBottom() { 
        const currentChatContainer = document.getElementById('chat-container');
        if (currentChatContainer) {
            currentChatContainer.scrollTop = currentChatContainer.scrollHeight; 
        }
    }
    
    function createMessageBubble(text, sender) {
        // Always get fresh reference to chat container
        const currentChatContainer = document.getElementById('chat-container');
        if (!currentChatContainer) {
            console.error('Chat container not found!');
            return null;
        }
        
        const messageWrapper = document.createElement('div'); 
        messageWrapper.classList.add('chat-message', sender); 
        const messageBubble = document.createElement('div'); 
        messageBubble.classList.add('message-bubble'); 
        
        // Format the text properly for display
        if (sender === 'assistant') {
            // Clean up AI responses for better display
            const formattedText = text
                .replace(/🎤\s*User.*?:\s*/g, '') // Remove user prefixes
                .replace(/🤖\s*AI.*?:\s*/g, '') // Remove AI prefixes
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
                .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic text
                .replace(/`(.*?)`/g, '<code>$1</code>') // Code text
                .replace(/\n\n/g, '<br><br>') // Double line breaks
                .replace(/\n/g, '<br>') // Single line breaks
                .trim();
            
            messageBubble.innerHTML = formattedText;
        } else {
            messageBubble.textContent = text;
        }
        
        messageWrapper.appendChild(messageBubble); 
        currentChatContainer.appendChild(messageWrapper); 
        scrollToBottom();
        return messageBubble; 
    }
    function addMessageToChat(text, sender) { 
        const bubble = createMessageBubble(text, sender); 
        if (bubble) scrollToBottom(); 
        return bubble;
    }

    // --- Timer Display Functions ---
    function updateTimerDisplay(timerData) {
        // Only update existing timers, don't create new ones
        // Timer creation is handled by displayActiveTimers()
        let timerElement = document.getElementById(`timer-${timerData.timer_id}`);
        
        if (!timerElement) {
            // Timer doesn't exist in DOM yet, skip update
            // It will be created when displayActiveTimers() is called
            console.log(`Timer ${timerData.timer_id} not found in DOM, skipping update`);
            return;
        }

        // Update only the countdown elements, preserve delete button
        timerElement.innerHTML = `
            <div class="timer-name">${timerData.name}</div>
            <div class="timer-countdown">${timerData.remaining_time}</div>
            <div class="timer-progress">
                ${timerData.remaining_minutes}m ${timerData.remaining_seconds}s remaining
            </div>
            <button class="timer-delete-btn" onclick="deleteTimer(${timerData.timer_id})">
                <i class="fas fa-trash"></i> Delete
            </button>
        `;
    }

    // ===== FEATURE 2: Enhanced Timer Finished Handler =====
    function handleTimerFinished(timerData) {
        const timerElement = document.getElementById(`timer-${timerData.timer_id}`);
        if (timerElement) {
            // Mark as finished
            timerElement.dataset.isFinished = 'true';
            
            // Add spotlight class
            timerElement.classList.add('timer-finished');
            timerElement.innerHTML = `
                <div class="timer-name">${timerData.name}</div>
                <div class="timer-countdown">00:00</div>
                <div class="timer-finished-text">✅ FINISHED!</div>
            `;
            
            // Add voice announcement
            const voiceMessage = `Your ${timerData.name} timer is finished`;
            speakText(voiceMessage);
            
            // Play sound if enabled
            if (userSettings.soundEffects) {
                playTimerSound();
            }
            
            // After 3 seconds, add fade-out animation
            setTimeout(() => {
                if (timerElement) {
                    timerElement.classList.add('timer-fade-out');
                }
            }, 3000);
            
            // Remove after 4 seconds (3s spotlight + 1s fade)
            setTimeout(() => {
                if (timerElement) {
                    timerElement.remove();
                    delete activeTimersData[timerData.timer_id];
                }
            }, 4000);
        }

        // Show browser notification if enabled
        if (userSettings.timerNotifications && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('🍳 Timer Finished!', {
                body: timerData.message || `Timer "${timerData.name}" has finished!`,
                icon: '/static/timer-icon.png',
                requireInteraction: true
            });
        }
    }

    // Play timer finished sound
    function playTimerSound() {
        try {
            const audio = new Audio('/static/sounds/timer-finished.mp3');
            audio.volume = (userSettings.ttsVolume || 80) / 100;
            audio.play().catch(err => {
                console.log('Could not play timer sound:', err);
            });
        } catch (error) {
            console.log('Timer sound not available:', error);
        }
    }

    function displayActiveTimers(data) {
        const timersSection = document.getElementById('timers-container');
        if (!timersSection) {
            console.error('Timers container not found');
            return;
        }

        // Clear existing content
        timersSection.innerHTML = '';
        
        if (data.timers && data.timers.length > 0) {
            console.log('Displaying timers:', data.timers);
            
            // Update activeTimersData for real-time tracking
            activeTimersData = {};
            data.timers.forEach(timer => {
                // Calculate end time for client-side countdown
                const endTime = new Date();
                const remainingMatch = timer.remaining.match(/(\d+):(\d+)/);
                if (remainingMatch) {
                    const minutes = parseInt(remainingMatch[1]);
                    const seconds = parseInt(remainingMatch[2]);
                    endTime.setTime(endTime.getTime() + (minutes * 60 + seconds) * 1000);
                }
                
                activeTimersData[timer.id] = {
                    id: timer.id,
                    name: timer.name,
                    duration_minutes: timer.duration_minutes,
                    endTime: endTime
                };
                
                const timerElement = document.createElement('div');
                timerElement.id = `timer-${timer.id}`;
                timerElement.className = 'timer-item';
                timerElement.innerHTML = `
                    <div class="timer-name">${timer.name}</div>
                    <div class="timer-countdown" id="countdown-${timer.id}">${timer.remaining}</div>
                    <div class="timer-duration">Duration: ${timer.duration_minutes} minutes</div>
                    <button class="timer-delete-btn" onclick="deleteTimer(${timer.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                `;
                timersSection.appendChild(timerElement);
            });
            
            // Start real-time countdown updates
            startTimerUpdates();
        } else {
            const noTimersMessage = document.createElement('div');
            noTimersMessage.className = 'no-timers';
            noTimersMessage.innerHTML = `
                <i class="fas fa-hourglass-half"></i>
                <p>No active timers. Use the form above or say "set a timer for 10 minutes"!</p>
            `;
            timersSection.appendChild(noTimersMessage);
            
            // Clear activeTimersData and stop updates
            activeTimersData = {};
            stopTimerUpdates();
        }
    }

    function startTimerUpdates() {
        // Clear existing interval
        if (timerUpdateInterval) {
            clearInterval(timerUpdateInterval);
        }
        
        // Start new interval that updates every second
        timerUpdateInterval = setInterval(() => {
            updateTimerCountdowns();
        }, 1000);
    }

    function stopTimerUpdates() {
        if (timerUpdateInterval) {
            clearInterval(timerUpdateInterval);
            timerUpdateInterval = null;
        }
    }

    function updateTimerCountdowns() {
        const now = new Date();
        let hasActiveTimers = false;
        
        Object.values(activeTimersData).forEach(timer => {
            const countdownElement = document.getElementById(`countdown-${timer.id}`);
            if (!countdownElement) return;
            
            const remainingMs = timer.endTime.getTime() - now.getTime();
            
            if (remainingMs <= 0) {
                // Timer finished
                countdownElement.textContent = '00:00';
                countdownElement.classList.add('timer-finished');
                // Remove from activeTimersData
                delete activeTimersData[timer.id];
            } else {
                hasActiveTimers = true;
                const totalSeconds = Math.floor(remainingMs / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                countdownElement.classList.remove('timer-finished');
            }
        });
        
        // If no active timers, stop the interval
        if (!hasActiveTimers) {
            stopTimerUpdates();
        }
    }

    // --- Conversion Display Functions ---
    /**
     * Display conversion result
     * Shows in conversation AND optionally in converter view
     */
    function displayConversionResult(data) {
        console.log('Displaying conversion result:', data);
        
        // Always add to conversation for context
        if (data.error) {
            const errorMsg = `⚠️ Conversion Error: ${data.error}`;
            addConversationMessage('assistant', errorMsg);
        } else if (data.result) {
            const conversionMsg = `
                <div class="conversion-result-inline">
                    <strong>🔢 Unit Conversion Result</strong>
                    <div style="display: flex; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 0.5rem;">
                        <span class="conversion-from">${data.amount || ''} ${data.from_unit || ''}</span>
                        <i class="fas fa-arrow-right"></i>
                        <span class="conversion-to">${data.result}</span>
                    </div>
                </div>
            `;
            addConversationMessage('assistant', conversionMsg);
            
            // If we're in the converter view, also update the results there
            if (currentView === 'unitConverter') {
                const conversionsContainer = document.getElementById('conversions-container');
                if (conversionsContainer) {
                    conversionsContainer.innerHTML = `
                        <div class="conversion-result-card">
                            <div class="result-header">
                                <i class="fas fa-check-circle"></i> 
                                <span>Conversion Complete</span>
                            </div>
                            <div class="result-content">
                                <div class="conversion-from">${data.amount || ''} ${data.from_unit || ''}</div>
                                <i class="fas fa-arrow-down conversion-arrow"></i>
                                <div class="conversion-to">
                                    <span class="result-value">${data.result}</span>
                                    <span class="result-unit">${data.to_unit || ''}</span>
                                </div>
                            </div>
                            <div class="copy-instruction">
                                <i class="fas fa-info-circle"></i> 
                                <span>Tap to copy result</span>
                            </div>
                        </div>
                    `;
                    
                    // Add click to copy functionality
                    const resultCard = conversionsContainer.querySelector('.conversion-result-card');
                    if (resultCard) {
                        resultCard.style.cursor = 'pointer';
                        resultCard.addEventListener('click', () => {
                            const resultText = data.result;
                            navigator.clipboard.writeText(resultText).then(() => {
                                // Show copied notification
                                const notification = document.createElement('div');
                                notification.style.cssText = `
                                    position: fixed;
                                    top: 50%;
                                    left: 50%;
                                    transform: translate(-50%, -50%);
                                    background: rgba(76, 175, 80, 0.95);
                                    color: white;
                                    padding: 1rem 2rem;
                                    border-radius: 12px;
                                    font-weight: 600;
                                    z-index: 10000;
                                    animation: fadeInOut 2s ease-out;
                                `;
                                notification.innerHTML = '<i class="fas fa-check"></i> Copied to clipboard!';
                                document.body.appendChild(notification);
                                setTimeout(() => notification.remove(), 2000);
                            }).catch(err => {
                                console.error('Failed to copy:', err);
                            });
                        });
                    }
                }
            }
        }
        
        updateSystemStatus('ready');
    }

    /**
     * Display substitution result
     * Shows in conversation AND optionally in substitutions view
     */
    function displaySubstitutionResult(data) {
        console.log('Displaying substitution result:', data);
        
        // Check if this is AI-generated
        const isAI = data.source === 'ai';
        const sourceBadge = isAI ? '<span class="ai-badge" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: 0.5rem;"><i class="fas fa-robot"></i> AI Generated</span>' : '';
        
        // Always add to conversation for context
        if (data.error) {
            const errorMsg = `⚠️ Substitution Error: ${data.error}`;
            addConversationMessage('assistant', errorMsg);
        } else if (data.substitutions && data.substitutions.length > 0) {
            let substitutionMsg = `
                <div class="substitution-result-inline">
                    <strong>🔄 Ingredient Substitutes for ${data.ingredient || 'ingredient'}:</strong>${sourceBadge}<br>
                    <ul class="substitution-list">`;
            
            data.substitutions.forEach((sub, index) => {
                substitutionMsg += `<li><i class="fas fa-check-circle"></i> ${sub}</li>`;
            });
            
            substitutionMsg += `
                    </ul>
                    <small><i class="fas fa-lightbulb"></i> Tip: ${isAI ? 'AI suggestions may vary by recipe context. ' : ''}Always taste as you go when using substitutes!</small>
                </div>
            `;
            addConversationMessage('assistant', substitutionMsg);
            
            // If we're in the substitutions view, also update the results there
            if (currentView === 'substitutions') {
                const substitutionsContainer = document.getElementById('substitutions-container');
                if (substitutionsContainer) {
                    let html = `
                        <div class="substitution-result-card" style="background: white; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin-bottom: 1rem;">
                            <div class="result-header" style="background: linear-gradient(135deg, rgba(104, 211, 145, 0.1) 0%, rgba(237, 137, 54, 0.1) 100%); padding: 1rem; border-radius: 0.75rem; margin-bottom: 1rem; border-left: 4px solid #68D391; display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; display: flex; align-items: center; gap: 0.5rem; color: #2D3748; font-size: 1.25rem;">
                                    <i class="fas fa-exchange-alt" style="color: #68D391;"></i> 
                                    Substitutes for <span style="color: #ED8936; font-weight: 700;">${data.ingredient || 'ingredient'}</span>
                                </h3>
                                ${isAI ? '<span class="ai-badge" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);"><i class="fas fa-robot"></i> AI Generated</span>' : ''}
                            </div>
                            <div class="result-content">
                                <div class="substitution-options-grid" style="display: grid; gap: 0.75rem;">`;
                    
                    data.substitutions.forEach((sub, index) => {
                        html += `
                                    <div class="substitution-option" style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); padding: 1rem; border-radius: 0.5rem; border: 2px solid #e2e8f0; transition: all 0.3s ease; cursor: pointer;" onmouseover="this.style.borderColor='#68D391'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(104, 211, 145, 0.2)';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                                            <span style="display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 50%; background: #68D391; color: white; font-weight: 700; font-size: 0.875rem;">${index + 1}</span>
                                            <p style="margin: 0; font-size: 0.95rem; font-weight: 500; color: #2D3748;">${sub}</p>
                                        </div>
                                    </div>`;
                    });
                    
                    html += `
                                </div>
                                <div style="background: ${isAI ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, rgba(167, 139, 250, 0.1) 100%)' : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 197, 253, 0.1) 100%)'}; padding: 0.875rem; border-radius: 0.5rem; margin-top: 1rem; border-left: 3px solid ${isAI ? '#9333ea' : '#3b82f6'};">
                                    <p style="margin: 0; font-size: 0.875rem; color: #4b5563; display: flex; align-items: start; gap: 0.5rem;">
                                        <i class="fas fa-${isAI ? 'robot' : 'info-circle'}" style="color: ${isAI ? '#9333ea' : '#3b82f6'}; margin-top: 0.125rem;"></i>
                                        <span><strong>${isAI ? 'AI Note:' : 'Tip:'}</strong> ${isAI ? 'These substitutions are AI-generated based on culinary knowledge. Always consider your specific recipe context and taste preferences.' : 'These substitutions are from our curated database of tested alternatives. Always taste as you go!'}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    `;
                    substitutionsContainer.innerHTML = html;
                }
            }
        }
        
        updateSystemStatus('ready');
    }

    // --- Recipe Display Functions ---
    function displayRecipeResults(data) {
        const recipesContainer = document.getElementById('recipes-container');
        if (!recipesContainer) {
            console.error('recipes-container not found');
            return;
        }

        // Clear previous results
        recipesContainer.innerHTML = '';

        if (data.error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${data.error}`;
            recipesContainer.appendChild(errorDiv);
        } else if (data.recipes && data.recipes.length > 0) {
            data.recipes.forEach(recipe => {
                const recipeCard = createRecipeCard(recipe);
                recipesContainer.appendChild(recipeCard);
            });
        } else {
            const noResultsDiv = document.createElement('div');
            noResultsDiv.className = 'no-content';
            noResultsDiv.innerHTML = `
                <i class="fas fa-search"></i>
                <p>No recipes found for your search. Try different terms!</p>
            `;
            recipesContainer.appendChild(noResultsDiv);
        }
    }

    // Recipe title to local image mapping
    const recipeImageMap = {
        'butter chicken': 'butter-chicken.jpg',
        'butter': 'butter-chicken.jpg',
        'chicken': 'butter-chicken.jpg',
        'curry': 'butter-chicken.jpg',
        'chocolate': 'chocolate-lava-cake.jpg',
        'lava cake': 'chocolate-lava-cake.jpg',
        'dessert': 'chocolate-lava-cake.jpg',
        'cake': 'chocolate-lava-cake.jpg',
        'sushi': 'sushi-rolls.jpg',
        'japanese': 'sushi-rolls.jpg',
        'roll': 'sushi-rolls.jpg',
        'taco': 'tacos-carnitas.jpg',
        'mexican': 'tacos-carnitas.jpg',
        'carnitas': 'tacos-carnitas.jpg',
        'risotto': 'mushroom-risotto.jpg',
        'mushroom': 'mushroom-risotto.jpg',
        'italian': 'mushroom-risotto.jpg',
        'pasta': 'handmade-pasta.jpg',
        'spaghetti': 'handmade-pasta.jpg',
        'noodles': 'handmade-pasta.jpg',
        'beef': 'beef-wellington.jpg',
        'wellington': 'beef-wellington.jpg',
        'steak': 'beef-wellington.jpg',
        'wine': 'wine-pairing.jpg',
        'pairing': 'wine-pairing.jpg'
    };

    // Function to get local image based on recipe title
    function getRecipeImage(recipe) {
        // First check if recipe has an image from API
        if (recipe.image && recipe.image.startsWith('http')) {
            return recipe.image;
        }

        // Try to match recipe title with local images
        const title = recipe.title.toLowerCase();
        
        // Check for exact or partial matches
        for (const [keyword, imageName] of Object.entries(recipeImageMap)) {
            if (title.includes(keyword)) {
                return `/static/images/${imageName}`;
            }
        }

        // Fallback to generic images based on meal type
        if (recipe.dishTypes) {
            const dishType = recipe.dishTypes[0]?.toLowerCase() || '';
            if (dishType.includes('dessert')) return '/static/images/chocolate-lava-cake.jpg';
            if (dishType.includes('appetizer')) return '/static/images/sushi-rolls.jpg';
            if (dishType.includes('main')) return '/static/images/chef-preparation.jpg';
        }

        // Default fallback
        return '/static/images/ingredients.jpg';
    }

    function createRecipeCard(recipe) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'recipe-card';
        // Link to the recipe detail page with advanced features
        cardDiv.onclick = () => window.location.href = `/recipe/${recipe.id}`;
        cardDiv.style.cursor = 'pointer';

        // Get appropriate image for recipe
        const recipeImage = getRecipeImage(recipe);

        // Create nutrition badges
        let nutritionHTML = '';
        if (recipe.nutrition && Object.keys(recipe.nutrition).length > 0) {
            nutritionHTML = '<div class="recipe-nutrition">';
            Object.entries(recipe.nutrition).forEach(([key, value]) => {
                if (key === 'calories') {
                    nutritionHTML += `<span class="nutrition-badge">${Math.round(value.amount)} ${value.unit}</span>`;
                }
            });
            nutritionHTML += '</div>';
        }

        // Create tags from diets and dish types
        let tagsHTML = '';
        const allTags = [...(recipe.diets || []), ...(recipe.dishTypes || [])];
        if (allTags.length > 0) {
            tagsHTML = '<div class="recipe-tags">';
            allTags.slice(0, 4).forEach(tag => {
                tagsHTML += `<span class="recipe-tag">${tag}</span>`;
            });
            tagsHTML += '</div>';
        }

        // Create ingredients list (show first 4 in card)
        let ingredientsHTML = '';
        if (recipe.ingredients && recipe.ingredients.length > 0) {
            ingredientsHTML = `
                <div class="recipe-ingredients">
                    <h4><i class="fas fa-list"></i> Ingredients (${recipe.ingredients.length})</h4>
                    <div class="ingredients-list">
                        ${recipe.ingredients.slice(0, 4).map(ing => 
                            `<div class="ingredient-item" title="${ing.original || ing.name}">${ing.name}</div>`
                        ).join('')}
                        ${recipe.ingredients.length > 4 ? `<div class="ingredient-more">+ ${recipe.ingredients.length - 4} more ingredients</div>` : ''}
                    </div>
                </div>
            `;
        }

        cardDiv.innerHTML = `
            <img src="${recipeImage}" alt="${recipe.title}" class="recipe-image" onerror="this.src='/static/images/ingredients.jpg'">
            <div class="recipe-content">
                <h3 class="recipe-title">${recipe.title}</h3>
                <div class="recipe-meta">
                    <div class="recipe-time">
                        <i class="fas fa-clock"></i>
                        <span>${recipe.readyInMinutes || 0} min</span>
                    </div>
                    <div class="recipe-servings">
                        <i class="fas fa-users"></i>
                        <span>${recipe.servings || 'N/A'} servings</span>
                    </div>
                </div>
                ${nutritionHTML}
                ${tagsHTML}
                ${ingredientsHTML}
                ${recipe.summary ? `<div class="recipe-summary">${recipe.summary}</div>` : ''}
                <div class="recipe-cta">
                    <button class="recipe-view-btn" onclick="event.stopPropagation(); window.location.href='/recipe/${recipe.id}'">
                        <i class="fas fa-utensils"></i> Cook This Recipe
                    </button>
                </div>
            </div>
        `;

        return cardDiv;
    }

    function showRecipeDetails(recipeId) {
        console.log('Showing recipe details for:', recipeId);
        // This would typically fetch detailed recipe information
        // For now, we'll just scroll to the recipe section
        document.querySelector('.recipes-section').scrollIntoView({ 
            behavior: 'smooth' 
        });
    }

    // Global function for HTML onclick handler
    window.toggleManualControls = function() {
        const content = document.querySelector('.manual-controls-content');
        const button = document.querySelector('.toggle-manual-controls i');
        
        if (content && button) {
            if (content.style.display === 'none') {
                content.style.display = 'block';
                button.className = 'fas fa-chevron-up';
            } else {
                content.style.display = 'none';
                button.className = 'fas fa-chevron-down';
            }
        }
    };

    // Global function for playing YouTube videos
    window.playVideo = function(videoId, title = '') {
        if (videoId && videoId !== 'search_redirect') {
            // Find the video title from the current results if not provided
            if (!title) {
                const videoResult = document.querySelector(`[onclick*="${videoId}"]`);
                if (videoResult) {
                    const titleElement = videoResult.closest('.video-result').querySelector('.title');
                    title = titleElement ? titleElement.textContent : 'Playing video...';
                }
            }
            
            console.log('Playing video in fullscreen:', videoId, 'Title:', title);
            
            // Store video title for fullscreen modal
            currentVideoTitle = title;
            
            // Open directly in fullscreen mode
            openVideoInFullscreen(videoId, title);
            
            // Announce via voice
            speakText(`Playing ${title || 'video'}`);
            showSmartNotification('🎥 Opening video in fullscreen', 'info');
        }
    };

    // Open video directly in fullscreen
    function openVideoInFullscreen(videoId, title = '') {
        // Remove existing modal if any
        const existingModal = document.getElementById('video-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create fullscreen modal
        const modal = document.createElement('div');
        modal.id = 'video-modal';
        modal.className = 'fullscreen-modal';
        
        modal.innerHTML = `
            <div class="modal-content video-modal-content">
                <div class="modal-header">
                    <h2>${title || 'Video'}</h2>
                    <div class="video-modal-controls">
                        <button class="modal-control-btn" id="modal-play-pause" title="Play/Pause">
                            <i class="fas fa-pause"></i>
                        </button>
                        <button class="modal-control-btn" id="modal-volume-down" title="Volume Down">
                            <i class="fas fa-volume-down"></i>
                        </button>
                        <button class="modal-control-btn" id="modal-volume-up" title="Volume Up">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <button class="modal-control-btn" onclick="closeVideoModal()" title="Close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="modal-body video-modal-body">
                    <div id="fullscreen-youtube-player"></div>
                </div>
                <div class="video-instructions">
                    <p><i class="fas fa-microphone"></i> Voice commands: "pause video", "play video", "volume up", "volume down", "close video"</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Show modal with animation
        setTimeout(() => {
            modal.classList.add('show');
            
            // Create fullscreen player
            window.fullscreenPlayer = new YT.Player('fullscreen-youtube-player', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: { 
                    'autoplay': 1, 
                    'controls': 1,
                    'rel': 0,
                    'modestbranding': 1,
                    'fs': 1  // Enable native fullscreen
                },
                events: {
                    'onReady': (event) => {
                        event.target.playVideo();
                        setupFullscreenControls(event.target);
                    },
                    'onStateChange': (event) => {
                        updateFullscreenPlayButton(event.target);
                    }
                }
            });
            
        }, 10);
    }
    
    // Setup manual controls for fullscreen video
    function setupFullscreenControls(player) {
        const playPauseBtn = document.getElementById('modal-play-pause');
        const volumeUpBtn = document.getElementById('modal-volume-up');
        const volumeDownBtn = document.getElementById('modal-volume-down');
        
        if (playPauseBtn) {
            playPauseBtn.onclick = () => {
                const state = player.getPlayerState();
                if (state === YT.PlayerState.PLAYING) {
                    player.pauseVideo();
                    speakText('Video paused');
                } else {
                    player.playVideo();
                    speakText('Video playing');
                }
            };
        }
        
        if (volumeUpBtn) {
            volumeUpBtn.onclick = () => {
                const currentVolume = player.getVolume();
                const newVolume = Math.min(100, currentVolume + 10);
                player.setVolume(newVolume);
                speakText(`Volume ${Math.round(newVolume)}%`);
            };
        }
        
        if (volumeDownBtn) {
            volumeDownBtn.onclick = () => {
                const currentVolume = player.getVolume();
                const newVolume = Math.max(0, currentVolume - 10);
                player.setVolume(newVolume);
                speakText(`Volume ${Math.round(newVolume)}%`);
            };
        }
    }
    
    // Update fullscreen play/pause button icon
    function updateFullscreenPlayButton(player) {
        const playPauseBtn = document.getElementById('modal-play-pause');
        if (!playPauseBtn) return;
        
        const state = player.getPlayerState();
        const icon = playPauseBtn.querySelector('i');
        
        if (state === YT.PlayerState.PLAYING) {
            icon.className = 'fas fa-pause';
            playPauseBtn.title = 'Pause';
        } else {
            icon.className = 'fas fa-play';
            playPauseBtn.title = 'Play';
        }
    }

    // Global function for deleting timers
    window.deleteTimer = function(timerId) {
        const command = `delete timer ${timerId}`;
        console.log('Delete timer command:', command);
        
        // Remove from client-side tracking immediately
        delete activeTimersData[timerId];
        
        // Add visual feedback (fade out) while waiting for server response
        const timerElement = document.getElementById(`timer-${timerId}`);
        if (timerElement) {
            timerElement.style.transition = 'opacity 0.3s ease-out';
            timerElement.style.opacity = '0.3';
            timerElement.style.pointerEvents = 'none';
        }
        
        // Send delete command to backend
        // Backend will send updated timers_list which will refresh the display
        processCommand(command);
    };

    // Request video play via voice command
    window.requestVideoPlay = function(resultNumber) {
        const command = `play video ${resultNumber}`;
        addConversationMessage('user', `Say: "${command}"`);
        // Trigger TTS to read the command
        const utterance = new SpeechSynthesisUtterance(`To play this video, say: play video ${resultNumber}`);
        speechSynthesis.speak(utterance);
    };

    // Helper function to add conversation messages
    /**
     * Add a message to the conversation view
     * This works whether conversation view is active or not
     */
    function addConversationMessage(type, text) {
        // Get the chat container - it's always in the DOM (conversation view is preserved)
        const currentChatContainer = document.getElementById('chat-container');
        
        if (!currentChatContainer) {
            console.error('Chat container not found!');
            return;
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        
        if (type === 'assistant') {
            messageBubble.innerHTML = `<i class="fas fa-chef-hat"></i> ${text}`;
        } else {
            messageBubble.innerHTML = text; // Allow HTML in messages
        }
        
        messageDiv.appendChild(messageBubble);
        currentChatContainer.appendChild(messageDiv);
        
        // Scroll to bottom if conversation view is active
        if (currentView === 'conversation') {
            scrollToBottom();
        }
    }
    
    /**
     * Add a message and optionally switch to conversation view
     */
    function addMessageAndShow(type, text, switchToConversation = false) {
        addConversationMessage(type, text);
        
        if (switchToConversation && currentView !== 'conversation') {
            setTimeout(() => switchView('conversation'), 100);
        }
    }

    // === FULLSCREEN VIDEO MODAL ===
    function showVideoFullscreen() {
        if (!player) return;
        
        const videoId = player.getVideoData()?.video_id;
        if (!videoId) return;
        
        // Get current playback position
        const currentTime = player.getCurrentTime();
        
        // Pause the original small player
        player.pauseVideo();
        console.log('Paused small player for fullscreen');
        
        // Remove existing modal if any
        const existingModal = document.getElementById('video-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'video-modal';
        modal.className = 'fullscreen-modal';
        
        modal.innerHTML = `
            <div class="modal-content video-modal-content">
                <div class="modal-header">
                    <h2>${currentVideoTitle || 'Video'}</h2>
                    <div class="video-modal-controls">
                        <button class="modal-control-btn" onclick="minimizeVideo()" title="Minimize">
                            <i class="fas fa-compress"></i>
                        </button>
                        <button class="modal-close" onclick="closeVideoModal()" title="Close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="modal-body video-modal-body">
                    <div id="fullscreen-youtube-player"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                minimizeVideo();
            }
        });
        
        // Show modal
        setTimeout(() => {
            modal.classList.add('show');
            
            // Create fullscreen player
            const fullscreenPlayer = new YT.Player('fullscreen-youtube-player', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: { 
                    'autoplay': 1, 
                    'controls': 1,
                    'rel': 0,
                    'modestbranding': 1,
                    'fs': 1  // Enable fullscreen
                },
                events: {
                    'onReady': (event) => {
                        // Start from the same position as small player
                        event.target.seekTo(currentTime, true);
                        event.target.playVideo();
                    }
                }
            });
            
        }, 10);
    }
    
    function minimizeVideo() {
        const modal = document.getElementById('video-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }
    
    function closeVideoModal() {
        const modal = document.getElementById('video-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
                // Clean up fullscreen player reference
                if (window.fullscreenPlayer && window.fullscreenPlayer.destroy) {
                    window.fullscreenPlayer.destroy();
                }
                window.fullscreenPlayer = null;
            }, 300);
        }
        
        speakText('Video closed');
        showSmartNotification('📺 Video closed', 'info');
    }

    // Make functions globally accessible
    window.minimizeVideo = minimizeVideo;
    window.closeVideoModal = closeVideoModal;
    window.showFullRecipe = showFullRecipe;
    window.closeRecipeModal = closeRecipeModal;
    window.showVideoFullscreen = showVideoFullscreen;

    // === FULLSCREEN RECIPE MODAL ===
    function showFullRecipe(recipeId) {
        console.log('showFullRecipe called with ID:', recipeId);
        console.log('Recipe ID type:', typeof recipeId);
        
        if (!recipeId || recipeId === 'undefined' || recipeId === 'null') {
            console.error('Invalid recipe ID:', recipeId);
            alert('Recipe ID is invalid. Please try searching for recipes again.');
            return;
        }
        
        // Navigate to recipe detail page instead of showing modal
        console.log('Navigating to recipe detail page:', `/recipe/${recipeId}`);
        window.location.href = `/recipe/${recipeId}`;
    }
    
    function displayFullRecipeModal(recipe) {
        // Remove existing modal if any
        const existingModal = document.getElementById('recipe-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'recipe-modal';
        modal.className = 'fullscreen-modal';
        
        // Create ingredients HTML
        let ingredientsHTML = '';
        if (recipe.ingredients && recipe.ingredients.length > 0) {
            ingredientsHTML = `
                <div class="modal-section">
                    <h3><i class="fas fa-list-ul"></i> Ingredients (${recipe.ingredients.length})</h3>
                    <div class="ingredients-grid">
                        ${recipe.ingredients.map(ing => `
                            <div class="ingredient-card">
                                <div class="ingredient-name">${ing.name}</div>
                                <div class="ingredient-amount">${ing.original || (ing.amount + ' ' + (ing.unit || '')).trim()}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Create instructions HTML
        let instructionsHTML = '';
        if (recipe.instructions && recipe.instructions.length > 0) {
            instructionsHTML = `
                <div class="modal-section">
                    <h3><i class="fas fa-list-ol"></i> Instructions</h3>
                    <div class="instructions-list">
                        ${recipe.instructions.map(inst => `
                            <div class="instruction-step">
                                <div class="step-number">${inst.number}</div>
                                <div class="step-text">${inst.step}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Create nutrition HTML
        let nutritionHTML = '';
        if (recipe.nutrition && Object.keys(recipe.nutrition).length > 0) {
            nutritionHTML = `
                <div class="modal-section">
                    <h3><i class="fas fa-chart-pie"></i> Nutrition Information</h3>
                    <div class="nutrition-grid">
                        ${Object.entries(recipe.nutrition).map(([key, value]) => `
                            <div class="nutrition-card">
                                <div class="nutrition-label">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
                                <div class="nutrition-value">${Math.round(value.amount)} ${value.unit}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        modal.innerHTML = `
            <div class="modal-content recipe-modal-content">
                <div class="modal-header">
                    <h2>${recipe.title}</h2>
                    <button class="modal-close" onclick="closeRecipeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="recipe-hero">
                        ${recipe.image ? `<img src="${recipe.image}" alt="${recipe.title}" class="recipe-hero-image">` : ''}
                        <div class="recipe-meta-large">
                            <div class="meta-item">
                                <i class="fas fa-clock"></i>
                                <span>${recipe.readyInMinutes || 30} minutes</span>
                            </div>
                            <div class="meta-item">
                                <i class="fas fa-users"></i>
                                <span>${recipe.servings || 4} servings</span>
                            </div>
                            ${recipe.category ? `
                                <div class="meta-item">
                                    <i class="fas fa-tag"></i>
                                    <span>${recipe.category}</span>
                                </div>
                            ` : ''}
                            ${recipe.area ? `
                                <div class="meta-item">
                                    <i class="fas fa-globe"></i>
                                    <span>${recipe.area} Cuisine</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    ${nutritionHTML}
                    ${ingredientsHTML}
                    ${instructionsHTML}
                    ${recipe.youtube ? `
                        <div class="modal-section">
                            <h3><i class="fab fa-youtube"></i> Video Tutorial</h3>
                            <a href="${recipe.youtube}" target="_blank" class="youtube-link">
                                <i class="fab fa-youtube"></i> Watch on YouTube
                            </a>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeRecipeModal();
            }
        });
        
        // Show modal
        setTimeout(() => modal.classList.add('show'), 10);
    }
    
    function closeRecipeModal() {
        const modal = document.getElementById('recipe-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }
    
    // Listen for full recipe details
    socket.on('recipe_details', (data) => {
        // Remove loading modal
        const loadingModal = document.getElementById('recipe-loading-modal');
        if (loadingModal) {
            loadingModal.remove();
        }
        
        if (data.success && data.recipe) {
            displayFullRecipeModal(data.recipe);
        } else {
            console.error('Failed to get recipe details:', data.error);
            
            // Show error modal
            const errorModal = document.createElement('div');
            errorModal.className = 'fullscreen-modal show';
            errorModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Recipe Not Available</h2>
                        <button class="modal-close" onclick="this.closest('.fullscreen-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="error-message">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>${data.error || 'Unable to load recipe details. Please try again.'}</p>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(errorModal);
            
            // Auto-remove error modal after 3 seconds
            setTimeout(() => {
                if (errorModal.parentNode) {
                    errorModal.remove();
                }
            }, 3000);
        }
    });

    // Cleanup timer intervals when page unloads
    window.addEventListener('beforeunload', () => {
        stopTimerUpdates();
    });

    // === SECTION RESIZING FUNCTIONALITY ===
    function resizeSection(button, action) {
        const section = button.closest('section');
        const currentStyle = window.getComputedStyle(section);
        
        if (action === 'expand') {
            // Increase section size
            const currentWidth = parseInt(currentStyle.width);
            const currentHeight = parseInt(currentStyle.height);
            
            section.style.width = Math.min(currentWidth * 1.2, window.innerWidth * 0.8) + 'px';
            section.style.height = Math.min(currentHeight * 1.2, window.innerHeight * 0.8) + 'px';
            
            // Visual feedback
            button.style.background = 'var(--success-color)';
            setTimeout(() => {
                button.style.background = '';
            }, 300);
            
        } else if (action === 'shrink') {
            // Decrease section size
            const currentWidth = parseInt(currentStyle.width);
            const currentHeight = parseInt(currentStyle.height);
            
            section.style.width = Math.max(currentWidth * 0.8, 200) + 'px';
            section.style.height = Math.max(currentHeight * 0.8, 150) + 'px';
            
            // Visual feedback
            button.style.background = 'var(--warning-color)';
            setTimeout(() => {
                button.style.background = '';
            }, 300);
        }
        
        // Add resize animation
        section.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            section.style.transition = '';
        }, 300);
    }

    // === SMART NOTIFICATION SYSTEM ===
    function showSmartNotification(message, type = 'info') {
        // Remove existing notification if any
        const existingNotification = document.querySelector('.smart-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `smart-notification smart-notification-${type}`;
        notification.textContent = message;
        
        // Add to DOM
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Auto-remove after 2.5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 2500);
    }

    // Make resizeSection globally accessible
    window.resizeSection = resizeSection;

    // Initialize status bar
    updateSystemStatus('idle');

    // Initialize conversation view (attach manual message form handler)
    showConversationView();

    // ============================================
    // HELP & TOUR SYSTEM
    // ============================================
    
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const helpCloseBtn = document.getElementById('help-close-btn');
    const helpTabs = document.querySelectorAll('.help-tab');
    const helpTabContents = document.querySelectorAll('.help-tab-content');
    const startTourBtn = document.getElementById('start-tour-btn');
    const tourOverlay = document.getElementById('tour-overlay');
    
    // Help Modal Functions
    window.openHelpModal = function() {
        helpModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Check if user has completed tour
        const tourCompleted = localStorage.getItem('tourCompleted');
        if (!tourCompleted) {
            showSmartNotification('👋 Welcome! Take the tour to learn about all features!', 'info');
        }
    };
    
    window.closeHelpModal = function() {
        helpModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };
    
    // Event Listeners for Help Modal
    if (helpBtn) {
        helpBtn.addEventListener('click', openHelpModal);
    }
    
    if (helpCloseBtn) {
        helpCloseBtn.addEventListener('click', closeHelpModal);
    }
    
    // Close modal on backdrop click
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            closeHelpModal();
        }
    });
    
    // Tab Switching
    helpTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            helpTabs.forEach(t => t.classList.remove('active'));
            helpTabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            document.getElementById(`${tabName}-content`).classList.add('active');
        });
    });
    
    // ============================================
    // INTERACTIVE TOUR SYSTEM
    // ============================================
    
    const tourSteps = [
        {
            element: '#chat-container',
            title: '👋 Welcome to Your Kitchen Assistant!',
            text: 'This is where all your conversations happen. Ask me anything about cooking, recipes, or kitchen tips!',
            position: 'bottom'
        },
        {
            element: '#mic-button',
            title: '🎤 Voice Control',
            text: 'Click and hold to talk! Or enable hands-free mode and just say "Hey Kitchen" to wake me up. Perfect when your hands are messy!',
            position: 'top'
        },
        {
            element: '#hands-free-toggle',
            title: '🙌 Hands-Free Mode',
            text: 'Toggle this ON to enable wake word detection. Then you can say "Hey Kitchen" anytime to start talking!',
            position: 'left'
        },
        {
            element: '#manual-message-form',
            title: '⌨️ Type Messages',
            text: 'Prefer typing? Use this input box! Press Enter to send your message or question.',
            position: 'top'
        },
        {
            element: '#timers-container',
            title: '⏰ Smart Timers',
            text: 'Set multiple named timers by saying "Set pasta timer for 10 minutes". All your active timers appear here!',
            position: 'left'
        },
        {
            element: '#conversions-container',
            title: '🔄 Unit Converter',
            text: 'Ask me to convert measurements! "Convert 2 cups to ml" or "How many tablespoons in 1 cup?" - I got you covered!',
            position: 'left'
        },
        {
            element: '#history-btn',
            title: '📜 Conversation History',
            text: 'Click here to see ALL your past conversations with search, filters, and export features!',
            position: 'bottom'
        },
        {
            element: '#chat-container',
            title: '👤 Enhanced Profile & Gamification',
            text: 'Click the Profile button in the header to track your cooking journey! Earn XP, unlock achievements, view your chef level, and see statistics like recipes cooked, cooking hours, and cuisine distribution charts!',
            position: 'bottom'
        },
        {
            element: '#chat-container',
            title: '📖 Recipe Detail Pages',
            text: 'When you search for recipes and click on any result, you\'ll get a beautiful detail page with complete ingredients, step-by-step instructions, nutritional info, and cooking time!',
            position: 'bottom'
        },
        {
            element: '#chat-container',
            title: '🎥 YouTube Video Detail Pages',
            text: 'Search for recipe videos and click on any result to open a beautiful detail page with auto-extracted ingredients, steps, and the ability to save notes!',
            position: 'bottom'
        },
        {
            element: '#settings-btn',
            title: '⚙️ Settings',
            text: 'Customize your experience! Adjust voice speed, volume, notifications, and more.',
            position: 'bottom'
        },
        {
            element: '#chat-container',
            title: '🎉 You\'re All Set!',
            text: 'Now you\'re a Kitchen Assistant pro! Try asking "Find me pasta recipes" or "Show me pasta video" to explore. Don\'t forget to check your Profile to track achievements!',
            position: 'bottom'
        }
    ];
    
    let currentTourStep = 0;
    let tourActive = false;
    
    // Start Tour
    window.startTour = function() {
        tourActive = true;
        currentTourStep = 0;
        closeHelpModal();
        tourOverlay.classList.add('active');
        showTourStep(currentTourStep);
    };
    
    // Show Tour Step
    function showTourStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= tourSteps.length) {
            completeTour();
            return;
        }
        
        const step = tourSteps[stepIndex];
        const element = document.querySelector(step.element);
        
        if (!element) {
            console.warn(`Tour element not found: ${step.element}`);
            nextTourStep();
            return;
        }
        
        // Get element position
        const rect = element.getBoundingClientRect();
        const spotlight = document.querySelector('.tour-spotlight');
        const tooltip = document.querySelector('.tour-tooltip');
        
        // Update spotlight (create cutout effect with box-shadow)
        const spotlightSize = 20; // padding around element
        spotlight.style.boxShadow = `
            0 0 0 9999px rgba(0, 0, 0, 0.8),
            inset 0 0 ${spotlightSize}px rgba(255, 107, 53, 0.3)
        `;
        spotlight.style.top = `${rect.top - spotlightSize}px`;
        spotlight.style.left = `${rect.left - spotlightSize}px`;
        spotlight.style.width = `${rect.width + spotlightSize * 2}px`;
        spotlight.style.height = `${rect.height + spotlightSize * 2}px`;
        spotlight.style.borderRadius = '15px';
        spotlight.style.pointerEvents = 'none';
        
        // Position tooltip
        tooltip.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');
        
        let tooltipTop, tooltipLeft;
        
        switch(step.position) {
            case 'top':
                tooltip.classList.add('arrow-bottom');
                tooltipTop = rect.top - tooltip.offsetHeight - 30;
                tooltipLeft = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
                break;
            case 'bottom':
                tooltip.classList.add('arrow-top');
                tooltipTop = rect.bottom + 30;
                tooltipLeft = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
                break;
            case 'left':
                tooltip.classList.add('arrow-right');
                tooltipTop = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2);
                tooltipLeft = rect.left - tooltip.offsetWidth - 30;
                break;
            case 'right':
                tooltip.classList.add('arrow-left');
                tooltipTop = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2);
                tooltipLeft = rect.right + 30;
                break;
        }
        
        // Ensure tooltip stays within viewport
        tooltipTop = Math.max(20, Math.min(tooltipTop, window.innerHeight - tooltip.offsetHeight - 20));
        tooltipLeft = Math.max(20, Math.min(tooltipLeft, window.innerWidth - tooltip.offsetWidth - 20));
        
        tooltip.style.top = `${tooltipTop}px`;
        tooltip.style.left = `${tooltipLeft}px`;
        
        // Update tooltip content
        document.querySelector('.tour-step-number').textContent = `Step ${stepIndex + 1} of ${tourSteps.length}`;
        document.querySelector('.tour-tooltip-title').textContent = step.title;
        document.querySelector('.tour-tooltip-text').textContent = step.text;
        
        // Update buttons
        const prevBtn = document.querySelector('.tour-btn-prev');
        const nextBtn = document.querySelector('.tour-btn-next');
        
        prevBtn.disabled = stepIndex === 0;
        
        if (stepIndex === tourSteps.length - 1) {
            nextBtn.innerHTML = '<i class="fas fa-check"></i> Finish Tour';
            nextBtn.classList.add('complete');
        } else {
            nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
            nextBtn.classList.remove('complete');
        }
        
        // Scroll element into view smoothly
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Next Tour Step
    window.nextTourStep = function() {
        currentTourStep++;
        if (currentTourStep >= tourSteps.length) {
            completeTour();
        } else {
            showTourStep(currentTourStep);
        }
    };
    
    // Previous Tour Step
    window.prevTourStep = function() {
        currentTourStep--;
        if (currentTourStep < 0) {
            currentTourStep = 0;
        }
        showTourStep(currentTourStep);
    };
    
    // Skip Tour
    window.skipTour = function() {
        if (confirm('Are you sure you want to skip the tour? You can restart it anytime from the Help menu!')) {
            completeTour();
        }
    };
    
    // Complete Tour
    function completeTour() {
        tourActive = false;
        tourOverlay.classList.remove('active');
        
        // Show confetti celebration
        createConfetti();
        
        // Mark tour as completed
        localStorage.setItem('tourCompleted', 'true');
        
        // Show success message
        setTimeout(() => {
            showSmartNotification('🎉 Tour completed! You\'re now a Kitchen Assistant pro!', 'success');
        }, 500);
    }
    
    // Confetti Animation
    function createConfetti() {
        const colors = ['#ff6b35', '#f7931e', '#ffd700', '#ff1493', '#00ced1'];
        const confettiCount = 50;
        
        for (let i = 0; i < confettiCount; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti-piece';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDelay = Math.random() * 0.5 + 's';
                confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
                
                document.body.appendChild(confetti);
                
                setTimeout(() => {
                    confetti.remove();
                }, 4000);
            }, i * 30);
        }
    }
    
    // Start Tour Button
    if (startTourBtn) {
        startTourBtn.addEventListener('click', startTour);
    }
    
    // Auto-show help modal for first-time users
    const tourCompleted = localStorage.getItem('tourCompleted');
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    
    if (!tourCompleted && !hasSeenWelcome) {
        setTimeout(() => {
            openHelpModal();
            localStorage.setItem('hasSeenWelcome', 'true');
        }, 2000); // Show after 2 seconds on first visit
    }
    
    // Keyboard shortcut for help (Ctrl+H or Cmd+H)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
            e.preventDefault();
            openHelpModal();
        }
    });

});
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

    // --- State & Setup ---
    let player; // YouTube player object
    let currentVideoTitle = '';
    let isListening = false;
    let sessionId = null;
    let chatHistory = [];
    let activeTimers = [];
    let audioContext = null;
    let isAssistantSpeaking = false;
    let currentAudioSource = null;
    let assistantMessageBubble = null;
    let backendAudioReceived = false;

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
    }

    function onPlayerStateChange(event) {
        updatePlayPauseButton();
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
        console.log('Player exists:', !!player);
        console.log('Current video title:', currentVideoTitle);
        
        if (cmd.includes('play video') || cmd.includes('play the video')) {
            if (player) player.playVideo();
            return true;
        } else if (cmd.includes('pause video') || cmd.includes('pause the video')) {
            if (player) player.pauseVideo();
            return true;
        } else if (cmd.includes('stop video') || cmd.includes('stop the video')) {
            if (player) {
                player.stopVideo();
                videoPlayerContainer.classList.add('video-player-hidden');
                videoTitleSpan.textContent = 'No video selected';
            }
            return true;
        } else if (cmd.includes('fullscreen video') || cmd.includes('video fullscreen') || cmd.includes('make video fullscreen') || 
                   cmd.includes('video full screen') || cmd.includes('full screen video') || cmd.includes('go fullscreen')) {
            console.log('Fullscreen command detected!');
            if (player && currentVideoTitle) {
                console.log('Opening video fullscreen...');
                showVideoFullscreen();
                return true;
            } else {
                console.log('Cannot fullscreen - player:', !!player, 'title:', currentVideoTitle);
                // Try to fullscreen anyway if player exists
                if (player) {
                    console.log('Trying fullscreen without title check...');
                    showVideoFullscreen();
                    return true;
                }
            }
            return true;
        } else if (cmd.includes('close fullscreen') || cmd.includes('exit fullscreen') || cmd.includes('minimize video') ||
                   cmd.includes('close full screen') || cmd.includes('exit full screen') || cmd.includes('band karo') ||
                   cmd.includes('band kar') || cmd.includes('close kar') || cmd.includes('bandh kar')) {
            console.log('Close fullscreen command detected!');
            const modal = document.getElementById('video-modal');
            if (modal) {
                console.log('Closing video fullscreen...');
                closeVideoModal();
                return true;
            } else {
                console.log('No fullscreen modal found to close');
            }
            return true;
        } else if (cmd.includes('volume up')) {
            if (player && player.setVolume) {
                const currentVolume = player.getVolume();
                player.setVolume(Math.min(100, currentVolume + 10));
            }
            return true;
        } else if (cmd.includes('volume down')) {
            if (player && player.setVolume) {
                const currentVolume = player.getVolume();
                player.setVolume(Math.max(0, currentVolume - 10));
            }
            return true;
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
                        <i class="fas fa-expand"></i> View Full Recipe
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

    // --- Speech Recognition Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-IN';
        recognition.interimResults = false;
        console.log('Speech Recognition initialized successfully');
    } else {
        console.error('Speech Recognition not supported in this browser');
        micStatus.textContent = 'Speech recognition not supported';
        micButton.style.opacity = '0.5';
        micButton.style.cursor = 'not-allowed';
    }

    // --- Event Listeners ---
    micButton.addEventListener('click', async () => {
        console.log('Microphone button clicked');
        if (!recognition) {
            console.error('Speech recognition not available');
            micStatus.textContent = 'Speech recognition not supported';
            return;
        }
        
        // Request microphone permission
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Microphone permission granted');
            stream.getTracks().forEach(track => track.stop()); // Stop the stream, we just needed permission
            micStatus.textContent = 'Microphone ready';
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
            micStatus.textContent = 'Listening...';
        };
        
        recognition.onend = () => { 
            console.log('Speech recognition ended');
            isListening = false; 
            micButton.classList.remove('listening'); 
            micStatus.textContent = 'Click to speak';
        };
        
        recognition.onerror = (event) => { 
            console.error('Recognition error:', event.error);
            isListening = false;
            micButton.classList.remove('listening');
            micStatus.textContent = `Error: ${event.error}`;
            if (event.error !== 'no-speech') {
                addMessageToChat(`Recognition Error: ${event.error}`, 'assistant'); 
            }
        };
    }

    // Initialize microphone after recognition setup
    initializeMicrophone();

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
        
        // Check if it's a video voice command first
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
        addMessageToChat(commandText, 'user');
        updateHistory("user", commandText);
        assistantMessageBubble = createMessageBubble('', 'assistant');
        console.log('Created assistant message bubble:', assistantMessageBubble);
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
        console.log('Session ID received:', data.session_id);
        sessionId = data.session_id;
    });

    socket.on('timer_set', (data) => {
        console.log('Timer set:', data);
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
        // Request updated timers list to refresh display
        socket.emit('get_timers');
    });

    socket.on('timers_list', (data) => {
        console.log('Timers list received:', data);
        console.log('Timer data structure:', JSON.stringify(data, null, 2));
        displayActiveTimers(data);
    });

    socket.on('conversion_result', (data) => {
        console.log('Conversion result:', data);
        displayConversionResult(data);
    });

    socket.on('substitution_result', (data) => {
        console.log('Substitution result:', data);
        displaySubstitutionResult(data);
    });

    socket.on('youtube_results', (data) => {
        displayYouTubeResults(data.videos);
    });

    socket.on('play_video', (data) => {
        createPlayer(data.video_id, data.title);
    });

    socket.on('recipe_results', (data) => {
        console.log('Recipe results:', data);
        displayRecipeResults(data);
    });
    
    socket.on('final_text', (data) => {
        console.log('Received final_text:', data);
        
        // Clean and format the response text
        const cleanResponse = data.text
            ?.replace(/🎤\s*User.*?:\s*/g, '') // Remove user prefixes from logs
            ?.replace(/🤖\s*AI.*?:\s*/g, '') // Remove AI prefixes from logs
            ?.trim() || '';
        
        if (assistantMessageBubble) {
            console.log('Updating assistant message bubble');
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
            
        } else {
            console.error('assistantMessageBubble is null');
            // Create a new message bubble if it doesn't exist
            addMessageToChat(cleanResponse, 'assistant');
            updateHistory("assistant", cleanResponse);
            
            // Check if the response contains a recipe
            detectAndAddRecipe(cleanResponse);
        }
        
        // Reset backend audio flag and wait longer for backend audio
        backendAudioReceived = false;
        setTimeout(() => {
            if (!backendAudioReceived && cleanResponse) {
                console.log('No backend audio received, using browser TTS');
                speakText(cleanResponse);
            }
        }, 500); // Wait 500ms for backend audio
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
        console.log('Received ai_audio_base64:', data);
        backendAudioReceived = true; // Set flag to prevent browser TTS
        
        // Cancel any ongoing browser TTS
        if (speechSynthesis.speaking) {
            console.log('Canceling browser TTS as backend audio received');
            speechSynthesis.cancel();
        }
        
        try {
            // Check if audio data exists and is valid
            const audioB64 = data.audio_b64 || data.audio;
            if (!audioB64 || typeof audioB64 !== 'string') {
                console.warn('Invalid base64 audio data, falling back to TTS');
                return;
            }
            
            // Validate base64 format
            const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
            if (!base64Pattern.test(audioB64)) {
                console.warn('Invalid base64 format, falling back to TTS');
                return;
            }
            
            // Decode base64 to audio data
            const binaryString = atob(audioB64);
            const audioData = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                audioData[i] = binaryString.charCodeAt(i);
            }
            await playAudio(audioData.buffer);
            assistantMessageBubble = null;
        } catch (error) {
            console.error('Error playing base64 audio:', error);
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
                micStatus.textContent = 'Starting...';
                recognition.start(); 
            } catch(e) { 
                console.error('Error starting recognition:', e);
                micStatus.textContent = 'Error starting microphone';
            }
        }
    }

    async function playAudio(audioData) {
        if (!audioData || isAssistantSpeaking || !audioContext) return;
        isAssistantSpeaking = true;
        statusIndicator.style.backgroundColor = '#007aff';
        try {
            const audioBuffer = await audioContext.decodeAudioData(audioData);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            currentAudioSource = source; // Store for interruption
            return new Promise(resolve => {
                source.onended = () => {
                    console.log('Backend audio ended');
                    isAssistantSpeaking = false;
                    statusIndicator.style.backgroundColor = '#34c759';
                    micStatus.textContent = 'Click to speak';
                    
                    // Auto-start listening after backend audio ends
                    setTimeout(() => {
                        if (!isListening && !isAssistantSpeaking) {
                            console.log('Auto-starting listening after backend audio');
                            startListening();
                        }
                    }, 500);
                    
                    resolve();
                };
            });
        } catch (error) {
            console.error("Audio playback error:", error);
            isAssistantSpeaking = false;
            statusIndicator.style.backgroundColor = '#34c759';
        }
    }
    
    function displayYouTubeResults(videos) {
        // Display results in the dedicated YouTube section, not conversation
        const videoResultsContainer = document.getElementById('video-results');
        if (!videoResultsContainer) {
            console.error('Video results container not found');
            return;
        }

        // Clear existing content
        videoResultsContainer.innerHTML = '';
        
        if (!videos || videos.length === 0) {
            videoResultsContainer.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>No recipe videos found. Try a different search!</p>
                </div>
            `;
            return;
        }

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'video-results-container';
        
        videos.forEach(video => {
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
                // Normal video results with voice control
                card.innerHTML = `
                    <img src="${video.thumbnail}" alt="Video thumbnail" class="video-thumbnail">
                    <div class="video-info">
                        <div class="result-number">Result #${video.result_number}</div>
                        <div class="title">${video.title}</div>
                        <div class="video-actions">
                            ${video.video_id ? `
                                <button onclick="playVideo('${video.video_id}', '${video.title.replace(/'/g, "\\'")}')" class="play-button">
                                    <i class="fas fa-play"></i> Play Video
                                </button>
                                <button onclick="requestVideoPlay(${video.result_number})" class="voice-play-button">
                                    <i class="fas fa-volume-up"></i> Say "Play video ${video.result_number}"
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }
            
            resultsContainer.appendChild(card);
        });
        
        videoResultsContainer.appendChild(resultsContainer);
        
        // Add voice control instructions in conversation area
        addConversationMessage('assistant', 
            `Found ${videos.length} recipe video${videos.length > 1 ? 's' : ''}! Check the Recipe Videos section above. You can say "play video 1" or "play video 2" to watch them.`
        );
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

    // Browser TTS fallback function
    function speakText(text) {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            speechSynthesis.cancel();
            
            // Clean text for better TTS - remove special characters and formatting
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
            
            console.log('Speaking cleaned text:', cleanText);
            
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;
            
            utterance.onstart = () => {
                console.log('TTS started');
                isAssistantSpeaking = true;
                statusIndicator.style.backgroundColor = '#007aff';
                micStatus.textContent = 'Assistant speaking...';
            };
            
            utterance.onend = () => {
                console.log('TTS ended');
                isAssistantSpeaking = false;
                statusIndicator.style.backgroundColor = '#34c759';
                micStatus.textContent = 'Click to speak';
                
                // Auto-start listening after a short delay
                setTimeout(() => {
                    if (!isListening && !isAssistantSpeaking) {
                        console.log('Auto-starting listening after TTS');
                        startListening();
                    }
                }, 1000);
            };
            
            utterance.onerror = (error) => {
                console.error('TTS error:', error);
                isAssistantSpeaking = false;
                statusIndicator.style.backgroundColor = '#34c759';
                micStatus.textContent = 'Click to speak';
                
                // Still auto-start listening even on error
                setTimeout(() => {
                    if (!isListening && !isAssistantSpeaking) {
                        console.log('Auto-starting listening after TTS error');
                        startListening();
                    }
                }, 1000);
            };
            
            speechSynthesis.speak(utterance);
        } else {
            console.log('Text-to-speech not supported in this browser');
            // Auto-start listening if TTS not supported
            setTimeout(() => startListening(), 500);
        }
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
    
    function updateHistory(role, content) { chatHistory.push({ role, content }); if (chatHistory.length > 6) { chatHistory = chatHistory.slice(-6); } }
    function scrollToBottom() { chatContainer.scrollTop = chatContainer.scrollHeight; }
    function createMessageBubble(text, sender) { 
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
        chatContainer.appendChild(messageWrapper); 
        scrollToBottom();
        return messageBubble; 
    }
    function addMessageToChat(text, sender) { createMessageBubble(text, sender); scrollToBottom(); }

    // --- Timer Display Functions ---
    function updateTimerDisplay(timerData) {
        const timersSection = document.querySelector('.timers-container');
        if (!timersSection) return;

        let timerElement = document.getElementById(`timer-${timerData.timer_id}`);
        
        if (!timerElement) {
            timerElement = document.createElement('div');
            timerElement.id = `timer-${timerData.timer_id}`;
            timerElement.className = 'timer-item';
            timersSection.appendChild(timerElement);
        }

        timerElement.innerHTML = `
            <div class="timer-name">${timerData.name}</div>
            <div class="timer-countdown">${timerData.remaining_time}</div>
            <div class="timer-progress">
                ${timerData.remaining_minutes}m ${timerData.remaining_seconds}s remaining
            </div>
        `;
    }

    function handleTimerFinished(timerData) {
        const timerElement = document.getElementById(`timer-${timerData.timer_id}`);
        if (timerElement) {
            timerElement.classList.add('timer-finished');
            timerElement.innerHTML = `
                <div class="timer-name">${timerData.name}</div>
                <div class="timer-countdown">00:00</div>
                <div class="timer-finished-text">✅ FINISHED!</div>
            `;
            
            // Remove after 5 seconds
            setTimeout(() => {
                timerElement.remove();
            }, 5000);
        }

        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Timer Finished!', {
                body: timerData.message,
                icon: '/static/timer-icon.png'
            });
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
    function displayConversionResult(data) {
        const conversionsContainer = document.querySelector('.conversions-container');
        if (!conversionsContainer) return;

        // Clear previous results
        conversionsContainer.innerHTML = '';

        if (data.error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${data.error}`;
            conversionsContainer.appendChild(errorDiv);
        } else if (data.result) {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'conversion-result';
            resultDiv.innerHTML = `
                <div class="conversion-card">
                    <div class="conversion-header">
                        <i class="fas fa-calculator"></i>
                        <h3>Unit Conversion</h3>
                    </div>
                    <div class="conversion-display">
                        <div class="conversion-from">
                            <div class="conversion-label">From</div>
                            <div class="conversion-value">${data.amount || ''} ${data.from_unit || ''}</div>
                        </div>
                        <div class="conversion-arrow">
                            <i class="fas fa-arrow-right"></i>
                        </div>
                        <div class="conversion-to">
                            <div class="conversion-label">To</div>
                            <div class="conversion-value">${data.result}</div>
                        </div>
                    </div>
                    <div class="conversion-footer">
                        <i class="fas fa-info-circle"></i>
                        <span>Conversion completed successfully</span>
                    </div>
                </div>
            `;
            conversionsContainer.appendChild(resultDiv);
        }
    }

    // --- Substitution Display Functions ---
    function displaySubstitutionResult(data) {
        const substitutionsContainer = document.querySelector('.substitutions-container');
        if (!substitutionsContainer) return;

        // Clear previous results
        substitutionsContainer.innerHTML = '';

        if (data.error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${data.error}`;
            substitutionsContainer.appendChild(errorDiv);
        } else if (data.substitutions && data.substitutions.length > 0) {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'substitution-result';
            
            let substitutionHTML = `
                <div class="substitution-card">
                    <div class="substitution-header">
                        <div class="substitution-ingredient">
                            <i class="fas fa-utensils"></i>
                            <div class="ingredient-info">
                                <span class="ingredient-name">${data.ingredient || 'ingredient'}</span>
                                ${data.quantity ? `<span class="ingredient-quantity">${data.quantity}</span>` : ''}
                            </div>
                        </div>
                        <div class="substitution-arrow">
                            <i class="fas fa-arrow-right"></i>
                        </div>
                        <div class="substitution-title">
                            <i class="fas fa-magic"></i>
                            <span>Substitutes</span>
                        </div>
                    </div>
                    <div class="substitution-options">`;
            
            data.substitutions.forEach((sub, index) => {
                substitutionHTML += `
                    <div class="substitution-option">
                        <div class="option-number">${index + 1}</div>
                        <div class="option-content">
                            <i class="fas fa-check-circle"></i>
                            <span>${sub}</span>
                        </div>
                    </div>`;
            });
            
            substitutionHTML += `
                    </div>
                    <div class="substitution-tip">
                        <i class="fas fa-lightbulb"></i>
                        <span>Tip: Always taste as you go when using substitutes!</span>
                    </div>
                </div>`;
            
            resultDiv.innerHTML = substitutionHTML;
            substitutionsContainer.appendChild(resultDiv);
        }
    }

    // --- Recipe Display Functions ---
    function displayRecipeResults(data) {
        const recipesContainer = document.querySelector('.recipes-container');
        if (!recipesContainer) return;

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

    function createRecipeCard(recipe) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'recipe-card';
        cardDiv.onclick = () => showRecipeDetails(recipe.id);

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
            ${recipe.image ? 
                `<img src="${recipe.image}" alt="${recipe.title}" class="recipe-image">` :
                `<div class="recipe-placeholder"><i class="fas fa-utensils"></i></div>`
            }
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
                    <button class="recipe-view-btn" onclick="event.stopPropagation(); showFullRecipe('${recipe.id}')">
                        <i class="fas fa-expand"></i> View Full Recipe
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
            
            console.log('Playing video:', videoId, 'Title:', title);
            createPlayer(videoId, title);
        }
    };

    // Global function for deleting timers
    window.deleteTimer = function(timerId) {
        const command = `delete timer ${timerId}`;
        console.log('Delete timer command:', command);
        processCommand(command);
        
        // Remove from client-side tracking immediately for responsive UX
        delete activeTimersData[timerId];
        const timerElement = document.getElementById(`timer-${timerId}`);
        if (timerElement) {
            timerElement.style.opacity = '0.5';
            timerElement.style.pointerEvents = 'none';
        }
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
    function addConversationMessage(type, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        
        if (type === 'assistant') {
            messageBubble.innerHTML = `<i class="fas fa-chef-hat"></i> ${text}`;
        } else {
            messageBubble.textContent = text;
        }
        
        messageDiv.appendChild(messageBubble);
        chatContainer.appendChild(messageDiv);
        scrollToBottom();
    }

    // === FULLSCREEN VIDEO MODAL ===
    function showVideoFullscreen() {
        if (!player) return;
        
        const videoId = player.getVideoData()?.video_id;
        if (!videoId) return;
        
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
            setTimeout(() => modal.remove(), 300);
        }
        
        // Also stop the original player
        if (player) {
            player.pauseVideo();
        }
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
        
        // Check if it's an AI-generated recipe
        if (recipeId.startsWith('ai_') && window.aiRecipes && window.aiRecipes[recipeId]) {
            console.log('Showing AI-generated recipe');
            const aiRecipe = window.aiRecipes[recipeId];
            displayFullRecipeModal(aiRecipe);
            return;
        }
        
        // Show loading state for TheMealDB recipes
        const loadingModal = document.createElement('div');
        loadingModal.id = 'recipe-loading-modal';
        loadingModal.className = 'fullscreen-modal show';
        loadingModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-body" style="display: flex; align-items: center; justify-content: center; height: 200px;">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin fa-2x"></i>
                        <p style="margin-top: 1rem;">Loading recipe details...</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(loadingModal);
        
        console.log('Emitting get_recipe_details with ID:', recipeId);
        // Fetch full recipe details from backend
        socket.emit('get_recipe_details', { recipe_id: recipeId });
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
            <div class="modal-content">
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

    // Make resizeSection globally accessible
    window.resizeSection = resizeSection;

});
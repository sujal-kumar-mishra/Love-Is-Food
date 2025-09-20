# Kitchen Assistant AI

A comprehensive voice-enabled kitchen assistant that helps with cooking, recipes, timers, conversions, and ingredient substitutions.

## Features

### 🎤 Voice Interaction
- Natural conversation with the AI assistant
- Voice commands for all functions
- Text-to-speech responses

### 🍳 Kitchen Tools
- **Recipe Search**: Search YouTube for cooking videos and recipes
- **Timer Management**: Set, list, and delete cooking timers
- **Unit Conversion**: Convert between cooking measurements (cups, tablespoons, ml, etc.)
- **Ingredient Substitution**: Get alternatives when you're missing ingredients
- **General Assistance**: Time, date, Wikipedia searches

### 🖥️ Organized Interface
- **Conversation Section**: Natural chat with the assistant
- **Recipe Videos**: YouTube recipe search results and player
- **Active Timers**: Visual timer management
- **Conversions & Substitutions**: Dedicated sections for cooking help

## Setup

### 1. Install Dependencies
```bash
cd "d:\Major_project_2\python"
pip install -r requirements.txt
```

### 2. Environment Configuration
Create a `.env` file with your API keys:
```env
GROQ_API_KEY=your_groq_api_key_here
SECRET_KEY=your_secret_key_for_sessions
```

### 3. Run the Application
```bash
python app.py
```

The app will be available at `http://localhost:5000`

## Usage Examples

### Voice Commands
- **Recipe Search**: "Find me a chocolate cake recipe"
- **Timer Management**: 
  - "Set a timer for 10 minutes for the pasta"
  - "Delete the pasta timer"
  - "List my active timers"
- **Unit Conversion**: "Convert 2 cups to milliliters"
- **Ingredient Substitution**: "What can I use instead of butter?"
- **General**: "What time is it?" or "Search Wikipedia for sourdough bread"

### Interface Sections
1. **Conversation**: Main chat interface - only useful responses appear here
2. **Recipe Videos**: YouTube search results with embedded player
3. **Active Timers**: Real-time timer tracking with delete options
4. **Unit Conversions**: Cooking measurement conversions
5. **Recipe Substitutions**: Ingredient alternatives and ratios

## Technical Features

### Backend
- Flask + Socket.IO for real-time communication
- Server-side session management per connection
- Comprehensive tool calling system
- Background timer management with threading
- Enhanced AI prompting for kitchen-specific tasks

### Frontend
- Responsive design with organized sections
- Speech recognition (Web Speech API)
- YouTube player integration
- Real-time updates via WebSocket
- Base64 audio playback for TTS

### AI Integration
- Groq/Gemma2 for fast response generation
- Intelligent tool selection based on user intent
- Context-aware conversation with session memory
- Kitchen-focused prompting and responses

## Architecture

The application uses a hybrid approach:
- **Voice Assistant** (`main.py`): Local voice interface with Piper TTS
- **Web Interface** (`app.py`): Browser-based interface with organized sections
- **Shared Skills** (`skills.py`): Common functionality for both interfaces

## Browser Compatibility

- Chrome/Edge: Full support including speech recognition
- Firefox: Limited speech recognition support
- Safari: Basic functionality (no speech recognition)

## Debug Information

All tool usage and AI decisions are logged to the console for debugging purposes. Users only see the natural conversation responses, while developers can monitor the complete interaction flow.
# Gemini Voice-to-Voice Implementation Plan

## Current Architecture
- STT: Groq Whisper (free tier)
- LLM: Groq Llama-3.3-70b (free tier)
- TTS: macOS 'say' command (local)

## Target Architecture
- Use Google Gemini 2.0 with native voice-to-voice capabilities
- Eliminate separate STT/TTS pipeline
- Lower latency, better natural conversation flow

## Implementation Steps

### 1. Setup Gemini API
- Get Google AI API key from https://aistudio.google.com/app/apikey
- Install Google AI SDK
- Update environment variables

### 2. Replace Pipeline in agent.py
```python
# Old pipeline
stt_instance = OpenAISTT(api_key=groq_key, base_url=GROQ_BASE, model="whisper-large-v3")
llm_instance = OpenAILLM(api_key=groq_key, base_url=GROQ_BASE, model="llama-3.3-70b-versatile")
tts_instance = MacOSSayTTS()

# New pipeline (using Gemini 2.0 multimodal voice)
from google import generativeai as genai

genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
model = genai.GenerativeModel("gemini-2.0-flash-exp")

# Voice-to-voice chat
chat = model.start_chat(history=[])
```

### 3. LiveKit Integration
- Use LiveKit's native voice agent support
- Or implement custom audio streaming with Gemini

### 4. Benefits
- Reduced latency (no STT→LLM→TTS pipeline)
- More natural conversation flow
- Better voice quality
- Single API call instead of 3

### 5. Migration Notes
- Keep Groq as fallback for cost efficiency
- Gemini 2.0 Flash is currently free (experimental)
- May need to handle rate limits

## API Key Setup
Add to `.env`:
```
GOOGLE_API_KEY=your_gemini_api_key_here
```

## Cost Comparison
- Current: Groq (free tier) - $0
- Gemini 2.0 Flash: Currently free (experimental)
- Gemini 1.5 Pro: Paid tier available

## Testing Plan
1. Test voice-to-voice locally
2. Test with LiveKit integration
3. Compare latency with current system
4. Test audio quality

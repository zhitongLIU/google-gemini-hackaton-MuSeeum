# MuSeeum: App Functional Summary

**MuSeeum** is an AI-powered museum companion application designed to enhance museum visits with real-time interactive voice guidance and an automatically generated tour diary. 

Here is a summary of the core functional flows of the application:

## 1. Authentication & Session Management
- **Sign In:** Users securely sign in using Google Auth.
- **Starting a Visit:** From the home screen ("My Visits"), users can start a new visit by entering the name of the museum they are exploring. This creates an active session.
- **Resuming:** Sessions are resumable, meaning users can pick up an active visit later if they pause. 

## 2. Artwork Capture & Identification
- **Image Capture:** While navigating the museum, users can capture images of artworks they find interesting.
- **AI Identification:** The backend relies on Gemini Vision AI to analyze the image and return a likely candidate (Title, Artist, Period).
- **User Confirmation:** The user confirms the AI's candidate or manually types in the artwork's name if the AI couldn't confidently identify it. 

## 3. Real-Time Explanations
- **Detailed Insights:** Once an artwork is confirmed or manually identified, the app generates a short, engaging, and visitor-friendly explanation including its history, art style, and artist background.
- **Audio Playback:** The text explanation is accompanied by streaming audio (Gemini Live) to provide a docent-like experience. Users can interact with the Gemini Live API to ask questions and get more details about the artwork.
- **Adding Photos:** Users can capture additional angles or details of the same artwork to attach them to the entry.

## 4. Live Agent Q&A
- **Voice Interaction:** Users can use a "Talk" button (Push-to-Talk) to ask follow-up questions about the current artwork using voice.
- **Context-Aware Responses:** The backend maintains a websocket connection to the Gemini Live API, streaming the user's audio and injecting the specific artwork's context so the AI can answer intelligently based on what the user is currently looking at. Speech is streamed back to the user in real-time.

## 5. Tour Story and Downloadable Diary
- **Visit Summary:** When the user selects "End Visit", the app aggregates all captured artworks, discussions, and time-stamps. 
- **Generated Narrative:** Gemini processes the session to write a personalized narrative "tour story" with an introduction, artwork sections, and a conclusion.
- **Exporting:** Users can download the complete diary as HTML or PDF. The diary includes the generated narrative along with the captured artwork images and text descriptions, serving as a lasting memory of their trip.

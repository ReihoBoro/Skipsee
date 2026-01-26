"use client";
import React, { useState, useRef } from 'react';
import LandingPage from '@/components/LandingPage';
import VideoChat from '@/components/VideoChat';
import { useSkipsee } from '@/hooks/useSkipsee';

// Metadata needs to be exported from a Server Component or layout, but this is a Client Component (use client).
// Next.js App Router limitation: "use client" pages can't export metadata.
// Solution: Make page.tsx a Server Component that imports a Client Component.
// So I will rename this logic to `src/components/SeoClientPage.tsx` or similar?
// NO, I will make `src/app/omegle-alternative/page.tsx` a Server Component that renders a Client Component.
// And that Client Component will contain the `Home` logic.

// Step 1: Create `src/components/MainApp.tsx` (Logic from Home) that accepts props.
// Step 2: Update `src/app/page.tsx` to use it? NO, leave page.tsx alone.
// Step 3: Create `src/components/SeoAppWrapper.tsx` which is a COPY of `Home` logic but accepts SEO props.

export default function SeoAppWrapper({
    heroText,
    subheadline
}: {
    heroText?: { line1: string, line2: string, line3: string },
    subheadline?: string
}) {
    const {
        stream, remoteStream, partner, isSearching,
        startSearch, handleSkip, stopChat, startCamera,
        sendMessage, messages, toggleMic, toggleCam, micEnabled, camEnabled
    } = useSkipsee();

    const [uiState, setUiState] = useState<'landing' | 'lobby' | 'chat'>('landing');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isVip, setIsVip] = useState(false);
    const settingsRef = useRef<{ gender: string, identity: string, country: string, interests: string[] } | null>(null);

    const onStart = async (settings: { gender: string, identity: string, interests: string[], country: string, user: any, isVip: boolean }) => {
        settingsRef.current = settings; // Store for re-queueing
        setCurrentUser(settings.user);
        setIsVip(settings.isVip);

        await startCamera();
        setUiState('chat'); // Go to chat view
        startSearch(settings);
    };

    const onSkip = () => {
        handleSkip();
        // Re-queue with same settings
        if (settingsRef.current) {
            startSearch(settingsRef.current);
        }
    };

    const onStop = () => {
        stopChat();
        setUiState('landing');
    };

    return (
        <main className="min-h-screen w-full">
            {uiState === 'landing' && (
                <LandingPage
                    onStart={onStart}
                    heroText={heroText}
                    subheadline={subheadline}
                />
            )}

            {uiState === 'chat' && (
                <VideoChat
                    stream={stream}
                    remoteStream={remoteStream}
                    partner={partner}
                    isSearching={isSearching}
                    onSkip={onSkip}
                    onStop={onStop}
                    onToggleMic={toggleMic}
                    onToggleCam={toggleCam}
                    onSendMessage={sendMessage}
                    messages={messages}
                    micEnabled={micEnabled}
                    camEnabled={camEnabled}
                    user={currentUser}
                    isVip={isVip}
                    onLogout={() => {
                        stopChat();
                        setCurrentUser(null);
                        setIsVip(false);
                        setUiState('landing');
                    }}
                />
            )}
        </main>
    );
}

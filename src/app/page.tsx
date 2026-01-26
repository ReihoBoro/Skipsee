"use client";
import React, { useState, useRef } from 'react';
import LandingPage from '@/components/LandingPage';
import VideoChat from '@/components/VideoChat';
import { useSkipsee } from '@/hooks/useSkipsee';

export default function Home() {
  const {
    stream, remoteStream, partner, isSearching,
    startSearch, handleSkip, stopChat, startCamera,
    sendMessage, messages, toggleMic, toggleCam, micEnabled, camEnabled
  } = useSkipsee();

  const [uiState, setUiState] = useState<'landing' | 'lobby' | 'chat'>('landing');
  const settingsRef = useRef<{ gender: string, identity: string, country: string, interests: string[] } | null>(null);

  const onStart = async (settings: { gender: string, identity: string, interests: string[], country: string }) => {
    settingsRef.current = settings; // Store for re-queueing
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
        <LandingPage onStart={onStart} />
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
        />
      )}
    </main>
  );
}

"use client";
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // TODO: Add TURN server here for production (e.g. OpenRelay or Twilio)
        // { urls: 'turn:global.turn.twilio.com:3478?transport=udp', username: 'User', credential: 'Pass' }
    ]
};

// Helper: Prefer VP8/H264 to avoid mobile black screens (VP9 issues)
function sdpPreferCodec(sdp: string, codec: string) {
    const sdpLines = sdp.split('\r\n');
    const mLineIndex = sdpLines.findIndex(l => l.startsWith('m=video'));
    if (mLineIndex === -1) return sdp;

    // Parse payload types
    const mLine = sdpLines[mLineIndex];
    const elements = mLine.split(' ');
    const ptList = elements.slice(3); // Payload types after port, proto

    // Find codec payload type
    let codecPt = -1;
    for (const line of sdpLines) {
        if (line.startsWith('a=rtpmap:') && line.includes(codec)) {
            const parts = line.split(' ');
            const pt = parts[0].substring(9); // remove a=rtpmap:
            codecPt = parseInt(pt, 10);
            break;
        }
    }

    if (codecPt === -1) return sdp;

    // Move preferred PT to front
    const newPtList = ptList.filter(pt => parseInt(pt) !== codecPt);
    newPtList.unshift(codecPt.toString());

    // Reconstruct m-line
    elements.splice(3, elements.length - 3, ...newPtList);
    sdpLines[mLineIndex] = elements.join(' ');

    return sdpLines.join('\r\n');
}

export function useSkipsee() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [partner, setPartner] = useState<{ id: string, country: string } | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [messages, setMessages] = useState<{ text: string, isMine: boolean }[]>([]);

    const [micEnabled, setMicEnabled] = useState(true);
    const [camEnabled, setCamEnabled] = useState(true);

    const peerRef = useRef<RTCPeerConnection | null>(null);

    // Store last settings for re-queuing
    const lastSettingsRef = useRef<{ gender: string, identity: string, interests: string[], country: string } | null>(null);

    // ICE Candidate Queue to prevent black screens (race condition fix)
    const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);
    const isRemoteDescSet = useRef(false);

    // Initialize Socket & Events
    useEffect(() => {
        const s = io({ path: '/socket.io' });
        setSocket(s);

        const handleMatchFound = async (data: any) => {
            console.log('>>> MATCH FOUND:', data);
            setIsSearching(false);
            setPartner({ id: data.partnerId, country: data.country });
            partnerIdRef.current = data.partnerId; // IMMEDIATE UPDATE to fix race condition
            setMessages([]);

            // Reset WebRTC state for new connection
            isRemoteDescSet.current = false;
            iceCandidatesQueue.current = [];

            createPeerConnection(data.partnerId, s);

            if (data.initiator) {
                console.log('>>> I AM INITIATOR, creating offer...');
                try {
                    const offer = await peerRef.current!.createOffer();
                    // Force VP8/H264 for mobile compatibility
                    const sdp = sdpPreferCodec(offer.sdp!, 'VP8');
                    const offerWithCodec = { type: offer.type, sdp };

                    await peerRef.current!.setLocalDescription(offerWithCodec);
                    console.log('>>> Sending OFFER to:', data.partnerId);
                    s.emit('offer', { target: data.partnerId, sdp: offerWithCodec });
                } catch (e) {
                    console.error(">>> Offer Error", e);
                }
            }
        };

        const handleOffer = async (data: any) => {
            console.log('>>> RECEIVED OFFER');
            if (!peerRef.current) {
                console.error('>>> PEER IS NULL when Offer Received');
                // Should have been created by match-found, but recover if needed (rare race)
                // Note: We don't have partner ID easily here if match-found didn't run.
                // Assuming standard flow.
                return;
            }
            try {
                console.log('>>> Setting output Description...');
                await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
                isRemoteDescSet.current = true;

                console.log('>>> Remote Desc SET. Processing Queue...');
                processIceQueue();

                const answer = await peerRef.current.createAnswer();
                // Force VP8/H264
                const sdp = sdpPreferCodec(answer.sdp!, 'VP8');
                const answerWithCodec = { type: answer.type, sdp };

                await peerRef.current.setLocalDescription(answerWithCodec);
                console.log('>>> Sending ANSWER to:', partnerIdRef.current);

                // We need to send answer to the SENDER.
                // data.target is ME. We need the other person's ID.
                // Since 'offer' implies we have a partner, we use the stored REF (from match-found updates)
                if (partnerIdRef.current) {
                    s.emit('answer', { target: partnerIdRef.current, sdp: answerWithCodec });
                }
            } catch (e) { console.error(e); }
        };

        const handleAnswer = async (data: any) => {
            console.log('>>> RECEIVED ANSWER');
            if (peerRef.current) {
                try {
                    await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    isRemoteDescSet.current = true;
                    console.log('>>> Answer Processed. Processing Queue...');
                    processIceQueue();
                } catch (e) { console.error(">>> Handle Answer Error", e); }
            }
        };

        const handleIceCandidate = async (data: any) => {
            const candidate = new RTCIceCandidate(data.candidate);
            if (peerRef.current && isRemoteDescSet.current) {
                try {
                    await peerRef.current.addIceCandidate(candidate);
                } catch (e) { console.error("ICE Add Error", e); }
            } else {
                iceCandidatesQueue.current.push(candidate);
            }
        };

        const processIceQueue = async () => {
            if (!peerRef.current) return;
            for (const candidate of iceCandidatesQueue.current) {
                try {
                    await peerRef.current.addIceCandidate(candidate);
                } catch (e) { console.error("Queued ICE Add Error", e); }
            }
            iceCandidatesQueue.current = [];
        };

        const handleMessage = (data: any) => {
            setMessages(prev => [...prev, { text: data.message, isMine: false }]);
        };

        const handlePartnerDisconnected = () => {
            // Logic to auto-skip when partner leaves
            handleSkip(true); // Helper to avoid infinite loops if we want auto-requeue
        };

        s.on('match-found', handleMatchFound);
        s.on('offer', handleOffer);
        s.on('answer', handleAnswer);
        s.on('ice-candidate', handleIceCandidate);
        s.on('message', handleMessage);
        s.on('partner-disconnected', handlePartnerDisconnected);

        return () => {
            s.disconnect();
            s.off('match-found', handleMatchFound);
            s.off('offer', handleOffer);
            s.off('answer', handleAnswer);
            s.off('ice-candidate', handleIceCandidate);
            s.off('message', handleMessage);
            s.off('partner-disconnected', handlePartnerDisconnected);
        };
    }, []);

    // Ref for callback access
    const partnerIdRef = useRef<string | null>(null);
    useEffect(() => {
        partnerIdRef.current = partner ? partner.id : null;
    }, [partner]);

    // ... (createPeerConnection remains same)

    // Ref for stream access in callbacks (Fixes stale closure)
    const streamRef = useRef<MediaStream | null>(null);
    useEffect(() => {
        streamRef.current = stream;
    }, [stream]);

    // ... (createPeerConnection remains same)

    const createPeerConnection = (partnerId: string, sock: Socket) => {
        if (peerRef.current) peerRef.current.close();
        const pc = new RTCPeerConnection(RTC_CONFIG);

        // Add Tracks from Ref (Current Stream)
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current!));
        } else {
            console.warn("No local stream found when creating peer connection!");
        }

        pc.ontrack = (event) => {
            console.log(">>> RECEIVED REMOTE TRACK");
            setRemoteStream(event.streams[0]);
        };

        pc.onconnectionstatechange = () => { console.log(">>> PC State:", pc.connectionState); };

        pc.onicecandidate = (event) => {
            if (event.candidate && partnerId) {
                sock.emit('ice-candidate', { target: partnerId, candidate: event.candidate });
            }
        };

        peerRef.current = pc;
    };


    // Actions
    const startCamera = async () => {
        try {
            console.log(">>> Requesting Camera Access...");
            // Mobile Optimization: Lower res + specific mode to prevent black screen
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user"
                },
                audio: true
            };
            const s = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(s);
            streamRef.current = s; // TIMING FIX: Update Ref immediately!
            console.log(">>> Camera Started:", s.id);
            return s;
        } catch (e) {
            console.error(e);
            alert("Camera access denied");
            return null;
        }
    };

    const startSearch = async (settings: { gender: string, identity: string, interests: string[], country: string }) => {
        // Store settings (including identity now)
        // @ts-ignore
        lastSettingsRef.current = settings;

        let currentStream = streamRef.current; // Use Ref first

        if (!currentStream) {
            console.log(">>> Stream not ready, starting camera...");
            currentStream = await startCamera();
            if (!currentStream) {
                console.error(">>> Camera failed. Aborting search.");
                return;
            }
        }

        console.log(">>> Stream ready. Starting Search...");
        setIsSearching(true);
        setPartner(null);
        setRemoteStream(null);
        setMessages([]);

        socket?.emit('start-search', settings);
    };

    // Modified handleSkip to accept an 'auto' flag (optional) but primarily to RE-QUEUE
    const handleSkip = (isAuto = false) => {
        // 1. Notify server we are skipping (if we initiated it)
        // If partner disconnected, server already knows, but 'skip' event is safe.
        // However, if we are responding to 'partner-disconnected', we shouldn't emit 'skip' 
        // back or we might create a loop or error. 
        // PROPER LOGIC: If I click SKIP, I emit 'skip'. Server notifies partner.
        // Partner receives 'partner-disconnected'. Partner runs handleSkip().
        // If partner runs handleSkip(), they should NOT emit 'skip' again?
        // Actually server handles it fine (checks if user has partner).

        socket?.emit('skip');

        // 2. Cleanup
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
        setRemoteStream(null);
        setPartner(null);
        setMessages([]);
        setIsSearching(true);

        // 3. RE-QUEUE with last settings
        if (lastSettingsRef.current) {
            socket?.emit('start-search', lastSettingsRef.current);
        }
    };

    const stopChat = () => {
        socket?.emit('stop-search');
        socket?.emit('skip');
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
        setIsSearching(false);
        setPartner(null);
        setRemoteStream(null);
        // Can optionally stop camera or keep it warm
    };

    const sendMessage = (text: string) => {
        if (partnerIdRef.current) {
            socket?.emit('message', { message: text });
            setMessages(prev => [...prev, { text, isMine: true }]);
        }
    };

    const toggleMic = () => {
        if (stream) {
            stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
            setMicEnabled(!micEnabled);
        }
    };

    const toggleCam = () => {
        if (stream) {
            stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
            setCamEnabled(!camEnabled);
        }
    };

    return {
        socket,
        stream,
        remoteStream,
        partner,
        isSearching,
        messages,
        startCamera,
        startSearch,
        handleSkip,
        stopChat,
        sendMessage,
        toggleMic,
        toggleCam,
        micEnabled,
        camEnabled
    };
}

"use client";
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export default function CapacitorInit() {
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            document.body.classList.add('native-app');
        }
    }, []);

    return null; // Logic only
}

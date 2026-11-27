import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { debugLog } from '../hooks/tableDebug.ts'

// ?perf only: notes slow frames, and every time the graphics card has to build new shaders (the little programs that
// draw each material). Building shaders stalls a frame, and is the usual cause of a sudden flash in a 3D page.
export function FrameWatch() {
    const programs = useRef(-1);
    useFrame(({ gl }, delta) => {
        const count = gl.info.programs?.length ?? 0;
        if (programs.current >= 0 && count !== programs.current) debugLog(`shaders: ${programs.current} → ${count}`);
        programs.current = count;
        if (delta > 0.1) debugLog(`slow frame: ${Math.round(delta * 1000)} ms`);
    });
    useEffect(() => {
        const lost = () => debugLog('graphics: DRAWING SURFACE LOST');
        const back = () => debugLog('graphics: drawing surface restored');
        const canvas = document.querySelector('canvas');
        canvas?.addEventListener('webglcontextlost', lost);
        canvas?.addEventListener('webglcontextrestored', back);
        const hidden = () => debugLog('page', document.visibilityState);
        document.addEventListener('visibilitychange', hidden);
        return () => {
            canvas?.removeEventListener('webglcontextlost', lost);
            canvas?.removeEventListener('webglcontextrestored', back);
            document.removeEventListener('visibilitychange', hidden);
        };
    }, []);
    return null;
}

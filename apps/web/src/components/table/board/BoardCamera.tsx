// The table's camera (Stage 2 polish, piece 8). Made for a TV: the board frames itself to fill the screen,
// every change of view glides instead of jumping, and the DM can still pan, turn and zoom by hand.
//   Tilted view  : the default, a slight angle like looking across a real table. Drag turns, right-drag pans.
//   Top-down view: straight down, like a map. Drag pans (no turning).
//   Fit          : glide back to the whole board.
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import CameraControlsImpl from 'camera-controls'
import { Box3, Vector3 } from 'three'
import { rimOuter } from './ground/TableScenery.tsx'

export type BoardView = 'tilt' | 'top';

const TILT = 0.75;                  // how far the tilted view leans from straight down (radians, about 43°)
const MAX_LEAN = Math.PI / 2.3;     // never let the camera drop below the table edge
// The whole board, rim included: what "fit" frames. Built for this board's radius so a small board fills the screen.
function boardBox(radius: number, view: BoardView) {
    const outer = rimOuter(radius);
    const depth = view === 'top' ? outer : outer * Math.cos(TILT) + 1;   // leaning, the board looks shorter top-to-bottom
    return new Box3(new Vector3(-outer, -0.2, -depth), new Vector3(outer, 1, depth));
}
const { ACTION } = CameraControlsImpl;

const PADDING = { paddingTop: 1, paddingBottom: 0.5, paddingLeft: 0.5, paddingRight: 0.5 };

// Frame the whole board, then lean to the view's angle. The order matters: fitToBox also snaps the camera to the
// nearest straight-on angle, so the lean has to come after it.
function frame(c: CameraControlsImpl, view: BoardView, glide: boolean, radius: number) {
    c.fitToBox(boardBox(radius, view), glide, PADDING);
    c.rotateTo(0, view === 'top' ? 0 : TILT, glide);
}

// fitKey: change it (e.g. count up) to glide back to the whole board
// focus: a spot to glide to (whose turn it is); changes to it slide the camera over without changing the zoom
// painting: a paint tool is on, so a left-drag paints; the camera moves with the right button instead
export function BoardCamera({ view, fitKey, focus, painting = false, radius }: { view: BoardView; fitKey: number; focus?: [number, number, number] | null; painting?: boolean; radius: number }) {
    const controls = useRef<CameraControlsImpl>(null);
    const size = useThree((s) => s.size);
    const first = useRef(true);

    // the view changed (or it's the first draw): set up how the mouse works, lean the camera, frame the board
    useEffect(() => {
        const c = controls.current;
        if (!c) return;
        const glide = !first.current;          // the very first framing happens at once, after that everything glides
        first.current = false;
        if (view === 'top') {
            c.minPolarAngle = 0;
            c.maxPolarAngle = 0;                               // straight down only
            c.mouseButtons.left = painting ? ACTION.NONE : ACTION.TRUCK;     // drag = pan, like a map
            c.mouseButtons.right = ACTION.TRUCK;
            c.touches.one = ACTION.TOUCH_TRUCK;
        } else {
            c.minPolarAngle = 0;
            c.maxPolarAngle = MAX_LEAN;
            c.mouseButtons.left = painting ? ACTION.NONE : ACTION.ROTATE;    // drag = turn around the table
            c.mouseButtons.right = painting ? ACTION.ROTATE : ACTION.TRUCK;
            c.touches.one = ACTION.TOUCH_ROTATE;
        }
        if (!glide) {
            // the very first time: start high, turned and far out, then sweep down onto the table
            c.rotateTo(-Math.PI * 0.6, 0.15, false);
            c.zoomTo(c.camera.zoom * 0.35, false);
            frame(c, view, true, radius);
        } else frame(c, view, glide, radius);
    }, [view, fitKey, radius]);

    // a paint tool turned on or off: only the mouse buttons change
    useEffect(() => {
        const c = controls.current;
        if (!c) return;
        c.mouseButtons.left = painting ? ACTION.NONE : view === 'top' ? ACTION.TRUCK : ACTION.ROTATE;
        c.mouseButtons.right = painting && view !== 'top' ? ACTION.ROTATE : ACTION.TRUCK;
    }, [painting, view]);

    // whose turn it is changed: slide over to them (the DM can still move the camera any time)
    const focusKey = focus ? `${focus[0].toFixed(2)},${focus[2].toFixed(2)}` : '';
    useEffect(() => {
        if (focus && controls.current) controls.current.moveTo(focus[0], focus[1], focus[2], true);
    }, [focusKey]);

    // the window (or TV) changed size: frame the board again
    const sized = useRef(false);
    useEffect(() => {
        if (!sized.current) { sized.current = true; return; }      // the first size is the fly-in's job
        if (controls.current) frame(controls.current, view, false, radius);
    }, [size.width, size.height, view, radius]);

    return (
        <CameraControls ref={controls} makeDefault
            smoothTime={0.35}             // how long a glide takes to settle (seconds, roughly)
            draggingSmoothTime={0.08}     // dragging follows the hand closely, with just a touch of smoothing
            dollyToCursor                 // zoom towards the mouse, not the middle of the screen
            minZoom={10} maxZoom={250} />
    );
}

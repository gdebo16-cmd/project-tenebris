// A campfire: a flame sitting on two crossed logs. Drawn in the text color (currentColor),
// so it follows the theme. Decorative: the button around it carries the name for screen readers.
export default function CampfireIcon({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M12 2.5C13 5.5 17 7.6 17 12.3a5 5 0 0 1-10 0c0-2.4 1.3-4 2.5-5 .2 1.6.9 2.6 1.8 3C10.9 7.9 11 5 12 2.5Z"
                fill="currentColor" fillOpacity={0.3} />
            <path d="M12 17.3a2.3 2.3 0 0 1-2.3-2.3c0-1.4 1-2.3 1.8-3 .1.8.5 1.3 1 1.5.2-.7.5-1.3 1-1.9.9.9 1.8 2 1.8 3.4a2.3 2.3 0 0 1-2.3 2.3Z"
                fill="currentColor" />
            <path d="M3.5 21.5 20.5 17M3.5 17l17 4.5" />
        </svg>
    );
}
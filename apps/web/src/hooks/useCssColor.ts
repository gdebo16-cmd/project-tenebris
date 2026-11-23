export function useCssColor(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}
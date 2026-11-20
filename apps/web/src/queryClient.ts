import { QueryClient } from '@tanstack/react-query';

// One shared cache for everything loaded from the server.
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,            // data counts as fresh for 30 s: no re-fetch when you revisit a page quickly
            retry: 1,                     // one retry on a failed load
            refetchOnWindowFocus: false,  // don't reload just because you switched tabs
        },
    },
});

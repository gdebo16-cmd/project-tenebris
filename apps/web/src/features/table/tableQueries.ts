
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.ts';

type Scene = {
    id: number;
    name: string;
    terrain: Record<string, string>;
}

type SceneData = {
    scene: Scene | null;
    isDm: boolean;
}



export const sceneKey = (campId: string) => ['campaign', campId, 'scene'];

export function useScene(campId: string) {
    return useQuery({
        queryKey: sceneKey(campId),
        queryFn: () => api<SceneData>(`/api/campaigns/${campId}/scene`),  
    });
}

export function usePaint(campId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sceneId, q, r, terrain }: { sceneId: number; q: number; r: number; terrain: string | null }) =>
            api(`/api/scenes/${sceneId}/paint`, { method: 'POST', body: { q, r, terrain } }), 
        onSuccess: (newTerrain) => {
            queryClient.setQueryData<SceneData>(sceneKey(campId), (old) =>
                old?.scene ? { ...old, scene: { ...old.scene, terrain: newTerrain as Record<string, string> } } : old,
            );
        },
    });
}

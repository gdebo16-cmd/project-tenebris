import { Vector3 } from 'three'
import { type Token } from '../../../features/table/hooks/tableQueries.ts'

// Where the walking token is. The walking token writes it every frame, the camera reads it every frame.
export const follow = { at: new Vector3(), walking: false, id: null as Token['id'] | null }

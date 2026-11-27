import { ApiError } from '../../api.ts';

export function messageOf(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong';
}

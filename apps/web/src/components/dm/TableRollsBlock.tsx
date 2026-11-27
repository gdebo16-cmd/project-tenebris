import RollFeed from '../sheets/blocks/RollFeed.tsx';
import { useDmTools } from './DmContext.tsx';

export function TableRollsBlock() {
    return <RollFeed entries={useDmTools().feed} />;
}

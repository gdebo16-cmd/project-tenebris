// What every block gets from the page.
import type { Creature } from '@tenebris/rules/creature';
import type { ActRequest } from '@tenebris/rules/actions';

export type BlockProps = {
    creature: Creature;
    canEdit: boolean;
    // Ask the server to roll an action; the text (with the optional prefix) goes to the roll feed
    onAct: (request: ActRequest, prefix?: string) => void;
    // Show a message in the roll feed without rolling
    onNote: (text: string) => void;
};

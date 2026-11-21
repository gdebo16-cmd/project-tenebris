// Until the new sheet matches the old one, it lives behind ?new=1 on the same address (R5.5).
import { useSearchParams } from 'react-router';
import CharacterSheet from '../../sheet/CharacterSheet.jsx';
import CharacterSheetPage from './CharacterSheetPage.tsx';

export default function SheetSwitch() {
    const [params] = useSearchParams();
    return params.get('new') === '1' ? <CharacterSheetPage /> : <CharacterSheet />;
}

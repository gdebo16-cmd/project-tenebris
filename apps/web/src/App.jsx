import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import RequireLogin from './components/RequireLogin';
import CharacterSheetPage from './features/sheet/CharacterSheetPage.tsx';
import MonsterSheetPage from './features/sheet/MonsterSheetPage.tsx';
import DmPage from './features/dm/DmPage.tsx';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import InventoryPage from './pages/InventoryPage';
import CharacterForm from './features/character-form/CharacterForm.tsx';
import usePageTheme from './hooks/usePageTheme';
import CampaignPage from './pages/CampaignPage';
import CreateCampaign from './pages/CreateCampaign';
import CampaignList from './pages/CampaignList';
import JoinCampaign from './pages/JoinCampaign';
import { ContentProvider } from './hooks/ContentContext';
import AppLayout from './components/AppLayout';
import Loader from './components/Loader.jsx';


// The table brings in three.js (big), so it's only downloaded when someone opens the table
const TablePage = lazy(() => import('./features/table/TablePage.tsx'));
const DiceLab = lazy(() => import('./features/dice/DiceLab.tsx'));

function ThemeWatcher() {
    usePageTheme();
    return null;
}

function App() {
    return (
        <BrowserRouter>
            <ContentProvider>
            <ThemeWatcher />
            <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route element={<RequireLogin />}>
                    <Route element={<AppLayout />}>
                        <Route path="/home" element={<HomePage />} />
                        <Route path="/campaign/:campId" element={<CampaignPage />} />
                        <Route path="/campaign/:campId/dm" element={<DmPage />} />
                        <Route path="/campaign/:campId/table" element={<Suspense fallback={<Loader />}><TablePage /></Suspense>} />
                        <Route path="/campaign/:campId/dice" element={<Suspense fallback={<Loader />}><DiceLab /></Suspense>} />
                        <Route path="/monsters/:id" element={<MonsterSheetPage />} />
                        <Route path="/campaign_list" element={<CampaignList />} />
                        <Route path="/join/:code" element={<JoinCampaign />} />
                        <Route path="/create_campaign" element={<CreateCampaign />} />
                        <Route path="/characters/new" element={<CharacterForm />} />
                        <Route path="/characters/:id" element={<CharacterSheetPage />} />
                        <Route path="/characters/:id/inventory" element={<InventoryPage />} />
                        <Route path="/characters/:id/edit" element={<CharacterForm />} />
                    </Route>
                </Route>
                <Route path="*" element={<p>Page not found. <a href="/home">Go home</a></p>} />
            </Routes>
            </ContentProvider>
        </BrowserRouter>
    );
}

export default App;

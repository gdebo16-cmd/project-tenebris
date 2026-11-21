import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import RequireLogin from './components/RequireLogin';
import SheetSwitch from './features/sheet/SheetSwitch.tsx';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import InventoryPage from './pages/InventoryPage';
import CharacterForm from './features/character-form/CharacterForm.tsx';
import usePageTheme from './hooks/usePageTheme';
import CampaignPage from './pages/CampaignPage';
import CreateCampaign from './pages/CreateCampaign';
import CampaignList from './pages/CampaignList';
import JoinCampaign from './pages/JoinCampaign';
import { ContentProvider } from './hooks/ContentContext';

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
                    <Route path="/home" element={<HomePage />} />
                    <Route path='/profile' element={<ProfilePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/campaign/:campId" element={<CampaignPage />} />
                    <Route path="/campaign_list" element={<CampaignList />} />
                    <Route path="/join/:code" element={<JoinCampaign />} />
                    <Route path="/create_campaign" element={<CreateCampaign />} />
                    <Route path="/characters/new" element={<CharacterForm />} />
                    <Route path="/characters/:id" element={<SheetSwitch />} />
                    <Route path="/characters/:id/inventory" element={<InventoryPage />} />
                    <Route path="/characters/:id/edit" element={<CharacterForm />} />
                </Route>
                <Route path="*" element={<p>Page not found. <a href="/home">Go home</a></p>} />
            </Routes>
            </ContentProvider>
        </BrowserRouter>
    );
}

export default App;

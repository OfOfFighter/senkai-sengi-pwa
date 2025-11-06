import React, { useState, useCallback, createContext, useContext } from 'react';
import { MainMenu } from './components/MainMenu';
import { DeckBuilder } from './components/DeckBuilder';
import { GameBoard } from './components/GameBoard';
import { LocalizationProvider, useLocalization } from './contexts/LocalizationContext';
import type { Deck, GameMode } from './types';

type View = 'menu' | 'deckbuilder' | 'game';
type LayoutMode = 'sp' | 'pc';

interface LayoutContextType {
    layoutMode: LayoutMode;
    setLayoutMode: (mode: LayoutMode) => void;
}

export const LayoutContext = createContext<LayoutContextType | undefined>(undefined);
export const useLayout = (): LayoutContextType => {
    const context = useContext(LayoutContext);
    if (!context) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
};


const AppContent: React.FC = () => {
    const [view, setView] = useState<View>('menu');
    const [playerDecks, setPlayerDecks] = useState<[Deck, Deck] | null>(null);
    const [gameMode, setGameMode] = useState<GameMode>('PvCPU');
    const [startingPlayerId, setStartingPlayerId] = useState<number | undefined>(undefined);
    const { language, setLanguage, t } = useLocalization();
    const { layoutMode, setLayoutMode } = useLayout();

    const toggleLanguage = () => setLanguage(language === 'ja' ? 'en' : 'ja');
    const toggleLayout = () => setLayoutMode(layoutMode === 'sp' ? 'pc' : 'sp');

    const handleStartGame = useCallback((deck1: Deck, deck2: Deck, mode: GameMode, startId?: number) => {
        setPlayerDecks([deck1, deck2]);
        setGameMode(mode);
        setStartingPlayerId(startId);
        setView('game');
    }, []);

    const handleGoToDeckBuilder = useCallback(() => {
        setView('deckbuilder');
    }, []);

    const handleExitGame = useCallback(() => {
        setView('menu');
        setPlayerDecks(null);
    }, []);

    const renderView = () => {
        switch (view) {
            case 'game':
                if (playerDecks) {
                    return <GameBoard playerDecks={playerDecks} gameMode={gameMode} onExit={handleExitGame} startingPlayerId={startingPlayerId} />;
                }
                setView('menu');
                return <MainMenu onStartGame={handleStartGame} onGoToDeckBuilder={handleGoToDeckBuilder} />;
            case 'deckbuilder':
                return <DeckBuilder onExit={handleExitGame} />;
            case 'menu':
            default:
                return <MainMenu onStartGame={handleStartGame} onGoToDeckBuilder={handleGoToDeckBuilder} />;
        }
    };

    const isGameView = view === 'game';

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans">
            {!isGameView && (
                 <header className="bg-slate-800 p-4 shadow-lg flex justify-between items-center fixed top-0 left-0 right-0 z-50 transition-transform duration-300">
                    <h1 className="text-xl sm:text-2xl font-bold text-yellow-300 tracking-wider">{t('header_title')}</h1>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <button onClick={toggleLayout} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 sm:px-4 rounded transition-colors text-sm sm:text-base">
                            {layoutMode.toUpperCase()}
                        </button>
                        <button onClick={toggleLanguage} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 sm:px-4 rounded transition-colors text-sm sm:text-base">
                            {t('language_toggle')}
                        </button>
                        {view !== 'menu' && (
                            <button
                                onClick={handleExitGame}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 sm:px-4 rounded transition-colors text-sm sm:text-base"
                            >
                                {t('back_to_menu')}
                            </button>
                        )}
                    </div>
                </header>
            )}
            <main className={!isGameView ? 'pt-20' : ''}>
                {renderView()}
            </main>
        </div>
    );
};


const App: React.FC = () => {
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('sp');
    return (
        <LocalizationProvider>
            <LayoutContext.Provider value={{ layoutMode, setLayoutMode }}>
                <AppContent />
            </LayoutContext.Provider>
        </LocalizationProvider>
    );
};

export default App;
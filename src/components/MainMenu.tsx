import React, { useState, useCallback, useEffect, useRef } from 'react';
import { STARTER_DECKS, loadCustomDecks, saveCustomDecks } from '../services/gameService';
import { useLocalization } from '../contexts/LocalizationContext';
import type { Deck, GameMode } from '../types';

interface MainMenuProps {
    onStartGame: (deck1: Deck, deck2: Deck, gameMode: GameMode, startingPlayerId?: number) => void;
    onGoToDeckBuilder: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, onGoToDeckBuilder }) => {
    const [allDecks, setAllDecks] = useState<Deck[]>([]);
    const [p1DeckName, setP1DeckName] = useState(STARTER_DECKS[0]?.name || '');
    const [p2DeckName, setP2DeckName] = useState(STARTER_DECKS[1]?.name || '');
    const [startingPlayer, setStartingPlayer] = useState<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const { t } = useLocalization();

    useEffect(() => {
        const customDecks = loadCustomDecks();
        setAllDecks([...STARTER_DECKS, ...customDecks]);
    }, []);

    const handleStart = useCallback((gameMode: GameMode) => {
        const deck1 = allDecks.find(d => d.name === p1DeckName);
        const deck2 = allDecks.find(d => d.name === p2DeckName);

        if (deck1 && deck2) {
            const startId = gameMode === 'PvP' ? startingPlayer : undefined;
            onStartGame(deck1, deck2, gameMode, startId);
        }
    }, [p1DeckName, p2DeckName, onStartGame, allDecks, startingPlayer]);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error('Invalid file content');
                const importedDeck: Deck = JSON.parse(text);
                
                // Validate deck structure
                if (importedDeck.name && Array.isArray(importedDeck.mainDeck) && Array.isArray(importedDeck.magicDeck)) {
                    const currentDecks = loadCustomDecks();
                    // Overwrite if name exists, otherwise add new
                    const otherDecks = currentDecks.filter(d => d.name !== importedDeck.name);
                    const newDecks = [...otherDecks, importedDeck];
                    saveCustomDecks(newDecks);
                    
                    // Update state to reflect the change immediately
                    setAllDecks([...STARTER_DECKS, ...newDecks]);

                    alert(t('deck_imported_successfully', { deckName: importedDeck.name }));
                } else {
                    throw new Error('Invalid deck format');
                }
            } catch (error) {
                console.error('Failed to import deck:', error);
                alert(t('deck_import_failed'));
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    };


    const DeckSelector: React.FC<{
        label: string;
        selectedDeckName: string;
        onSelect: (name: string) => void;
    }> = ({ label, selectedDeckName, onSelect }) => (
        <div className="flex flex-col space-y-2">
            <label className="text-lg font-semibold text-yellow-400">{label}</label>
            <select
                value={selectedDeckName}
                onChange={(e) => onSelect(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded p-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
                {allDecks.map((deck) => (
                    <option key={deck.name} value={deck.name}>{t(deck.name, { default: deck.name })}</option>
                ))}
            </select>
        </div>
    );
    
    const StartingPlayerSelector: React.FC = () => (
         <div className="flex flex-col space-y-2">
            <label className="text-lg font-semibold text-yellow-400">{t('choose_starting_player')}</label>
            <div className="flex gap-4 bg-slate-700 border border-slate-600 rounded p-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="startingPlayer" value={0} checked={startingPlayer === 0} onChange={() => setStartingPlayer(0)} className="form-radio text-yellow-500 bg-slate-600" />
                    <span>{t('player_1_start')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="startingPlayer" value={1} checked={startingPlayer === 1} onChange={() => setStartingPlayer(1)} className="form-radio text-yellow-500 bg-slate-600" />
                    <span>{t('player_2_start')}</span>
                </label>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col items-center justify-center h-[80vh] px-4">
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
            <div className="bg-slate-800 p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-md space-y-6 border-2 border-yellow-500/50">
                <h2 className="text-3xl font-bold text-center text-yellow-300">{t('game_setup')}</h2>
                
                <DeckSelector label={t('player_1_deck')} selectedDeckName={p1DeckName} onSelect={setP1DeckName} />
                <DeckSelector label={t('player_2_cpu_deck')} selectedDeckName={p2DeckName} onSelect={setP2DeckName} />
                <StartingPlayerSelector />

                <div className="flex flex-col space-y-4 pt-4">
                     <button
                        onClick={() => handleStart('PvCPU')}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105"
                    >
                        {t('start_vs_cpu')}
                    </button>
                     <button
                        onClick={() => handleStart('PvP')}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105"
                    >
                        {t('start_solitaire')}
                    </button>
                    <button
                        onClick={onGoToDeckBuilder}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105"
                    >
                        {t('deck_builder_menu')}
                    </button>
                    <button
                        onClick={handleImportClick}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105"
                    >
                        {t('import_deck_button')}
                    </button>
                </div>
            </div>
             <p className="text-xs text-slate-400 mt-8 text-center max-w-md">
               {t('fan_disclaimer')}
             </p>
        </div>
    );
};
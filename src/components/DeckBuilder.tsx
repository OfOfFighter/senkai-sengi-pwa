
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { ALL_CARDS, getCardById, DECK_RULES, loadCustomDecks, saveCustomDecks } from '../services/gameService';
import type { Card, Deck } from '../types';
import { CardColor, CardType } from '../types';
import { useLayout } from '../App';
import { CardView } from './CardView';

const FocusedCardView: React.FC<{ card: Card | null }> = ({ card }) => {
    const { t } = useLocalization();
    if (!card) {
      return (
         <div className="w-full h-full bg-slate-900/50 border-l-2 border-slate-700 flex flex-col items-center justify-center p-4">
             <p className="text-slate-400 text-center">{t('click_card_to_view')}</p>
         </div>
      );
    }

    return (
      <div className="w-full h-full bg-slate-900/50 border-l-2 border-slate-700 flex flex-col p-4 space-y-4 overflow-y-auto">
        <CardView card={card} size="normal" />
        <div className="bg-slate-800 p-3 rounded-lg flex-grow">
          <h3 className="text-xl font-bold text-yellow-300">{card.name}</h3>
          <p className="text-sm text-slate-300">{t('card_cost')}: {card.cost} {t(`color_${card.color.toLowerCase()}`)}</p>
          {card.type === CardType.Monster && 'ap' in card && 'hp' in card && (
            <p className="text-sm text-slate-300">AP: {card.ap} / HP: {card.hp}</p>
          )}
          <p className="text-md mt-2 text-slate-200 whitespace-pre-wrap">{card.text}</p>
        </div>
      </div>
    );
};

const DeckList: React.FC<{
    deck: Deck;
    onCardClick: (cardId: string) => void;
    onCardLongPress: (card: Card) => void;
    onSelectCard: (cardId: string) => void;
}> = ({ deck, onCardClick, onCardLongPress, onSelectCard }) => {
    const { t } = useLocalization();
    const longPressTimer = useRef<number | null>(null);

    const handlePressStart = (card: Card) => {
        longPressTimer.current = window.setTimeout(() => {
            onCardLongPress(card);
        }, 500);
    };

    const handlePressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
    };

    const mainDeckCount = deck.mainDeck.length;
    const magicDeckCount = deck.magicDeck.length;
    
    const isMainDeckValid = mainDeckCount === DECK_RULES.MAIN_DECK_SIZE;
    const isMagicDeckValid = magicDeckCount === DECK_RULES.MAGIC_DECK_SIZE;

    const groupCards = (cardIds: string[]) => {
        const counts: { [id: string]: number } = {};
        cardIds.forEach(id => {
            counts[id] = (counts[id] || 0) + 1;
        });
        return Object.entries(counts).map(([id, count]) => ({ card: getCardById(id)!, count }));
    };

    const mainDeckGrouped = useMemo(() => groupCards(deck.mainDeck), [deck.mainDeck]);
    const magicDeckGrouped = useMemo(() => groupCards(deck.magicDeck), [deck.magicDeck]);

    const CardRow: React.FC<{ card: Card; count: number }> = ({ card, count }) => (
        <div 
            className="flex justify-between items-center p-2 bg-slate-700/50 rounded hover:bg-slate-600/50 cursor-pointer"
            onClick={() => onCardClick(card.id)}
            onMouseEnter={() => onSelectCard(card.id)}
            onTouchStart={() => handlePressStart(card)}
            onTouchEnd={handlePressEnd}
            onMouseDown={() => handlePressStart(card)}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
        >
            <span className="truncate">{card.name}</span>
            <span className="font-bold">x{count}</span>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-slate-800 p-2 rounded-lg">
            <div className="flex-1 overflow-y-auto pr-2">
                <h3 className={`text-lg font-bold mb-2 ${isMainDeckValid ? 'text-green-400' : 'text-red-400'}`}>
                    {t('main_deck_header')} ({mainDeckCount}/{DECK_RULES.MAIN_DECK_SIZE})
                </h3>
                <div className="space-y-1">
                    {mainDeckGrouped.map(({ card, count }) => <CardRow key={card.id} card={card} count={count} />)}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 mt-4 pt-4 border-t-2 border-slate-700">
                <h3 className={`text-lg font-bold mb-2 ${isMagicDeckValid ? 'text-green-400' : 'text-purple-400'}`}>
                    {t('magic_deck_header')} ({magicDeckCount}/{DECK_RULES.MAGIC_DECK_SIZE})
                </h3>
                <div className="space-y-1">
                     {magicDeckGrouped.map(({ card, count }) => <CardRow key={card.id} card={card} count={count} />)}
                </div>
            </div>
        </div>
    );
};

const CardCollection: React.FC<{
    cards: Card[];
    onCardClick: (card: Card) => void;
    onCardLongPress: (card: Card) => void;
    onSelectCard: (cardId: string) => void;
}> = ({ cards, onCardClick, onCardLongPress, onSelectCard }) => {
    const longPressTimer = useRef<number | null>(null);
    const isLongPress = useRef(false);

    const handlePressStart = (card: Card) => {
        isLongPress.current = false;
        longPressTimer.current = window.setTimeout(() => {
            isLongPress.current = true;
            onCardLongPress(card);
        }, 500);
    };

    const handlePressEnd = (card: Card) => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
        if (!isLongPress.current) {
            onCardClick(card);
        }
    };
    
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2 overflow-y-auto">
            {cards.map(card => (
                <div key={card.id} 
                    onMouseEnter={() => onSelectCard(card.id)}
                    onMouseDown={() => handlePressStart(card)}
                    onMouseUp={() => handlePressEnd(card)}
                    onMouseLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }}
                    onTouchStart={() => handlePressStart(card)}
                    onTouchEnd={() => handlePressEnd(card)}
                >
                    <CardView card={card} size="small" />
                </div>
            ))}
        </div>
    );
};

const HelpModal: React.FC<{ onClose: () => void; layoutMode: 'sp' | 'pc' }> = ({ onClose, layoutMode }) => {
    const { t } = useLocalization();
    const isSP = layoutMode === 'sp';

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full border-2 border-yellow-500/50 shadow-lg text-slate-200 overflow-y-auto max-h-[90vh]">
                <h2 className="text-2xl font-bold text-yellow-300 mb-4">{t('deckbuilder_help_title')}</h2>
                <div className="space-y-3 text-sm">
                    <p><strong>{t('deckbuilder_help_add_title')}:</strong> {t(isSP ? 'deckbuilder_help_add_desc_sp' : 'deckbuilder_help_add_desc_pc')}</p>
                    <p><strong>{t('deckbuilder_help_remove_title')}:</strong> {t(isSP ? 'deckbuilder_help_remove_desc_sp' : 'deckbuilder_help_remove_desc_pc')}</p>
                    <p><strong>{t(isSP ? 'deckbuilder_help_details_title_sp' : 'deckbuilder_help_details_title_pc')}:</strong> {t(isSP ? 'deckbuilder_help_details_desc_sp' : 'deckbuilder_help_details_desc_pc')}</p>
                    <p><strong>{t('deckbuilder_help_save_title')}:</strong> {t('deckbuilder_help_save_desc')}</p>
                    <p><strong>{t('deckbuilder_help_load_title')}:</strong> {t('deckbuilder_help_load_desc')}</p>
                    <p><strong>{t('deckbuilder_help_actions_title')}:</strong> {t('deckbuilder_help_actions_desc')}</p>
                </div>
                <button
                    onClick={onClose}
                    className="mt-6 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-6 rounded-lg w-full"
                >
                    {t('close_button')}
                </button>
            </div>
        </div>
    );
};

interface DeckBuilderProps {
  onExit: () => void;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({ onExit }) => {
    const { t } = useLocalization();
    const { layoutMode } = useLayout();
    const [savedDecks, setSavedDecks] = useState<Deck[]>([]);
    const [currentDeck, setCurrentDeck] = useState<Deck>({ name: t('new_deck_default_name'), mainDeck: [], magicDeck: [] });
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isHelpVisible, setIsHelpVisible] = useState(false);
    
    // SP Mode state
    const [isDeckListVisible, setIsDeckListVisible] = useState(false);
    const [modalFocusedCard, setModalFocusedCard] = useState<Card | null>(null);

    // Filters
    const [searchText, setSearchText] = useState('');
    const [colorFilter, setColorFilter] = useState<CardColor | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<CardType | 'all'>('all');

    useEffect(() => {
        setSavedDecks(loadCustomDecks());
    }, []);

    const handleAddCard = (card: Card) => {
        const { mainDeck, magicDeck } = currentDeck;

        if (card.type === CardType.Magic) {
            if (magicDeck.length >= DECK_RULES.MAGIC_DECK_SIZE) return;

            const isAwakened = card.id.includes('_awakened');
            if (isAwakened) {
                const currentCount = magicDeck.filter(id => id === card.id).length;
                if (currentCount >= DECK_RULES.MAX_COPIES) {
                    return;
                }
            }
            setCurrentDeck({ ...currentDeck, magicDeck: [...magicDeck, card.id].sort() });

        } else {
            if (mainDeck.length >= DECK_RULES.MAIN_DECK_SIZE) return;

            const currentCount = mainDeck.filter(id => id === card.id).length;
            if (currentCount >= DECK_RULES.MAX_COPIES) {
                return;
            }
            setCurrentDeck({ ...currentDeck, mainDeck: [...mainDeck, card.id].sort() });
        }
    };
    
    const handleRemoveCard = (cardId: string) => {
        const card = getCardById(cardId)!;
        
        const deckToModify = card.type === CardType.Magic ? 'magicDeck' : 'mainDeck';
        const targetDeck = currentDeck[deckToModify];

        const cardIndex = targetDeck.lastIndexOf(cardId);
        if (cardIndex > -1) {
            const newDeck = [...targetDeck];
            newDeck.splice(cardIndex, 1);
            setCurrentDeck({ ...currentDeck, [deckToModify]: newDeck });
        }
    };
    
    const handleSaveDeck = () => {
        if (!currentDeck.name.trim()) {
            alert(t('deck_name_required'));
            return;
        }
        const otherDecks = savedDecks.filter(d => d.name !== currentDeck.name);
        const newDecks = [...otherDecks, currentDeck];
        saveCustomDecks(newDecks);
        setSavedDecks(newDecks);
        alert(`'${currentDeck.name}' ${t('deck_saved_alert')}`);
    };

    const handleLoadDeck = (deckName: string) => {
        const deckToLoad = savedDecks.find(d => d.name === deckName);
        if (deckToLoad) {
            setCurrentDeck(JSON.parse(JSON.stringify(deckToLoad))); // Deep copy
        }
    };

    const handleNewDeck = () => {
        setCurrentDeck({ name: t('new_deck_default_name'), mainDeck: [], magicDeck: [] });
    };

    const handleDeleteDeck = () => {
        if (!currentDeck.name || !savedDecks.some(d => d.name === currentDeck.name)) {
            alert(t('deck_not_saved_alert'));
            return;
        }
        if (confirm(`${t('delete_deck_confirm')} '${currentDeck.name}'?`)) {
            const newDecks = savedDecks.filter(d => d.name !== currentDeck.name);
            saveCustomDecks(newDecks);
            setSavedDecks(newDecks);
            handleNewDeck();
        }
    };

    const handleExportDeck = () => {
        if (!currentDeck.name.trim()) {
            alert(t('deck_name_required'));
            return;
        }
        const deckJson = JSON.stringify(currentDeck, null, 2);
        const blob = new Blob([deckJson], { type: 'application/json' });

        const now = new Date();
        const pad = (num: number) => num.toString().padStart(2, '0');
        const timestamp = `${pad(now.getFullYear()).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
        const filename = `${currentDeck.name}_${timestamp}.json`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

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
                const importedDeck = JSON.parse(text);
                
                if (importedDeck.name && Array.isArray(importedDeck.mainDeck) && Array.isArray(importedDeck.magicDeck)) {
                    setCurrentDeck(importedDeck);
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

    const filteredCards = useMemo(() => {
        return ALL_CARDS.filter(card => {
            const nameMatch = card.name.toLowerCase().includes(searchText.toLowerCase()) || t(card.name, {default: card.name}).toLowerCase().includes(searchText.toLowerCase());
            const colorMatch = colorFilter === 'all' || card.color === colorFilter;
            const typeMatch = typeFilter === 'all' || card.type === typeFilter;
            return nameMatch && colorMatch && typeMatch;
        });
    }, [searchText, colorFilter, typeFilter, t]);

    const isDeckValid = currentDeck.mainDeck.length === DECK_RULES.MAIN_DECK_SIZE && currentDeck.magicDeck.length === DECK_RULES.MAGIC_DECK_SIZE;

    const selectedCard = selectedCardId ? (getCardById(selectedCardId) ?? null) : null;
    
    const Filters = () => (
         <div className="p-2 bg-slate-800/50 rounded-lg flex flex-wrap gap-2 items-center">
            <input 
                type="text"
                placeholder={t('search_by_name')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded p-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 flex-grow"
            />
             <select value={colorFilter} onChange={e => setColorFilter(e.target.value as any)} className="bg-slate-700 border border-slate-600 rounded p-2 text-white">
                <option value="all">{t('filter_all_colors')}</option>
                <option value={CardColor.Red}>{t('color_red')}</option>
                <option value={CardColor.Green}>{t('color_green')}</option>
                <option value={CardColor.Blue}>{t('color_blue')}</option>
                <option value={CardColor.Colorless}>{t('color_colorless')}</option>
            </select>
             <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="bg-slate-700 border border-slate-600 rounded p-2 text-white">
                <option value="all">{t('filter_all_types')}</option>
                <option value={CardType.Monster}>{t('card_type_monster')}</option>
                <option value={CardType.Spell}>{t('card_type_spell')}</option>
                <option value={CardType.Attachment}>{t('card_type_attachment')}</option>
                <option value={CardType.Magic}>{t('card_type_magic')}</option>
            </select>
        </div>
    );

    const DeckControls = () => (
        <div className="p-2 bg-slate-800/50 rounded-lg space-y-2">
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
            <div className="flex gap-2">
                <input 
                    type="text"
                    placeholder={t('deck_name_placeholder')}
                    value={currentDeck.name}
                    onChange={e => setCurrentDeck({...currentDeck, name: e.target.value})}
                    className="bg-slate-700 border border-slate-600 rounded p-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 w-full"
                />
                 <select onChange={e => handleLoadDeck(e.target.value)} className="bg-slate-700 border border-slate-600 rounded p-2 text-white" value="">
                    <option value="" disabled>{t('load_deck_button')}</option>
                    {savedDecks.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
                <button onClick={() => setIsHelpVisible(true)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded" aria-label="Help">?</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                 <button onClick={handleNewDeck} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">{t('new_deck_button')}</button>
                 <button onClick={handleSaveDeck} disabled={!isDeckValid} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed">{t('save_deck_button')}</button>
                 <button onClick={handleDeleteDeck} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">{t('delete_deck_button')}</button>
                 <button onClick={handleImportClick} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">{t('import_deck_button')}</button>
                 <button onClick={handleExportDeck} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">{t('export_deck_button')}</button>
                 <button onClick={onExit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">{t('back_to_menu')}</button>
            </div>
        </div>
    );
    
    if (layoutMode === 'sp') {
        const DeckListModal: React.FC = () => (
             <div className="fixed inset-0 bg-black/70 z-40 p-4 flex flex-col">
                <div className="flex-grow" onClick={() => setIsDeckListVisible(false)}></div>
                <div className="bg-slate-900 rounded-t-lg p-4 h-4/5 flex flex-col border-t-2 border-yellow-500/50">
                    <DeckList 
                        deck={currentDeck} 
                        onCardClick={handleRemoveCard}
                        onCardLongPress={setModalFocusedCard}
                        onSelectCard={() => {}} // Not used in SP
                    />
                    <button onClick={() => setIsDeckListVisible(false)} className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded w-full">
                        {t('close_button')}
                    </button>
                </div>
            </div>
        );

        const FocusedCardModal: React.FC = () => (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={() => setModalFocusedCard(null)}>
                <div onClick={(e) => e.stopPropagation()} className="relative w-72">
                    <FocusedCardView card={modalFocusedCard} />
                </div>
            </div>
        );

        const DeckSummaryBar: React.FC = () => (
            <button 
                onClick={() => setIsDeckListVisible(true)}
                className="fixed bottom-0 left-0 right-0 w-full bg-slate-800 p-2 border-t-2 border-yellow-500/50 flex justify-between items-center z-20"
            >
                <span className="font-bold truncate text-yellow-300">{currentDeck.name}</span>
                <div className="flex gap-4 text-sm">
                    <span className={currentDeck.mainDeck.length === DECK_RULES.MAIN_DECK_SIZE ? 'text-green-400' : 'text-red-400'}>
                        {t('main_deck_header')}: {currentDeck.mainDeck.length}/{DECK_RULES.MAIN_DECK_SIZE}
                    </span>
                    <span className={currentDeck.magicDeck.length === DECK_RULES.MAGIC_DECK_SIZE ? 'text-green-400' : 'text-purple-400'}>
                        {t('magic_deck_header')}: {currentDeck.magicDeck.length}/{DECK_RULES.MAGIC_DECK_SIZE}
                    </span>
                </div>
            </button>
        );

        return (
             <div className="h-screen flex flex-col bg-slate-900 text-white">
                {isHelpVisible && <HelpModal onClose={() => setIsHelpVisible(false)} layoutMode="sp" />}
                {isDeckListVisible && <DeckListModal />}
                {modalFocusedCard && <FocusedCardModal />}
                
                <div className="p-1"><DeckControls /></div>
                
                <div className="flex-grow flex flex-col min-h-0 p-1 pb-14">
                    <Filters />
                    <div className="flex-grow min-h-0">
                        <CardCollection 
                            cards={filteredCards} 
                            onCardClick={handleAddCard} 
                            onCardLongPress={setModalFocusedCard}
                            onSelectCard={setSelectedCardId} 
                        />
                    </div>
                </div>

                <DeckSummaryBar />
            </div>
        );
    }
    
    // PC Layout
    return (
        <div className="h-screen flex flex-col p-2 bg-slate-900 text-white">
            {isHelpVisible && <HelpModal onClose={() => setIsHelpVisible(false)} layoutMode="pc" />}
            <DeckControls />
            <div className="flex-grow flex flex-row gap-2 mt-2 min-h-0">
                {/* Card Collection */}
                <div className="w-2/5 flex flex-col">
                    <Filters />
                    <div className="flex-grow min-h-0">
                       <CardCollection 
                           cards={filteredCards} 
                           onCardClick={handleAddCard} 
                           onCardLongPress={() => {}} // Not used in PC
                           onSelectCard={setSelectedCardId}
                        />
                    </div>
                </div>
                {/* Deck List & Card View */}
                <div className="w-3/5 flex flex-col lg:flex-row gap-2">
                    <div className="w-full lg:w-1/2 min-h-0">
                        <DeckList 
                           deck={currentDeck} 
                           onCardClick={handleRemoveCard}
                           onCardLongPress={() => {}} // Not used in PC
                           onSelectCard={setSelectedCardId}
                        />
                    </div>
                    <div className="w-full lg:w-1/2">
                        <FocusedCardView card={selectedCard} />
                    </div>
                </div>
            </div>
        </div>
    );
};
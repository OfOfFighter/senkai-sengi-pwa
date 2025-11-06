import React, { useReducer, useCallback, useEffect, useState, useRef } from 'react';
import type { Reducer } from 'react';
import { produce } from 'immer';
import { CardView, CardBack } from './CardView';
import { getCardById } from '../services/gameService';
import { getCpuAction } from '../services/cpuService';
import type { Deck, GameState, PlayerState, Card, InPlayCard, GameMode, GameAction, PendingAction } from '../types';
import { GamePhase, CardType, CardColor } from '../types';
import { useLocalization } from '../contexts/LocalizationContext';
import { useLayout } from '../App';

const useWindowSize = () => {
    const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    useEffect(() => {
        const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return size;
};

type AnimationState = 'entering' | 'visible' | 'exiting' | 'hidden';

// --- CHILD COMPONENTS ---

const MagicZoneView: React.FC<{ player: PlayerState, size: 'normal' | 'small' }> = ({ player, size }) => {
    const { t } = useLocalization();
    // Fix: Correctly type the accumulator for the reduce function to fix type inference issues.
    // FIX: Removed generic from reduce and explicitly typed the accumulator and initial value to fix type errors.
    const counts = player.magicZone.reduce(
        (acc: Record<string, { total: number; untapped: number }>, card) => {
            let key;
            if (card.isFaceDown) {
                key = 'Flipped';
            } else {
                const isAwakened = card.id.includes('_awakened');
                key = `${card.color}${isAwakened ? '_Awakened' : ''}`;
            }

            if (!acc[key]) {
                acc[key] = { total: 0, untapped: 0 };
            }
            acc[key].total++;
            if (!card.isTapped) {
                acc[key].untapped++;
            }
            return acc;
        },
        {} as Record<string, { total: number; untapped: number }>
    );
    
    const colorClasses: Record<string, { text: string; bg: string }> = {
        [CardColor.Red]: { text: 'text-red-400', bg: 'bg-red-500' },
        [CardColor.Green]: { text: 'text-green-400', bg: 'bg-green-500' },
        [CardColor.Blue]: { text: 'text-blue-400', bg: 'bg-blue-500' },
        [CardColor.Colorless]: { text: 'text-gray-400', bg: 'bg-gray-500' },
    };

    const getColorFromKey = (key: string): CardColor => {
        if (key.startsWith('Red')) return CardColor.Red;
        if (key.startsWith('Green')) return CardColor.Green;
        if (key.startsWith('Blue')) return CardColor.Blue;
        return CardColor.Colorless;
    }
    
    const containerClasses = size === 'small' ? 'w-28 h-40' : 'w-36 h-52';

    return (
        <div className={`${containerClasses} bg-slate-800/50 rounded-lg p-2 flex flex-col border-2 border-purple-500`}>
            <h4 className="text-center text-sm font-bold text-purple-300 mb-2">{t('magic_zone')}</h4>
            <div className="flex-grow space-y-1 overflow-y-auto">
                {/* FIX: Replaced Object.entries with Object.keys to fix a type inference issue where the value was incorrectly typed as 'unknown'. */}
                {Object.keys(counts).map((key) => {
                    const count = counts[key];
                    const color = getColorFromKey(key);
                    const labelKey = `color_${color.toLowerCase()}${key.includes('_Awakened') ? '_awakened' : ''}${key === 'Flipped' ? '_flipped' : ''}`;
                    return (
                        <div key={key} className={`flex items-center justify-between p-1 rounded-md ${colorClasses[color].text}`}>
                            <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${colorClasses[color].bg}`} />
                                <span className="font-semibold text-xs">{t(labelKey, {default: key})}</span>
                            </div>
                            <span className="font-mono font-bold text-sm">{count.untapped}/{count.total}</span>
                        </div>
                    );
                })}
                 {player.magicZone.length === 0 && <p className="text-slate-400 text-center pt-8 text-xs">{t('empty')}</p>}
            </div>
        </div>
    );
};


const PlayerHand: React.FC<{
  hand: Card[];
  onCardClick: (index: number) => void;
  selectedIndex: number | null;
  inputDisabled: boolean;
  isCurrentPlayer: boolean;
  pendingAction: PendingAction | null;
  size: 'normal' | 'small';
}> = ({ hand, onCardClick, selectedIndex, inputDisabled, isCurrentPlayer, pendingAction, size }) => (
  <div className={`flex justify-center items-end h-44 lg:h-56 bg-black/30 p-2 rounded-t-lg min-h-[11rem] lg:min-h-[14rem] ${pendingAction?.type === 'DISCARD_CARD' ? 'ring-2 ring-red-500' : ''}`}>
    {hand.map((card, index) => (
      <div key={index} className="-mx-4 lg:-mx-6">
        <CardView
          card={card}
          isSelected={(isCurrentPlayer && selectedIndex === index) || pendingAction?.type === 'DISCARD_CARD'}
          onClick={() => !inputDisabled && onCardClick(index)}
          size={size}
        />
      </div>
    ))}
  </div>
);

const PlayerField: React.FC<{
    player: PlayerState;
    isCurrentPlayer: boolean;
    isTopPlayer: boolean;
    onLaneClick: (laneIndex: number) => void;
    onMonsterClick: (uuid: string) => void;
    selectedLaneCardUuid: string | null;
    playableLaneIndices: number[];
    attackableMonsterUuids: string[];
    attachableMonsterUuids: string[];
    targetableUuids: string[];
    size: 'normal' | 'small';
}> = ({ player, isCurrentPlayer, isTopPlayer, onLaneClick, onMonsterClick, selectedLaneCardUuid, playableLaneIndices, attackableMonsterUuids, attachableMonsterUuids, targetableUuids, size }) => {
    
    const getCalculatedStats = (monster: InPlayCard, playerState: PlayerState) => {
        let ap = monster.ap || 0;
        let hp = monster.hp || 0;

        monster.attachments.forEach(att => {
            ap += att.apModifier || 0;
            hp += att.hpModifier || 0;
        });

        ap += monster.tempApModifier || 0;

        // Continuous effects
        if (monster.id === 'g001') { // Allosaurus
            const greenMagicCount = playerState.magicZone.filter(m => !m.isFaceDown && m.color === CardColor.Green).length;
            if (greenMagicCount >= 4) {
                ap += 200;
                hp += 200;
            }
        }
        
        return { totalAp: ap, totalHp: hp };
    };

    return (
    <div className={`flex flex-col w-full ${isTopPlayer ? 'flex-col-reverse' : ''}`}>
        <div className="flex justify-center gap-2 lg:gap-4 my-2 lg:my-4 h-44 lg:h-56 items-center">
            {[0, 1, 2].map(i => (
                <div 
                  key={i} 
                  className={`w-32 lg:w-40 h-full bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center transition-all ${isCurrentPlayer && playableLaneIndices.includes(i) ? 'border-solid border-yellow-400 ring-2 lg:ring-4 ring-yellow-400' : ''}`} 
                  onClick={() => onLaneClick(i)}
                >
                    {player.lanes[i] && (
                        <CardView 
                            card={player.lanes[i]!}
                            isTapped={(player.lanes[i] as InPlayCard).isTapped}
                            damage={(player.lanes[i] as InPlayCard).damage}
                            isSelected={isCurrentPlayer && selectedLaneCardUuid === (player.lanes[i] as InPlayCard).uuid}
                            onClick={() => onMonsterClick((player.lanes[i] as InPlayCard).uuid)}
                            isAttackableTarget={attackableMonsterUuids.includes((player.lanes[i] as InPlayCard).uuid)}
                            isAttachableTarget={attachableMonsterUuids.includes((player.lanes[i] as InPlayCard).uuid)}
                            className={targetableUuids.includes((player.lanes[i] as InPlayCard).uuid) ? 'ring-2 lg:ring-4 ring-purple-500 shadow-purple-500/50' : ''}
                            totalAp={getCalculatedStats(player.lanes[i] as InPlayCard, player).totalAp}
                            totalHp={getCalculatedStats(player.lanes[i] as InPlayCard, player).totalHp}
                            size={size}
                        />
                    )}
                </div>
            ))}
        </div>

        <div className="flex justify-around items-start">
            <CardBack type="main" count={player.mainDeck.length} size={size} />
            <div className={`${size === 'small' ? 'w-28 h-40' : 'w-36 h-52'} bg-slate-800/50 rounded-lg border-2 border-slate-600 flex items-center justify-center`}>
              {player.discard.length > 0 && <CardView card={player.discard[player.discard.length-1]} size={size} />}
            </div>
            <MagicZoneView player={player} size={size} />
            <CardBack type="magic" count={player.magicDeck.length} size={size} />
            <div className={`${size === 'small' ? 'w-28 h-40' : 'w-36 h-52'} flex flex-col justify-center space-y-1 bg-slate-800/50 rounded-lg p-2 border-2 border-yellow-800`}>
              {player.walls.map((_, i) => <div key={i} className="h-full bg-yellow-800/50 rounded border-2 border-yellow-600" />)}
            </div>
        </div>
    </div>
    )
};


const FocusedCardView: React.FC<{ card: Card | InPlayCard | null, onClose?: () => void }> = ({ card, onClose }) => {
    const { t } = useLocalization();
    if (!card) {
      return (
         <div className="w-72 h-full bg-slate-900/50 border-l-2 border-slate-700 flex flex-col items-center justify-center p-4">
             <p className="text-slate-400 text-center">{t('click_to_see_details')}</p>
         </div>
      );
    }

    return (
      <div className="w-72 h-full bg-slate-900/50 border-l-2 border-slate-700 flex flex-col p-4 space-y-4 overflow-y-auto">
        {onClose && (
            <button onClick={onClose} className="absolute top-2 right-2 bg-red-600 rounded-full w-8 h-8 text-white font-bold z-10">X</button>
        )}
        <CardView card={card} />
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

const GuidanceDisplay: React.FC<{text: string}> = ({text}) => {
    return (
        <div className="w-full bg-sky-900/70 p-2 text-center border-b-2 border-sky-500 shadow-lg text-sm lg:text-base z-10">
            <p className="text-sky-200 font-semibold">{text}</p>
        </div>
    )
}

// --- REDUCER LOGIC ---
const shuffle = <T,>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const createInitialState = (): GameState => {
    const initialPlayerState = (id: number, name: string): PlayerState => ({
        id, name, mainDeck: [], magicDeck: [], hand: [], discard: [], magicZone: [], lanes: [null, null, null], walls: [], hasWon: false
    });
    return {
        players: [initialPlayerState(0, "Player 1"), initialPlayerState(1, "Player 2")],
        currentPlayerId: 0,
        phase: GamePhase.Setup,
        turn: 0,
        message: 'Game is setting up...',
        selectedHandCardIndex: null,
        selectedLaneCardUuid: null,
        attackers: {},
        gameMode: 'PvP',
        startingPlayerId: 0,
        pendingAction: null,
    };
};

const gameReducer: Reducer<GameState, GameAction> = produce((draft: GameState, action: GameAction) => {
    switch (action.type) {
        case 'START_GAME': {
            const { p1Deck, p2Deck, gameMode, startingPlayerId } = action.payload;
            const decks = [p1Deck, p2Deck];
            
            draft.gameMode = gameMode;
            draft.turn = 1;

            if (startingPlayerId !== undefined) {
                draft.currentPlayerId = startingPlayerId;
            } else {
                draft.currentPlayerId = Math.floor(Math.random() * 2);
            }
            draft.startingPlayerId = draft.currentPlayerId;

            decks.forEach((deckData, i) => {
                const player = draft.players[i];
                if (i === 1 && gameMode === 'PvCPU') {
                    player.name = "CPU";
                } else {
                    player.name = `P${i+1}`;
                }
                player.mainDeck = shuffle(deckData.mainDeck.map(id => getCardById(id)!));
                player.magicDeck = shuffle(deckData.magicDeck.map(id => getCardById(id)!));
                
                player.walls = player.mainDeck.splice(0, 4);
                player.hand = player.mainDeck.splice(0, 4);
            });
            draft.phase = GamePhase.Upkeep;
            draft.message = `Turn ${draft.turn} - P${draft.currentPlayerId + 1}'s Upkeep Phase.`;
            break;
        }

        case 'NEXT_PHASE': {
            const transitions: Record<GamePhase, GamePhase> = {
                [GamePhase.Setup]: GamePhase.Upkeep,
                [GamePhase.Upkeep]: GamePhase.Draw,
                [GamePhase.Draw]: GamePhase.Set,
                [GamePhase.Set]: GamePhase.Main,
                [GamePhase.Main]: GamePhase.End,
                [GamePhase.End]: GamePhase.Upkeep,
                [GamePhase.GameOver]: GamePhase.GameOver,
            };

            const currentPhase = draft.phase;
            const nextPhase = transitions[currentPhase];

            if (currentPhase === GamePhase.End) {
                // End of turn cleanup for ALL monsters
                draft.players.forEach(player => {
                    player.lanes.forEach(card => {
                        if (card) {
                            card.damage = 0;
                            // Smilodon effect wears off
                            if(card.id === 'g008') {
                                card.tempApModifier = 0;
                            }
                        }
                    });
                });
                draft.attackers = {};
                draft.selectedLaneCardUuid = null;
                draft.selectedHandCardIndex = null;

                // Rule: If a turn ends when BOTH players have no cards, it's a draw.
                if(draft.players[0].mainDeck.length === 0 && draft.players[1].mainDeck.length === 0) {
                     draft.phase = GamePhase.GameOver;
                     draft.message = "Both players are out of cards. It's a draw!";
                     break;
                }

                // Switch player and increment turn if needed
                const nextPlayerId = (draft.currentPlayerId + 1) % 2;
                draft.currentPlayerId = nextPlayerId;
                if (nextPlayerId === draft.startingPlayerId) {
                    draft.turn += 1;
                }
            } else if (currentPhase === GamePhase.Main) {
                // End of Main Phase triggers
                const player = draft.players[draft.currentPlayerId];
                const karasuTengu = player.lanes.find(c => c?.id === 'b009');
                const blueMagicCount = player.magicZone.filter(m => !m.isFaceDown && m.color === CardColor.Blue).length;
                if (karasuTengu && blueMagicCount >= 3) {
                    draft.pendingAction = { type: 'CHOOSE_EFFECT', effect: 'KARASU_TENGU_RETURN', cardUuid: karasuTengu.uuid };
                    // Pause phase transition until choice is made
                    return;
                }
            }
            
            draft.phase = nextPhase;

            const player = draft.players[draft.currentPlayerId];
            
            // Handle automatic phase actions
            if (nextPhase === GamePhase.Upkeep) {
                // Handle Vanish keyword at start of Upkeep
                player.lanes.forEach((monster) => {
                    if (monster) {
                        monster.attachments = monster.attachments.filter(att => {
                            if (att.text.includes("【消滅】")) {
                                player.discard.push(getCardById(att.id)!); // Push base card to discard
                                return false; // remove from attachments
                            }
                            return true;
                        });
                    }
                });

                player.lanes.forEach(c => { if(c) c.isTapped = false; });
                player.magicZone.forEach(c => c.isTapped = false);
            } else if (nextPhase === GamePhase.Draw) {
                if (player.mainDeck.length > 0) {
                    player.hand.push(player.mainDeck.pop()!);
                }
            } else if (nextPhase === GamePhase.Set) {
                 const isTheStartingPlayer = player.id === draft.startingPlayerId;
                 const amount = (draft.turn === 1 && isTheStartingPlayer) ? 1 : 2;
                 for (let i=0; i < amount && player.magicDeck.length > 0; i++) {
                    const magicCard = player.magicDeck.pop()!;
                    // Magic from the Set phase enters untapped and can be used this turn.
                    const newMagicCard: InPlayCard = { ...magicCard, uuid: crypto.randomUUID(), isTapped: false, damage: 0, attachments: [] };
                    player.magicZone.push(newMagicCard);
                }
            }
            draft.message = `Turn ${draft.turn} - P${draft.currentPlayerId + 1}'s ${nextPhase} Phase.`;
            if (draft.gameMode === 'PvCPU' && draft.currentPlayerId === 1) {
              draft.message = `Turn ${draft.turn} - CPU's ${nextPhase} Phase.`;
            }
            break;
        }
        
        case 'SELECT_HAND_CARD':
            if (draft.pendingAction?.type === 'DISCARD_CARD') {
                break;
            }
            if (draft.selectedHandCardIndex === action.payload.cardIndex) {
                draft.selectedHandCardIndex = null;
            } else {
                draft.selectedHandCardIndex = action.payload.cardIndex;
            }
            draft.selectedLaneCardUuid = null;
            break;

        case 'SELECT_LANE_CARD':
            if (draft.selectedLaneCardUuid === action.payload.uuid) {
              draft.selectedLaneCardUuid = null;
            } else {
              draft.selectedLaneCardUuid = action.payload.uuid;
            }
            draft.selectedHandCardIndex = null;
            break;
        
        case 'DISCARD_CARD': {
            const player = draft.players[draft.currentPlayerId];
            const pending = draft.pendingAction;

            if (player.hand[action.payload.cardIndex]) {
                const [discardedCard] = player.hand.splice(action.payload.cardIndex, 1);
                player.discard.push(discardedCard);

                if (pending?.type === 'DISCARD_CARD') {
                     if (pending.reason === 'SAVE_PHOENIX') {
                         const { phoenixUuid, ownerId } = pending.context;
                         const phoenixOwner = draft.players[ownerId];
                         const laneIndex = phoenixOwner.lanes.findIndex(c => c?.uuid === phoenixUuid);
                         if(laneIndex !== -1) {
                             const phoenix = phoenixOwner.lanes[laneIndex]!;
                             phoenix.damage = 0; // Heal it
                             phoenixOwner.hand.push(getCardById(phoenix.id)!);
                             phoenixOwner.lanes[laneIndex] = null;
                             draft.message = `${player.name} discarded a card to return Phoenix to hand!`;
                         }
                    }
                }
                
                draft.pendingAction = null;
                if(!draft.message.includes('Phoenix')) {
                    draft.message = `Discarded ${discardedCard.name}.`;
                }
            }
            break;
        }

        case 'PLAY_CARD': {
            const player = draft.players[draft.currentPlayerId];
            const cardIndex = draft.selectedHandCardIndex;
            if (cardIndex === null) break;
            
            const cardToPlay = player.hand[cardIndex];
            if (!cardToPlay) break;
            const { laneIndex, targetUuid } = action.payload;

            // --- VALIDATION PHASE ---
            const availableMana = player.magicZone.filter(m => !m.isTapped && !m.isFaceDown);
            if(availableMana.length < cardToPlay.cost) {
                draft.message = "Not enough magic!";
                break;
            }
            const hasCorrectColor = cardToPlay.cost === 0 || availableMana.some(m => m.color === cardToPlay.color);
            if(!hasCorrectColor && cardToPlay.cost > 0 && cardToPlay.color !== CardColor.Colorless) {
                draft.message = `You need at least one ${cardToPlay.color} magic!`;
                break;
            }
            
            if (cardToPlay.type === CardType.Monster) {
                if(laneIndex === undefined) break;
                if (cardToPlay.text.includes("【大怪魔】") && laneIndex !== 1) {
                    draft.message = "【大怪魔】 can only be played in the center lane.";
                    break;
                }
                const existingMonster = player.lanes[laneIndex];
                if (existingMonster && existingMonster.isTapped) {
                    draft.message = "Cannot replace a tapped monster.";
                    break;
                }
            }
            // TODO: Add more validations for spells/attachments if necessary

            // --- PAYMENT PHASE ---
            const manaToTap: string[] = [];
            let coloredManaPaid = false;
            if(cardToPlay.cost > 0 && cardToPlay.color !== CardColor.Colorless) {
                 for(const mana of availableMana) {
                    if (mana.color === cardToPlay.color && !coloredManaPaid) {
                        manaToTap.push(mana.uuid);
                        coloredManaPaid = true;
                    }
                }
            }
            for(const mana of availableMana) {
                if (manaToTap.length < cardToPlay.cost && !manaToTap.includes(mana.uuid)) {
                   manaToTap.push(mana.uuid);
                }
            }

            if (manaToTap.length < cardToPlay.cost) {
                draft.message = "Mana payment calculation error."; // Should be caught by validation
                break;
            }

            player.magicZone.forEach(m => {
                if (manaToTap.includes(m.uuid)) m.isTapped = true;
            });
            
            // --- RESOLUTION PHASE ---
            const [playedCard] = player.hand.splice(cardIndex, 1);
            player.discard.push(playedCard); // Spells/Attachments go to discard first
            draft.selectedHandCardIndex = null;
            draft.message = `Played ${playedCard.name}!`;

            if (cardToPlay.type === CardType.Monster) {
                if(laneIndex === undefined) break;
                player.discard.pop(); // Remove from discard, it's going to the field
                
                if(player.lanes[laneIndex] !== null) {
                    const replacedCard = player.lanes[laneIndex]!;
                    player.discard.push(replacedCard);
                }
                const newMonster: InPlayCard = { ...playedCard, uuid: crypto.randomUUID(), isTapped: false, damage: 0, attachments: [], tempApModifier: 0 };
                player.lanes[laneIndex] = newMonster;

                // --- Card Effects on Play ---
                if (playedCard.id === 'b008') { // Hakutaku
                    if(player.mainDeck.length > 0) {
                        player.hand.push(player.mainDeck.pop()!);
                        draft.pendingAction = { type: 'DISCARD_CARD', count: 1, reason: 'HAKUTAKU' };
                        draft.message += " Draw 1, now choose a card to discard.";
                    }
                } else if (playedCard.id === 'g008' && [0,2].includes(laneIndex)) { // Smilodon
                    newMonster.tempApModifier = 200;
                    draft.message += " Smilodon gains 200 AP this turn.";
                } else if (playedCard.id === 'r001') { // Fire Drake
                    const redMagicCount = player.magicZone.filter(m => !m.isFaceDown && m.color === CardColor.Red).length;
                    const opponentMonsters = draft.players[(player.id + 1) % 2].lanes.filter(c => c !== null).map(c => c!.uuid);
                    if (redMagicCount >= 4 && opponentMonsters.length > 0) {
                        draft.pendingAction = { type: 'SELECT_TARGET', effect: 'DEAL_DAMAGE', damage: 300, sourceCardId: playedCard.id, validTargetUuids: opponentMonsters };
                        draft.message += " Choose a target for its effect.";
                    }
                }
            } else if (cardToPlay.type === CardType.Attachment) {
                if (!targetUuid) break;
                const targetMonster = player.lanes.find(c => c?.uuid === targetUuid);
                if (targetMonster) {
                    player.discard.pop(); // remove from discard
                    targetMonster.attachments.push({ ...playedCard, uuid: crypto.randomUUID(), isTapped: false, damage: 0, attachments: [] });
                    draft.message = `Attached ${playedCard.name} to ${targetMonster.name}.`;
                } else {
                     player.hand.splice(cardIndex, 0, playedCard); // return to hand if target invalid
                     draft.message = 'Invalid target for attachment.';
                }
            } else if (cardToPlay.type === CardType.Spell) {
                if (playedCard.id === 'g005') { // Taiko no Myakudou
                    if (player.magicDeck.length > 0) {
                        const magicCard = player.magicDeck.pop()!;
                        player.magicZone.push({ ...magicCard, uuid: crypto.randomUUID(), isTapped: true, damage: 0, attachments: [] });
                    }
                } else if (playedCard.id === 'b005') { // Hakanaki Okuribi
                    const validTargets = draft.players[(player.id + 1) % 2].lanes.filter(c => c !== null && !c.text.includes("【大怪魔】")).map(c => c!.uuid);
                    if (validTargets.length > 0) {
                        draft.pendingAction = { type: 'SELECT_TARGET', effect: 'RETURN_TO_HAND', sourceCardId: playedCard.id, validTargetUuids: validTargets };
                    }
                } else if (playedCard.id === 'r005') { // Kaen no Hougeki
                    const validTargets = draft.players[(player.id + 1) % 2].lanes.filter(c => c !== null).map(c => c!.uuid);
                     if (validTargets.length > 0) {
                        draft.pendingAction = { type: 'SELECT_TARGET', effect: 'DEAL_DAMAGE', damage: 300, sourceCardId: playedCard.id, validTargetUuids: validTargets };
                    }
                }
            }
            
            break;
        }

        case 'ATTACH_CARD': {
            // This logic is now handled within 'PLAY_CARD' for better flow.
            break;
        }

        case 'DECLARE_ATTACK': {
            const player = draft.players[draft.currentPlayerId];
            const opponent = draft.players[(draft.currentPlayerId + 1) % 2];
            const attacker = player.lanes.find(c => c?.uuid === draft.selectedLaneCardUuid);

            if (!attacker || attacker.isTapped) break;

            if (action.payload.targetUuid === 'player') {
                if (draft.turn === 1) {
                    draft.message = "Cannot attack players on the first turn.";
                    break;
                }
                if (attacker.text.includes('【ひるむ】')) {
                    draft.message = `${attacker.name} cannot attack players directly.`;
                    break;
                }
                const opponentHasDaikaima = opponent.lanes[1]?.text.includes('【大怪魔】');
                const attackerLaneIndex = player.lanes.findIndex(c => c?.uuid === attacker.uuid);
                if (opponentHasDaikaima && attackerLaneIndex !== 1) {
                    draft.message = `Cannot attack player directly while opponent has a Daikaima.`;
                    break;
                }
            }
            
            const totalAp = (attacker.ap || 0) + (attacker.tempApModifier || 0) + attacker.attachments.reduce((sum, att) => sum + (att.apModifier || 0), 0);
            
            attacker.isTapped = true;

            if (action.payload.targetUuid === 'player') {
                 if (opponent.walls.length === 0) {
                    player.hasWon = true;
                    draft.phase = GamePhase.GameOver;
                    draft.message = `${attacker.name} delivers the final blow! ${player.name} wins!`;
                    if (draft.gameMode === 'PvCPU' && player.id === 1) draft.message = `CPU wins!`;
                    if (draft.gameMode === 'PvCPU' && player.id === 0) draft.message = `You win!`;
                 } else {
                    const wallsToDestroy = attacker.text.includes("【ダブルクラッシャー】") ? 2 : 1;
                    for(let i=0; i < wallsToDestroy && opponent.walls.length > 0; i++) {
                        const destroyedWall = opponent.walls.pop()!;
                        opponent.discard.push(destroyedWall);
                        const magic = opponent.magicZone.find(m => m.id.includes('_awakened') && !m.isTapped && !m.isFaceDown && m.color === destroyedWall.color);
                        if(magic) {
                             draft.pendingAction = { type: 'CHOOSE_EFFECT', effect: 'AWAKENED_MAGIC', cardUuid: magic.uuid, context: { wallCard: destroyedWall }};
                             return;
                        }
                    }
                    draft.message = `${attacker.name} attacks ${opponent.name}, destroying ${wallsToDestroy} wall(s)!`;
                }
            } else {
                const target = opponent.lanes.find(c => c?.uuid === action.payload.targetUuid);
                
                if(target) {
                    const totalHp = (target.hp || 0) + target.attachments.reduce((sum, att) => sum + (att.hpModifier || 0), 0) + (target.tempApModifier || 0);
                    target.damage += totalAp;
                    draft.message = `${attacker.name} attacks ${target.name} for ${totalAp} damage.`;

                    if (target.damage >= totalHp) {
                        if (target.id === 'r007' && opponent.hand.length > 0) {
                            draft.pendingAction = { type: 'CHOOSE_EFFECT', effect: 'SAVE_PHOENIX', cardUuid: target.uuid };
                            return; // Stop here, choice will determine fate
                        }
                        const targetIndex = opponent.lanes.findIndex(c => c?.uuid === target.uuid);
                        if(targetIndex !== -1) {
                            opponent.discard.push(opponent.lanes[targetIndex]!);
                            opponent.lanes[targetIndex] = null;
                            draft.message += ` ${target.name} is destroyed!`;

                            if(attacker.id === 'b001') {
                                const blueMagicCount = player.magicZone.filter(m => !m.isFaceDown && m.color === CardColor.Blue).length;
                                if (blueMagicCount >= 4 && player.mainDeck.length > 0) {
                                    player.hand.push(player.mainDeck.pop()!);
                                    draft.message += ` Yamato Takeru's effect draws a card!`;
                                }
                            }
                        }
                    }
                }
            }

            draft.selectedLaneCardUuid = null;
            break;
        }

        case 'CHOOSE_TARGET': {
            if (!draft.pendingAction || draft.pendingAction.type !== 'SELECT_TARGET') break;
            const { effect, damage } = draft.pendingAction;
            const opponent = draft.players[(draft.currentPlayerId + 1) % 2];
            const target = opponent.lanes.find(c => c?.uuid === action.payload.targetUuid);
            if (!target) break;

            if (effect === 'DEAL_DAMAGE') {
                target.damage += damage!;
                draft.message = `${target.name} takes ${damage} damage.`;
                const totalHp = (target.hp || 0) + target.attachments.reduce((sum, att) => sum + (att.hpModifier || 0), 0);
                if (target.damage >= totalHp) {
                    if (target.id === 'r007' && opponent.hand.length > 0) {
                        draft.pendingAction = { type: 'CHOOSE_EFFECT', effect: 'SAVE_PHOENIX', cardUuid: target.uuid };
                        return;
                    }
                    const targetIndex = opponent.lanes.findIndex(c => c?.uuid === target.uuid);
                    opponent.discard.push(target);
                    opponent.lanes[targetIndex] = null;
                    draft.message += ` ${target.name} is destroyed!`;
                }
            } else if (effect === 'RETURN_TO_HAND') {
                const targetIndex = opponent.lanes.findIndex(c => c?.uuid === target.uuid);
                const originalCard = getCardById(target.id)!;
                opponent.hand.push(originalCard);
                opponent.lanes[targetIndex] = null;
                draft.message = `${target.name} is returned to hand.`;
            }
            draft.pendingAction = null;
            break;
        }

        case 'RESPOND_TO_CHOICE': {
            if (!draft.pendingAction || draft.pendingAction.type !== 'CHOOSE_EFFECT') break;
            const { effect, cardUuid, context } = draft.pendingAction;

            let effectOwner = draft.players.find(p => 
                p.magicZone.some(c => c.uuid === cardUuid) ||
                p.lanes.some(c => c?.uuid === cardUuid)
            ) || draft.players[draft.currentPlayerId];

            if (!action.payload.choice) {
                // Player chose NO
                if (effect === 'SAVE_PHOENIX') {
                    const targetIndex = effectOwner.lanes.findIndex(c => c?.uuid === cardUuid);
                    if (targetIndex !== -1) {
                         effectOwner.discard.push(effectOwner.lanes[targetIndex]!);
                         effectOwner.lanes[targetIndex] = null;
                         draft.message = `Phoenix was not saved and is destroyed.`;
                    }
                } else if (effect === 'AWAKENED_MAGIC') {
                    draft.message = `Awakened Magic was not used.`;
                } else if (effect === 'KARASU_TENGU_RETURN') {
                     draft.phase = GamePhase.End; // continue to end phase
                }
                draft.pendingAction = null;
                break;
            }

            // Player chose YES
            if (effect === 'SAVE_PHOENIX') {
                draft.currentPlayerId = effectOwner.id; 
                draft.pendingAction = { type: 'DISCARD_CARD', count: 1, reason: 'SAVE_PHOENIX', context: { phoenixUuid: cardUuid, ownerId: effectOwner.id } };
                draft.message = `${effectOwner.name}, choose a card to discard to save Phoenix.`;
            } else if (effect === 'AWAKENED_MAGIC') {
                const magicCard = effectOwner.magicZone.find(m => m.uuid === cardUuid);
                if (magicCard) magicCard.isFaceDown = true;
                
                const wallCardIndex = effectOwner.discard.findIndex(c => c.id === context.wallCard.id);
                if (wallCardIndex > -1) {
                    const [wallCard] = effectOwner.discard.splice(wallCardIndex, 1);
                    effectOwner.hand.push(wallCard);
                }
                
                draft.pendingAction = null;
                draft.message = `Used Awakened Magic to save ${context.wallCard.name}!`;
            } else if (effect === 'KARASU_TENGU_RETURN') {
                 const laneIndex = effectOwner.lanes.findIndex(c => c?.uuid === cardUuid);
                 if (laneIndex !== -1) {
                     const karasu = effectOwner.lanes[laneIndex]!;
                     effectOwner.hand.push(getCardById(karasu.id)!);
                     karasu.attachments.forEach(att => effectOwner.hand.push(getCardById(att.id)!));
                     effectOwner.lanes[laneIndex] = null;
                     draft.message = 'Karasu Tengu and its attachments returned to hand.';
                 }
                 draft.pendingAction = null;
                 draft.phase = GamePhase.End; // continue to end phase
            }

            break;
        }
    }
});


// --- MAIN COMPONENT ---

interface GameBoardProps {
    playerDecks: [Deck, Deck];
    gameMode: GameMode;
    onExit: () => void;
    startingPlayerId?: number;
}

export const GameBoard: React.FC<GameBoardProps> = ({ playerDecks, gameMode, onExit, startingPlayerId }) => {
    const [state, dispatch] = useReducer(gameReducer, createInitialState());
    const [animationState, setAnimationState] = useState<AnimationState>('entering');
    const { t } = useLocalization();
    const { layoutMode } = useLayout();
    useWindowSize();
    const [focusedCardModal, setFocusedCardModal] = useState<Card | InPlayCard | null>(null);
    const playerHandRef = useRef<HTMLDivElement>(null);

    const isMobileLayout = layoutMode === 'sp';
    const cardSize = isMobileLayout ? 'small' : 'normal';

    useEffect(() => {
        dispatch({ type: 'START_GAME', payload: { p1Deck: playerDecks[0], p2Deck: playerDecks[1], gameMode, startingPlayerId } });
        
        // Animation sequence
        const t1 = setTimeout(() => setAnimationState('visible'), 500); // Enter
        const t2 = setTimeout(() => setAnimationState('exiting'), 2000); // Hold
        const t3 = setTimeout(() => setAnimationState('hidden'), 2500); // Exit
        const t4 = setTimeout(() => {
            playerHandRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 600);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
        };
    }, [playerDecks, gameMode, startingPlayerId]);
    
    const { players, currentPlayerId, phase, message, selectedHandCardIndex, selectedLaneCardUuid, turn, gameMode: currentMode, pendingAction } = state;

    const getActivePlayerId = useCallback(() => {
        if (!pendingAction) return currentPlayerId;
        
        if (pendingAction.type === 'CHOOSE_EFFECT') {
            const cardUuid = pendingAction.cardUuid;
            const owner = players.find(p => 
                p.lanes.some(c => c?.uuid === cardUuid) || 
                p.magicZone.some(c => c.uuid === cardUuid)
            );
            return owner?.id ?? currentPlayerId;
        }
        if (pendingAction.type === 'DISCARD_CARD' && pendingAction.reason === 'SAVE_PHOENIX') {
            return pendingAction.context.ownerId;
        }
        
        return currentPlayerId;
    }, [players, currentPlayerId, pendingAction]);
    
    const activePlayerId = getActivePlayerId();

    // Auto-advance phases and handle CPU turns
    useEffect(() => {
        if (animationState !== 'hidden') return;

        const { phase, gameMode, pendingAction, currentPlayerId } = state;

        if (phase === GamePhase.GameOver) return;
        
        const isCpuActionRequired = gameMode === 'PvCPU' && activePlayerId === 1;

        // Handle CPU's turn or required response
        if (isCpuActionRequired) {
             const timer = setTimeout(() => {
                const cpuAction = getCpuAction(state);
                if (cpuAction) {
                    dispatch(cpuAction);
                } else if (!pendingAction && currentPlayerId === 1) {
                    // If CPU has no specific action (e.g., in Upkeep) or has finished its Main Phase actions,
                    // and is not responding to a prompt, advance to the next phase.
                    dispatch({ type: 'NEXT_PHASE' });
                }
            }, 1500);
            return () => clearTimeout(timer);
        }

        // Auto-advance phases for the human player if there's no pending action
        if (!isCpuActionRequired && !pendingAction) {
            if (phase === GamePhase.Upkeep || phase === GamePhase.Draw || phase === GamePhase.Set) {
                const timer = setTimeout(() => {
                    dispatch({ type: 'NEXT_PHASE' });
                }, 1200);
                return () => clearTimeout(timer);
            }
            if (phase === GamePhase.End) {
                 const timer = setTimeout(() => {
                    dispatch({ type: 'NEXT_PHASE' });
                }, 1800);
                return () => clearTimeout(timer);
            }
        }
    }, [state, activePlayerId, animationState]);

    const isInputDisabled = (currentMode === 'PvCPU' && currentPlayerId === 1) && (!pendingAction || activePlayerId !== 0);

    const handleNextPhase = useCallback(() => {
        if(isInputDisabled || phase !== GamePhase.Main || pendingAction) return;
        dispatch({ type: 'NEXT_PHASE' });
    }, [isInputDisabled, phase, pendingAction]);

    const handleSelectHandCard = useCallback((cardIndex: number, playerId: number) => {
        if (isInputDisabled && !pendingAction) return;
        if (playerId !== activePlayerId) return;

        if (pendingAction?.type === 'DISCARD_CARD') {
            dispatch({ type: 'DISCARD_CARD', payload: { cardIndex } });
            return;
        }

        dispatch({ type: 'SELECT_HAND_CARD', payload: { cardIndex } });
    }, [isInputDisabled, activePlayerId, pendingAction]);

    const handleLaneClick = useCallback((laneIndex: number, playerId: number) => {
        if (isInputDisabled || playerId !== currentPlayerId || phase !== GamePhase.Main || selectedHandCardIndex === null || pendingAction) return;
        
        const card = players[currentPlayerId].hand[selectedHandCardIndex];
        if (!card) return;

        // Allow playing monsters or non-targeted spells onto a lane.
        if (card.type === CardType.Monster || card.type === CardType.Spell) {
            dispatch({ type: 'PLAY_CARD', payload: { laneIndex } });
        }
    }, [isInputDisabled, currentPlayerId, phase, selectedHandCardIndex, pendingAction, players]);
    
    const handleMonsterClick = useCallback((uuid: string) => {
        if (isInputDisabled && !pendingAction?.type?.startsWith('SELECT')) return;

        if (pendingAction?.type === 'SELECT_TARGET' && pendingAction.validTargetUuids.includes(uuid)) {
            dispatch({ type: 'CHOOSE_TARGET', payload: { targetUuid: uuid } });
            return;
        }
        if (pendingAction) return;

        const activePlayer = players[currentPlayerId];
        const passivePlayer = players[(currentPlayerId + 1) % 2];
        const selectedCardInHand = selectedHandCardIndex !== null ? activePlayer.hand[selectedHandCardIndex] : null;

        if (selectedCardInHand?.type === CardType.Attachment && activePlayer.lanes.some(c => c?.uuid === uuid)) {
            dispatch({ type: 'PLAY_CARD', payload: { targetUuid: uuid } });
            return;
        }

        if (activePlayer.lanes.some(c => c?.uuid === uuid)) {
            if (phase === GamePhase.Main) {
                dispatch({ type: 'SELECT_LANE_CARD', payload: { uuid } });
            }
        }
        else if (passivePlayer.lanes.some(c => c?.uuid === uuid) && selectedLaneCardUuid) {
             dispatch({ type: 'DECLARE_ATTACK', payload: { targetUuid: uuid, targetLane: null }});
        }
    }, [isInputDisabled, currentPlayerId, players, phase, turn, selectedLaneCardUuid, selectedHandCardIndex, pendingAction]);
    
    const handlePlayerAttack = useCallback(() => {
        if(isInputDisabled || !selectedLaneCardUuid || pendingAction) return;
        dispatch({ type: 'DECLARE_ATTACK', payload: { targetUuid: 'player', targetLane: null }});
    }, [isInputDisabled, selectedLaneCardUuid, pendingAction]);

    const handleChoice = useCallback((choice: boolean) => {
        if(isInputDisabled || !pendingAction) return;
        dispatch({ type: 'RESPOND_TO_CHOICE', payload: { choice }})
    }, [isInputDisabled, pendingAction]);

    const getGuidanceText = () => {
        const aPlayer = t('player_x', { player: players[currentPlayerId].name });
        const cpuPlayer = t('player_x', { player: players[1].name });
        const playerName = (gameMode === 'PvCPU' && currentPlayerId === 1) ? cpuPlayer : aPlayer;

        if (pendingAction) {
            const pendingPlayerName = t('player_x', { player: players[activePlayerId].name });
            switch(pendingAction.type) {
                case 'DISCARD_CARD': return t('guidance_discard', { player: pendingPlayerName });
                case 'SELECT_TARGET': return t('guidance_select_target');
                case 'CHOOSE_EFFECT': {
                     if (pendingAction.effect === 'AWAKENED_MAGIC') {
                        const recoveredCard = pendingAction.context.wallCard;
                        return t('guidance_choose_effect_awaken', { player: pendingPlayerName, cardName: recoveredCard.name });
                    }
                    const card = players.flatMap(p => [...p.lanes, ...p.magicZone]).find(c => c && 'uuid' in c && c.uuid === pendingAction.cardUuid);
                    return t('guidance_choose_effect', { player: pendingPlayerName, cardName: card?.name ?? 'effect' });
                }
            }
        }
        
        if (gameMode === 'PvCPU' && currentPlayerId === 1 && phase !== GamePhase.GameOver) {
            return t('thinking') + ` (${phase})`;
        }
        
        switch (phase) {
            case GamePhase.Upkeep: return t('upkeep_phase', { player: playerName });
            case GamePhase.Draw: return t('draw_phase', { player: playerName });
            case GamePhase.Set: return t('set_phase', { player: playerName });
            case GamePhase.End: return t('end_phase', { player: playerName });
            case GamePhase.GameOver: return message;
            case GamePhase.Main:
                if (turn === 1 && currentPlayerId === state.startingPlayerId) {
                    return t('main_phase_first_turn_player');
                }
                if (selectedHandCardIndex !== null) {
                    const card = state.players[currentPlayerId].hand[selectedHandCardIndex];
                    if (card?.type === CardType.Attachment) return t('attachment_selected');
                    if (card?.type === CardType.Spell) return t('spell_selected');
                    return t('card_selected_lane');
                }
                if (selectedLaneCardUuid !== null) {
                    const attacker = state.players[currentPlayerId].lanes.find(c=>c?.uuid === selectedLaneCardUuid);
                    if(attacker?.isTapped) return t('monster_selected_tapped');
                    if(attacker?.text.includes('【ひるむ】')) return t('monster_selected_wimpy');
                    return t('monster_selected_attack');
                }
                return t('main_phase_generic', { player: playerName });
            default: return message;
        }
    }

    const me = players[0];
    const opponent = players[1];
    
    const activePlayer = players[currentPlayerId];
    const passivePlayer = players[(currentPlayerId + 1) % 2];

    const getSelectedCard = () => {
        const allCards = [...me.hand, ...me.lanes, ...opponent.lanes, ...me.discard, ...opponent.discard].filter(Boolean) as (Card | InPlayCard)[];
        if (selectedHandCardIndex !== null && players[activePlayerId].hand[selectedHandCardIndex]) {
            return players[activePlayerId].hand[selectedHandCardIndex];
        }
        if (selectedLaneCardUuid !== null) {
            return allCards.find(c => c && 'uuid' in c && c.uuid === selectedLaneCardUuid) || null;
        }
        return null;
    }
    const focusedCardSidebar = !isMobileLayout ? getSelectedCard() : null;
    
    const showFocusedCard = () => {
        const card = getSelectedCard();
        if (card) {
            setFocusedCardModal(card);
        }
    };
    
    const selectedCardInHand = selectedHandCardIndex !== null ? activePlayer.hand[selectedHandCardIndex] : null;

    let playableLaneIndices: number[] = [];
    if (phase === GamePhase.Main && selectedCardInHand && currentPlayerId === activePlayerId) {
        if (selectedCardInHand.type === CardType.Monster) {
            if (selectedCardInHand.text.includes('【大怪魔】')) {
                const centerLane = activePlayer.lanes[1];
                if (!centerLane || !centerLane.isTapped) {
                    playableLaneIndices = [1];
                }
            } else {
                playableLaneIndices = [0, 1, 2].filter(i => {
                    const monsterInLane = activePlayer.lanes[i];
                    return !monsterInLane || !monsterInLane.isTapped;
                });
            }
        } else if (selectedCardInHand.type === CardType.Spell) {
            playableLaneIndices = [0, 1, 2];
        }
    }

    const attackableMonsterUuids = phase === GamePhase.Main && selectedLaneCardUuid !== null && !activePlayer.lanes.find(c=>c?.uuid===selectedLaneCardUuid)?.isTapped ? passivePlayer.lanes.filter(c => c !== null).map(c => c!.uuid) : [];
    const attachableMonsterUuids = phase === GamePhase.Main && selectedCardInHand?.type === CardType.Attachment ? activePlayer.lanes.filter(c => c !== null).map(c => c!.uuid) : [];
    const targetableUuids = pendingAction?.type === 'SELECT_TARGET' ? pendingAction.validTargetUuids : [];
    const selectedAttacker = activePlayer.lanes.find(c => c?.uuid === selectedLaneCardUuid);
    const opponentHasDaikaima = passivePlayer.lanes[1]?.text.includes('【大怪魔】');
    const attackerInSideLane = selectedAttacker ? activePlayer.lanes.findIndex(c => c?.uuid === selectedAttacker.uuid) !== 1 : false;

    const canAttackPlayer = phase === GamePhase.Main && selectedLaneCardUuid !== null && turn > 1 && !!selectedAttacker && !selectedAttacker.isTapped && !selectedAttacker.text.includes('【ひるむ】') && !(opponentHasDaikaima && attackerInSideLane);
    const canShowDetails = selectedHandCardIndex !== null || selectedLaneCardUuid !== null;
    const canPlayerRespond = pendingAction?.type === 'CHOOSE_EFFECT' && (currentMode === 'PvP' || activePlayerId === 0);

    const ActionFooter = () => (
        <div className="w-full bg-slate-800 p-2 border-t-2 border-yellow-500/50 flex justify-around items-center gap-2 z-10">
            {isMobileLayout ? (
                <>
                    <button onClick={showFocusedCard} disabled={!canShowDetails} className="bg-blue-600 hover:bg-blue-700 font-bold py-2 px-3 rounded disabled:bg-slate-600 disabled:cursor-not-allowed text-sm">{t('show_details_button')}</button>
                    {canPlayerRespond ? (
                        <div className="flex gap-2">
                            <button onClick={() => handleChoice(true)} className="bg-green-600 hover:bg-green-700 font-bold py-2 px-4 rounded">{t('yes')}</button>
                            <button onClick={() => handleChoice(false)} className="bg-red-600 hover:bg-red-700 font-bold py-2 px-4 rounded">{t('no')}</button>
                        </div>
                    ) : (
                        <button onClick={handlePlayerAttack} className={`px-3 py-2 text-sm rounded transition-all ${canAttackPlayer ? 'bg-red-600 hover:bg-red-700 ring-2 ring-red-400' : 'bg-red-800/50 cursor-not-allowed'}`} disabled={isInputDisabled || !canAttackPlayer}>
                            {t('attack_player')}
                        </button>
                    )}
                    {phase === GamePhase.Main && <button onClick={handleNextPhase} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-3 text-sm rounded disabled:bg-slate-600 disabled:cursor-not-allowed" disabled={isInputDisabled || !!pendingAction}>{t('end_main_phase')}</button>}
                    {phase === GamePhase.GameOver && <button onClick={onExit} className="bg-blue-600 hover:bg-blue-700 font-bold py-2 px-4 rounded">{t('new_game')}</button>}
                </>
            ) : (
                <>
                    <div className="w-1/4 text-left">
                        <button onClick={onExit} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors text-sm">{t('end_game')}</button>
                    </div>
                    <div className="w-1/2 flex justify-center gap-4">
                        {canPlayerRespond ? (
                             <div className="flex gap-2">
                                <button onClick={() => handleChoice(true)} className="bg-green-600 hover:bg-green-700 font-bold py-2 px-4 rounded">{t('yes')}</button>
                                <button onClick={() => handleChoice(false)} className="bg-red-600 hover:bg-red-700 font-bold py-2 px-4 rounded">{t('no')}</button>
                            </div>
                        ) : (
                        <button onClick={handlePlayerAttack} className={`px-4 py-2 text-lg rounded transition-all ${canAttackPlayer ? 'bg-red-600 hover:bg-red-700 ring-2 ring-red-400' : 'bg-red-800/50 cursor-not-allowed'}`} disabled={isInputDisabled || !canAttackPlayer}>
                            {t('attack_player')}
                        </button>
                        )}
                    </div>
                    <div className="w-1/4 text-right">
                        {phase === GamePhase.Main && <button onClick={handleNextPhase} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 text-lg rounded disabled:bg-slate-600 disabled:cursor-not-allowed" disabled={isInputDisabled || !!pendingAction}>{t('end_main_phase')}</button>}
                        {phase === GamePhase.GameOver && <button onClick={onExit} className="bg-blue-600 hover:bg-blue-700 font-bold py-2 px-4 rounded text-lg">{t('new_game')}</button>}
                    </div>
                </>
            )}
        </div>
    );
    
    const animationClasses: Record<AnimationState, string> = {
        entering: 'opacity-0 scale-125',
        visible: 'opacity-100 scale-100',
        exiting: 'opacity-0 scale-90',
        hidden: 'hidden',
    };


    if (isMobileLayout) {
      // SP Mode Layout
      return (
        <div className="flex flex-col h-screen bg-slate-900 p-1">
            {animationState !== 'hidden' && (
                <div className={`absolute inset-0 bg-black/80 flex items-center justify-center z-[100] transition-all duration-500 ease-in-out ${animationClasses[animationState]}`}>
                    <h1 className="text-6xl md:text-8xl text-white font-bold" style={{ fontFamily: "'Noto Serif JP', serif", textShadow: '0 0 10px #fff, 0 0 20px #ffc800' }}>
                        千戯開戦!!
                    </h1>
                </div>
            )}
            {focusedCardModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={() => setFocusedCardModal(null)}>
                    <div onClick={(e) => e.stopPropagation()} className="relative">
                        <FocusedCardView card={focusedCardModal} onClose={() => setFocusedCardModal(null)} />
                    </div>
                </div>
            )}
            <GuidanceDisplay text={getGuidanceText()} />
            <div className="flex-grow overflow-y-auto">
                <div className="bg-blue-900/20 rounded-lg p-1 my-1">
                    <div className="flex justify-center items-end h-44 lg:h-56 bg-black/30 p-2 rounded-b-lg min-h-[11rem] lg:min-h-[14rem]">
                        {opponent.hand.map((card, index) => (
                            <div key={index} className="-mx-4 lg:-mx-6">
                                    {currentMode === 'PvP' ? (
                                    <CardView
                                        card={card}
                                        isSelected={currentPlayerId === 1 && selectedHandCardIndex === index}
                                        onClick={() => handleSelectHandCard(index, 1)}
                                        size={cardSize}
                                    />
                                    ) : (
                                    <CardBack type="main" count={opponent.hand.length} size={cardSize} />
                                    )}
                            </div>
                        ))}
                    </div>

                    <PlayerField 
                        player={opponent} 
                        isCurrentPlayer={currentPlayerId === 1}
                        isTopPlayer={true} 
                        onLaneClick={(laneIndex) => handleLaneClick(laneIndex, 1)} 
                        onMonsterClick={handleMonsterClick}
                        selectedLaneCardUuid={selectedLaneCardUuid}
                        playableLaneIndices={currentPlayerId === 1 ? playableLaneIndices : []}
                        attackableMonsterUuids={attackableMonsterUuids}
                        attachableMonsterUuids={currentPlayerId === 1 ? attachableMonsterUuids : []}
                        targetableUuids={targetableUuids}
                        size={cardSize}
                    />
                </div>
                
                <div className="my-2 border-b-2 border-yellow-500/30"></div>
                
                <div className="bg-red-900/20 rounded-lg p-1 my-1">
                    <PlayerField 
                        player={me} 
                        isCurrentPlayer={currentPlayerId === 0}
                        isTopPlayer={false}
                        onLaneClick={(laneIndex) => handleLaneClick(laneIndex, 0)}
                        onMonsterClick={handleMonsterClick}
                        selectedLaneCardUuid={selectedLaneCardUuid}
                        playableLaneIndices={currentPlayerId === 0 ? playableLaneIndices : []}
                        attackableMonsterUuids={[]}
                        attachableMonsterUuids={currentPlayerId === 0 ? attachableMonsterUuids : []}
                        targetableUuids={targetableUuids}
                        size={cardSize}
                    />
                    <div ref={playerHandRef}>
                        <PlayerHand 
                            hand={me.hand} 
                            onCardClick={(index) => handleSelectHandCard(index, 0)}
                            selectedIndex={selectedHandCardIndex}
                            inputDisabled={isInputDisabled && !pendingAction}
                            isCurrentPlayer={currentPlayerId === 0}
                            pendingAction={pendingAction}
                            size={cardSize}
                        />
                    </div>
                </div>
            </div>
            <ActionFooter />
        </div>
    );
    }

    // PC Mode Layout
    return (
        <div className="flex flex-col h-screen bg-slate-900">
            {animationState !== 'hidden' && (
                <div className={`absolute inset-0 bg-black/80 flex items-center justify-center z-[100] transition-all duration-500 ease-in-out ${animationClasses[animationState]}`}>
                    <h1 className="text-6xl md:text-8xl text-white font-bold" style={{ fontFamily: "'Noto Serif JP', serif", textShadow: '0 0 10px #fff, 0 0 20px #ffc800' }}>
                        千戯開戦!!
                    </h1>
                </div>
            )}
            <GuidanceDisplay text={getGuidanceText()} />
            <div className="flex flex-row flex-grow overflow-hidden">
                <div className="flex-grow flex flex-col p-2 overflow-y-auto">
                    {/* Opponent Area */}
                    <div className="flex-grow flex flex-col-reverse bg-blue-900/20 rounded-lg p-2 my-1 min-h-[450px]">
                         <PlayerField 
                            player={opponent} 
                            isCurrentPlayer={currentPlayerId === 1}
                            isTopPlayer={true}
                            onLaneClick={(laneIndex) => handleLaneClick(laneIndex, 1)} 
                            onMonsterClick={handleMonsterClick}
                            selectedLaneCardUuid={selectedLaneCardUuid}
                            playableLaneIndices={currentPlayerId === 1 ? playableLaneIndices : []}
                            attackableMonsterUuids={attackableMonsterUuids}
                            attachableMonsterUuids={currentPlayerId === 1 ? attachableMonsterUuids : []}
                            targetableUuids={targetableUuids}
                            size={cardSize}
                        />
                        <div className="flex justify-center items-end h-44 lg:h-56 bg-black/30 p-2 rounded-b-lg min-h-[11rem] lg:min-h-[14rem]">
                            {opponent.hand.map((card, index) => (
                                <div key={index} className="-mx-4 lg:-mx-6">
                                    {currentMode === 'PvP' ? (
                                        <CardView
                                            card={card}
                                            isSelected={currentPlayerId === 1 && selectedHandCardIndex === index}
                                            onClick={() => handleSelectHandCard(index, 1)}
                                            size={cardSize}
                                        />
                                    ) : (
                                        <CardBack type="main" count={opponent.hand.length} size={cardSize} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* My Area */}
                    <div className="flex-grow flex flex-col bg-red-900/20 rounded-lg p-2 my-1 min-h-[450px]">
                        <PlayerField 
                            player={me} 
                            isCurrentPlayer={currentPlayerId === 0}
                            isTopPlayer={false}
                            onLaneClick={(laneIndex) => handleLaneClick(laneIndex, 0)}
                            onMonsterClick={handleMonsterClick}
                            selectedLaneCardUuid={selectedLaneCardUuid}
                            playableLaneIndices={currentPlayerId === 0 ? playableLaneIndices : []}
                            attackableMonsterUuids={[]}
                            attachableMonsterUuids={currentPlayerId === 0 ? attachableMonsterUuids : []}
                            targetableUuids={targetableUuids}
                            size={cardSize}
                        />
                        <div ref={playerHandRef}>
                            <PlayerHand 
                                hand={me.hand} 
                                onCardClick={(index) => handleSelectHandCard(index, 0)}
                                selectedIndex={selectedHandCardIndex}
                                inputDisabled={isInputDisabled && !pendingAction}
                                isCurrentPlayer={currentPlayerId === 0}
                                pendingAction={pendingAction}
                                size={cardSize}
                            />
                        </div>
                    </div>
                </div>

                {/* Focused Card */}
                <FocusedCardView card={focusedCardSidebar} />
            </div>
            <ActionFooter />
        </div>
    );
};
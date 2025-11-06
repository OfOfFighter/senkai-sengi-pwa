// FIX: Replaced component code with actual type definitions to resolve circular dependencies and type errors.
// FIX: Converted enums to const objects and type aliases to resolve TS1294 build errors.
export const CardColor = {
    Red: 'Red',
    Green: 'Green',
    Blue: 'Blue',
    Colorless: 'Colorless',
} as const;
export type CardColor = typeof CardColor[keyof typeof CardColor];

export const CardType = {
    Monster: 'Monster',
    Spell: 'Spell',
    Attachment: 'Attachment',
    Magic: 'Magic',
} as const;
export type CardType = typeof CardType[keyof typeof CardType];

export const Rarity = {
    SR: 'SR', // Super Rare
    R: 'R',   // Rare
    N: 'N',   // Normal
} as const;
export type Rarity = typeof Rarity[keyof typeof Rarity];

export interface Card {
    id: string;
    name: string;
    type: CardType;
    color: CardColor;
    cost: number;
    rarity: Rarity;
    ap?: number;
    hp?: number;
    apModifier?: number;
    hpModifier?: number;
    text: string;
    imageUrl: string;
}

export interface InPlayCard extends Card {
    uuid: string;
    isTapped: boolean;
    damage: number;
    attachments: InPlayCard[];
    tempApModifier?: number;
    isFaceDown?: boolean;
}

export interface Deck {
    name: string;
    mainDeck: string[]; // array of card IDs
    magicDeck: string[]; // array of card IDs
}

export interface PlayerState {
    id: number;
    name: string;
    mainDeck: Card[];
    magicDeck: Card[];
    hand: Card[];
    discard: Card[];
    magicZone: InPlayCard[];
    lanes: (InPlayCard | null)[];
    walls: Card[];
    hasWon: boolean;
}

export const GamePhase = {
    Setup: 'Setup',
    Upkeep: 'Upkeep',
    Draw: 'Draw',
    Set: 'Set',
    Main: 'Main',
    End: 'End',
    GameOver: 'GameOver',
} as const;
export type GamePhase = typeof GamePhase[keyof typeof GamePhase];

export type GameMode = 'PvP' | 'PvCPU';

export interface GameState {
    players: [PlayerState, PlayerState];
    currentPlayerId: number;
    phase: GamePhase;
    turn: number;
    message: string;
    selectedHandCardIndex: number | null;
    selectedLaneCardUuid: string | null;
    attackers: { [attackerUuid: string]: string };
    gameMode: GameMode;
    startingPlayerId: number;
    pendingAction: PendingAction | null;
}

export type PendingAction = 
    | { type: 'DISCARD_CARD', count: number, reason: string, context?: any }
    | { type: 'SELECT_TARGET', effect: 'DEAL_DAMAGE' | 'RETURN_TO_HAND', sourceCardId: string, validTargetUuids: string[], damage?: number }
    | { type: 'CHOOSE_EFFECT', effect: 'SAVE_PHOENIX' | 'AWAKENED_MAGIC' | 'KARASU_TENGU_RETURN', cardUuid: string, context?: any };

export type GameAction =
    | { type: 'START_GAME', payload: { p1Deck: Deck, p2Deck: Deck, gameMode: GameMode, startingPlayerId?: number } }
    | { type: 'NEXT_PHASE' }
    | { type: 'SELECT_HAND_CARD', payload: { cardIndex: number } }
    | { type: 'SELECT_LANE_CARD', payload: { uuid: string } }
    | { type: 'DISCARD_CARD', payload: { cardIndex: number } }
    | { type: 'PLAY_CARD', payload: { laneIndex?: number, targetUuid?: string } }
    | { type: 'ATTACH_CARD', payload: { targetUuid: string } }
    | { type: 'DECLARE_ATTACK', payload: { targetUuid: string, targetLane: number | null } }
    | { type: 'CHOOSE_TARGET', payload: { targetUuid: string } }
    | { type: 'RESPOND_TO_CHOICE', payload: { choice: boolean } };
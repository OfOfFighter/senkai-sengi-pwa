import type { GameState, GameAction } from '../types';
// Fix: Added missing import for CardColor to resolve 'Cannot find name' error.
// FIX: Added CardColor to the import.
import { CardType, CardColor, GamePhase } from '../types';

/**
 * Determines the next action for the CPU to take based on the current game state.
 */
export const getCpuAction = (gameState: GameState): GameAction | null => {
    const cpuId = 1;
    const opponentId = 0;
    const cpuState = gameState.players[cpuId];
    const opponentState = gameState.players[opponentId];

    // --- Handle Pending Actions First ---
    if (gameState.pendingAction) {
        switch (gameState.pendingAction.type) {
            case 'DISCARD_CARD':
                // Discard the lowest cost card
                let lowestCost = 99;
                let cardToDiscardIndex = 0;
                cpuState.hand.forEach((card, index) => {
                    if (card.cost < lowestCost) {
                        lowestCost = card.cost;
                        cardToDiscardIndex = index;
                    }
                });
                return { type: 'DISCARD_CARD', payload: { cardIndex: cardToDiscardIndex }};
            
            // Fix: Use a local constant for the pending action to ensure correct type narrowing within the forEach closure.
            case 'SELECT_TARGET': {
                // FIX: Use a local constant for the pending action to ensure correct type narrowing.
                const pendingAction = gameState.pendingAction;
                // Target the monster with the highest AP
                let bestTargetUuid: string | null = null;
                let maxAp = -1;
                opponentState.lanes.forEach(monster => {
                    if (monster && pendingAction.validTargetUuids.includes(monster.uuid)) {
                        if ((monster.ap || 0) > maxAp) {
                            maxAp = monster.ap || 0;
                            bestTargetUuid = monster.uuid;
                        }
                    }
                });
                if (bestTargetUuid) {
                    return { type: 'CHOOSE_TARGET', payload: { targetUuid: bestTargetUuid }};
                }
                // Fallback: target the first valid one if no AP found
                return { type: 'CHOOSE_TARGET', payload: { targetUuid: pendingAction.validTargetUuids[0] }};
            }

            case 'CHOOSE_EFFECT':
                // Simple logic: always say "yes" to optional effects
                return { type: 'RESPOND_TO_CHOICE', payload: { choice: true }};
        }
    }
    
    // Only perform main actions during the Main Phase
    if (gameState.phase !== GamePhase.Main) {
        return null;
    }


    // --- Action Execution Phase ---
    // If a CPU lane card is selected, it's for an attack.
    if (gameState.selectedLaneCardUuid) {
        const attacker = cpuState.lanes.find(c => c?.uuid === gameState.selectedLaneCardUuid);
        if (attacker) {
            // Find best monster target (highest AP)
            let bestTarget: { uuid: string, ap: number, lane: number } | null = null;
            for (const [index, monster] of opponentState.lanes.entries()) {
                if (monster) {
                    if (!bestTarget || (monster.ap || 0) > bestTarget.ap) {
                        bestTarget = { uuid: monster.uuid, ap: monster.ap || 0, lane: index };
                    }
                }
            }

            if (bestTarget) {
                 return { type: 'DECLARE_ATTACK', payload: { targetUuid: bestTarget.uuid, targetLane: bestTarget.lane } };
            }

            // If no monster, check if can attack player
            const opponentHasDaikaima = opponentState.lanes[1]?.text.includes('【大怪魔】');
            const attackerLaneIndex = cpuState.lanes.findIndex(c => c?.uuid === attacker.uuid);
            const canAttackPlayer = !attacker.text.includes('【ひるむ】') && !(opponentHasDaikaima && attackerLaneIndex !== 1);

            if (canAttackPlayer && gameState.turn > 1) {
                 return { type: 'DECLARE_ATTACK', payload: { targetUuid: 'player', targetLane: null } };
            }
            
            // No valid targets for this attacker. Deselect it to avoid getting stuck.
            return { type: 'SELECT_LANE_CARD', payload: { uuid: attacker.uuid } };
        }
    }

    // If a CPU hand card is selected, play it.
    if (gameState.selectedHandCardIndex !== null) {
        const cardToPlay = cpuState.hand[gameState.selectedHandCardIndex];
        if (cardToPlay) {
            if (cardToPlay.type === CardType.Monster) {
                if (cardToPlay.text.includes('【大怪魔】')) {
                    if (cpuState.lanes[1] === null) return { type: 'PLAY_CARD', payload: { laneIndex: 1 } };
                } else {
                    const emptyLaneIndex = cpuState.lanes.findIndex(l => l === null);
                    if (emptyLaneIndex !== -1) return { type: 'PLAY_CARD', payload: { laneIndex: emptyLaneIndex } };
                }
            } else if (cardToPlay.type === CardType.Spell) {
                // Spells are played to lane 0 by convention, it doesn't matter
                return { type: 'PLAY_CARD', payload: { laneIndex: 0 }};
            }
        }
        // If we can't play the selected card, deselect it.
        return { type: 'SELECT_HAND_CARD', payload: { cardIndex: gameState.selectedHandCardIndex } };
    }


    // --- Action Selection Phase ---
    const availableMana = cpuState.magicZone.filter(m => !m.isTapped && !m.isFaceDown);
    const canAfford = (cost: number, color: CardColor) => {
        if (availableMana.length < cost) return false;
        if (cost > 0 && color !== CardColor.Colorless) return availableMana.some(m => m.color === color);
        return true;
    }

    // 1. Try to play a spell card.
    for (let i = 0; i < cpuState.hand.length; i++) {
        const card = cpuState.hand[i];
        if (card.type === CardType.Spell && canAfford(card.cost, card.color)) {
            return { type: 'SELECT_HAND_CARD', payload: { cardIndex: i }};
        }
    }
    
    // 2. Try to play a monster card.
    let bestMonsterIndex = -1;
    let maxCost = -1;
    for (let i = 0; i < cpuState.hand.length; i++) {
        const card = cpuState.hand[i];
        if (card.type === CardType.Monster && card.cost > maxCost && canAfford(card.cost, card.color)) {
            if (card.text.includes('【大怪魔】')) {
                if (cpuState.lanes[1] === null) {
                    bestMonsterIndex = i;
                    maxCost = card.cost;
                }
            } else {
                 if (cpuState.lanes.some(l => l === null)) {
                    bestMonsterIndex = i;
                    maxCost = card.cost;
                }
            }
        }
    }

    if (bestMonsterIndex !== -1) {
         return { type: 'SELECT_HAND_CARD', payload: { cardIndex: bestMonsterIndex } };
    }
    
    // 3. Try to find a monster to attack with.
    let bestAttackerUuid: string | null = null;
    let maxAp = -1;
    const opponentHasDaikaima = opponentState.lanes[1]?.text.includes('【大怪魔】');
    const hasMonsterTarget = opponentState.lanes.some(m => m !== null);

    for (const monster of cpuState.lanes) {
        if (monster && !monster.isTapped) {
            const monsterLaneIndex = cpuState.lanes.findIndex(c => c?.uuid === monster.uuid);
            const canAttackPlayer = !monster.text.includes('【ひるむ】') && !(opponentHasDaikaima && monsterLaneIndex !== 1);

            if (hasMonsterTarget || (canAttackPlayer && gameState.turn > 1)) {
                if ((monster.ap ?? 0) > maxAp) {
                    bestAttackerUuid = monster.uuid;
                    maxAp = monster.ap ?? 0;
                }
            }
        }
    }

    if (bestAttackerUuid) {
        return { type: 'SELECT_LANE_CARD', payload: { uuid: bestAttackerUuid } };
    }


    // 4. If no other actions are possible, return null to end the turn.
    return null;
}
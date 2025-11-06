
import React from 'react';
import type { Card, InPlayCard } from '../types';
import { CardColor, CardType } from '../types';
import { useLocalization } from '../contexts/LocalizationContext';

interface CardViewProps {
  card: Card | InPlayCard;
  isSelected?: boolean;
  isTapped?: boolean;
  damage?: number;
  onClick?: () => void;
  className?: string;
  isAttackableTarget?: boolean;
  isAttachableTarget?: boolean;
  totalAp?: number;
  totalHp?: number;
  size?: 'normal' | 'small';
}

const colorStyles: { [key in CardColor]: { bg: string; border: string } } = {
  [CardColor.Red]: { bg: 'bg-red-900/50', border: 'border-red-500' },
  [CardColor.Green]: { bg: 'bg-green-900/50', border: 'border-green-500' },
  [CardColor.Blue]: { bg: 'bg-blue-900/50', border: 'border-blue-500' },
  [CardColor.Colorless]: { bg: 'bg-gray-700/50', border: 'border-gray-400' },
};

export const CardView: React.FC<CardViewProps> = ({ card, isSelected, isTapped, damage, onClick, className, isAttackableTarget, isAttachableTarget, totalAp, totalHp, size = 'normal' }) => {
  const styles = colorStyles[card.color] || colorStyles.Colorless;

  const sizeConfig = {
    normal: {
      container: 'w-36 h-52 p-2',
      nameText: 'text-sm',
      costBubble: 'w-6 h-6',
      statsText: 'text-sm',
      damageBubble: 'w-8 h-8 text-lg',
      typeText: 'text-xs',
    },
    small: {
      container: 'w-28 h-40 p-1',
      nameText: 'text-xs',
      costBubble: 'w-5 h-5',
      statsText: 'text-xs',
      damageBubble: 'w-7 h-7 text-base',
      typeText: 'text-[10px]',
    },
  };

  const s = sizeConfig[size];

  const cardClasses = `
    ${s.container} rounded-lg flex flex-col justify-between text-white shadow-lg
    border-2 ${styles.border} ${styles.bg} backdrop-blur-sm
    transform transition-all duration-300 relative
    ${isSelected ? 'scale-110 ring-4 ring-yellow-400 z-20' : 'hover:scale-105'}
    ${isAttackableTarget ? 'ring-4 ring-red-500 shadow-red-500/50' : ''}
    ${isAttachableTarget ? 'ring-4 ring-cyan-400 shadow-cyan-400/50' : ''}
    ${isTapped ? 'rotate-90' : ''}
    ${onClick ? 'cursor-pointer' : ''}
    ${className || ''}
  `;

  const finalAp = totalAp ?? card.ap;
  const apIsBoosted = typeof finalAp === 'number' && typeof card.ap === 'number' && finalAp > card.ap;
  const finalHp = totalHp ?? card.hp;
  const hpIsBoosted = typeof finalHp === 'number' && typeof card.hp === 'number' && finalHp > card.hp;


  return (
    <div className={cardClasses} onClick={onClick}>
      <div className={`flex justify-between items-start ${s.nameText}`}>
        <span className="font-bold truncate" title={card.name}>{card.name}</span>
        <span className={`${s.costBubble} flex items-center justify-center rounded-full font-bold text-black bg-yellow-300 border-2 border-white`}>
          {card.cost}
        </span>
      </div>
      
      <div className="flex-grow flex items-center justify-center my-1">
        <img src={card.imageUrl} alt={card.name} className="max-w-full max-h-full object-contain rounded-md" />
      </div>

      {card.type === CardType.Monster && 'ap' in card && 'hp' in card && (
        <div className={`flex justify-between items-end ${s.statsText} font-bold`}>
          <span className={`bg-orange-600 px-2 py-1 rounded text-white ${apIsBoosted ? 'text-green-300' : ''}`}>
            {finalAp}
          </span>
           {damage && damage > 0 && (
             <span className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600/80 text-white rounded-full ${s.damageBubble} flex items-center justify-center font-bold border-2 border-white`}>
               {damage}
             </span>
           )}
          <span className={`bg-green-600 px-2 py-1 rounded text-white ${hpIsBoosted ? 'text-green-300' : ''}`}>
            {finalHp}
          </span>
        </div>
      )}
       {card.type === CardType.Attachment && (
         <div className={`${s.typeText} text-center p-1 bg-black/30 rounded-md`}>
            {card.apModifier !== 0 && `AP+${card.apModifier} `}
            {card.hpModifier !== 0 && `HP+${card.hpModifier}`}
        </div>
       )}

      {card.type !== CardType.Monster && card.type !== CardType.Attachment && (
        <div className={`${s.typeText} text-center p-1 bg-black/30 rounded-md`}>
            {card.type}
        </div>
      )}
    </div>
  );
};

export const CardBack: React.FC<{ type: 'main' | 'magic', count: number, className?: string, size?: 'normal' | 'small' }> = ({ type, count, className, size = 'normal' }) => {
  const { t } = useLocalization();
  const color = type === 'main' ? 'border-yellow-500' : 'border-purple-500';
  const label = type === 'main' ? t('deck') : t('magic');

  const sizeClasses = size === 'small' ? 'w-28 h-40' : 'w-36 h-52';

  return (
    <div className={`${sizeClasses} rounded-lg p-2 flex flex-col justify-between items-center text-white shadow-lg border-2 ${color} bg-slate-800 relative ${className || ''}`}>
        <h4 className="font-bold text-lg">{label}</h4>
        <div className="flex-grow flex items-center justify-center">
            <span className="text-6xl font-bold text-slate-400/50 select-none">{count}</span>
        </div>
        <div className="h-4"></div>
    </div>
  );
};

import { GameStatus } from './game.js';
import { CardGameCore, CardGameUI, SPACING_SMALL, SPACING_MEDIUM, SPACING_BIG } from './cards.js';


class KlondikeCore extends CardGameCore {
  static getCardPlaceStrings() {
    return [
      "stock discard - foundation foundation foundation foundation",
      "tableau tableau tableau tableau tableau tableau tableau",
    ];
  }

  constructor(allCards, pickCount) {
    super(allCards);
    this._pickCount = pickCount;
    this._currentlyPicked = 0;
  }

  checkWin() {
    const foundationArrays = this.constructor.getCardPlaces().kindToPlaceIds.foundation.map(id => this.placeIdToCardArray[id]);
    return foundationArrays.every(cardArray => (cardArray.length === 13));
  }

  deal() {
    this.moveCards(this._allCards, 'stock', false);
    for (let i = 0; i < 7; i++) {
      const howManyCardsToMove = i+1;
      const cardsToMove = this.placeIdToCardArray.stock.splice(-howManyCardsToMove);
      this.moveCards(cardsToMove, 'tableau' + i);
      cardsToMove[cardsToMove.length - 1].visible = true;
    }
  }

  canMaybeMoveSomewhere(card, sourcePlaceId) {
    if (sourcePlaceId === 'stock') {
      // never makes sense (stock to discard moving is handled separately, see stockToDiscard)
      return false;
    }
    if (sourcePlaceId === 'discard' || sourcePlaceId.startsWith('foundation')) {
      // only topmost card can move
      const cardArray = this.placeIdToCardArray[sourcePlaceId];
      return (card === cardArray[cardArray.length - 1]);
    }
    if (sourcePlaceId.startsWith('tableau')) {
      return card.visible;
    }
    throw new Error("unknown card place id: " + sourcePlaceId);
  }

  _cardInSomeTableau(card) {
    const tableauArrays = this.constructor.getCardPlaces().kindToPlaceIds.tableau.map(id => this.placeIdToCardArray[id]);
    return tableauArrays.some(subArray => subArray.includes(card));
  }

  canMove(card, sourcePlaceId, destPlaceId) {
    const sourceArray = this.placeIdToCardArray[sourcePlaceId];
    const destArray = this.placeIdToCardArray[destPlaceId];

    const sourceArrayIndex = sourceArray.indexOf(card);
    if (sourceArrayIndex < 0) {
      throw new Error("card and sourcePlaceId don't match");
    }
    const isTopmost = (sourceArrayIndex === sourceArray.length - 1);

    if (isTopmost) {
      if (destPlaceId === 'stock' || destPlaceId === 'discard' || !card.visible) {
        return false;
      }
      if (destPlaceId.startsWith('foundation')) {
        if (destArray.length === 0) {
          return (card.number === 1);
        }
        const topmostCard = destArray[destArray.length - 1];
        return (card.suit === topmostCard.suit && card.number === topmostCard.number + 1);
      }
    } else {
      // the only valid move for a stack of cards is tableau --> tableau
      // for that, the bottommost moving card must be visible
      if (!( sourcePlaceId.startsWith('tableau') && destPlaceId.startsWith('tableau') && card.visible )) {
        return false;
      }
      // the tableau move is checked below like any other tableau move
    }

    if (!destPlaceId.startsWith('tableau')) {
      throw new Error("bug");   // lol
    }
    if (destArray.length === 0) {
      return (card.number === 13);
    }
    const topmostCard = destArray[destArray.length - 1];
    return (card.suit.color !== topmostCard.suit.color && card.number === topmostCard.number - 1);
  }

  rawMove(card, sourcePlaceId, destPlaceId) {
    super.rawMove(card, sourcePlaceId, destPlaceId);

    const sourceArray = this.placeIdToCardArray[sourcePlaceId];
    if (sourcePlaceId.startsWith('tableau') && sourceArray.length !== 0) {
      sourceArray[sourceArray.length - 1].visible = true;
    }
  }

  stockToDiscard() {
    if (this.placeIdToCardArray.stock.length === 0) {
      for (const card of this.placeIdToCardArray.discard) {
        card.visible = false;
      }
      this.moveCards(this.placeIdToCardArray.discard, 'stock');
      this.placeIdToCardArray.discard.length = 0;
    } else {
      const cardArray = this.placeIdToCardArray.stock.splice(0, this._pickCount);
      this.moveCards(cardArray, 'discard');
      for (const card of cardArray) {
        card.visible = true;
      }
    }
  }

  moveCardToAnyFoundationIfPossible(card, sourcePlaceId) {
    // TODO: do nothing if the card is already in a foundation
    for (const foundationId of this.constructor.getCardPlaces().kindToPlaceIds.foundation) {
      if (this.canMove(card, sourcePlaceId, foundationId)) {
        this.move(card, sourcePlaceId, foundationId);
        return true;
      }
    }
    return false;
  }

  moveAnyCardToAnyFoundationIfPossible() {
    for ( const id of this.constructor.getCardPlaces().kindToPlaceIds.tableau.concat(['discard']) ) {
      const array = this.placeIdToCardArray[id];
      if (array.length !== 0 && this.moveCardToAnyFoundationIfPossible(array[array.length - 1], id)) {
        return true;
      }
    }
    return false;
  }
}


class KlondikeUI extends CardGameUI {
  constructor(gameDiv) {
    super(gameDiv, KlondikeCore);

    this.cardPlaceDivs.stock.addEventListener('click', () => this._onClick(null));

    for (const [ card, div ] of this.cardDivs.entries()) {
      div.addEventListener('click', () => {
        this._onClick(card);
      });
      div.addEventListener('auxclick', () => {
        this._onAuxClick(card);
        event.stopPropagation();  // don't do the non-card auxclick handling
      });
    }

    gameDiv.addEventListener('auxclick', () => this._onAuxClick(null));
  }

  _onClick(card) {
    if (this.currentGame.status !== GameStatus.PLAYING) {
      return;
    }
    if (card === null || this.currentGame.placeIdToCardArray.stock.includes(card)) {
      this.currentGame.stockToDiscard();
    }
  }

  _onAuxClick(card) {
    if (this.currentGame.status !== GameStatus.PLAYING) {
      return;
    }

    if (card === null) {
      while( this.currentGame.moveAnyCardToAnyFoundationIfPossible() ){}      // eslint-disable-line
    } else {
      this.currentGame.moveCardToAnyFoundationIfPossible(card, this.currentGame.findCurrentPlaceId(card));
    }
  }

  getNextCardOffset(card, movedCards, newPlaceId) {
    if (newPlaceId === 'discard' && movedCards.includes(card)) {
      return [SPACING_MEDIUM, 0];
    }
    if (newPlaceId.startsWith('tableau')) {
      return card.visible ? [0, SPACING_BIG] : [0, SPACING_SMALL];
    }
    return [0, 0];
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const gameDiv = document.getElementById('game');
  const pickInput = document.getElementById('pick-input');
  const newGameButton = document.getElementById('new-game-button');

  pickInput.addEventListener('input', () => {
    newGameButton.disabled = !pickInput.checkValidity();
  });

  const ui = new KlondikeUI(gameDiv);
  ui.newGame(+pickInput.value);
  newGameButton.addEventListener('click', () => ui.newGame(+pickInput.value));
});

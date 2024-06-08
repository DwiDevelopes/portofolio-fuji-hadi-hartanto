import { CardGameCore, CardGameUI, Card, SUITS, SPACING_SMALL, SPACING_BIG } from './cards.js';
import { GameStatus } from './game.js';


class SpiderCore extends CardGameCore {
  static createCards() {
    // there are 2*4*13 cards, and they are all of the same suit until setDifficulty is called
    const result = [];
    for (let i = 1; i <= 13; i++) {
      for (let j = 0; j < 2*4; j++) {
        result.push(new Card(i, SUITS[0]));
      }
    }
    return result;
  }

  static getCardPlaceStrings() {
    return [
      "stock - foundation foundation foundation foundation foundation foundation foundation foundation",
      "tableau tableau tableau tableau tableau tableau tableau tableau tableau tableau",
    ];
  }

  // the cards can be in any order, but they need to be shuffled after calling this
  _setDifficulty(allCards, numberOfSuits) {
    const suitArray = [];

    // verbose is better than complicated
    if (numberOfSuits === 1) {
      suitArray.push(SUITS[0]);
      suitArray.push(SUITS[0]);
      suitArray.push(SUITS[0]);
      suitArray.push(SUITS[0]);
    } else if (numberOfSuits === 2) {
      suitArray.push(SUITS[0]);
      suitArray.push(SUITS[0]);
      suitArray.push(SUITS[1]);
      suitArray.push(SUITS[1]);
    } else if (numberOfSuits === 4) {
      suitArray.push(SUITS[0]);
      suitArray.push(SUITS[1]);
      suitArray.push(SUITS[2]);
      suitArray.push(SUITS[3]);
    } else {
      throw new Error("unknown number of suits: " + numberOfSuits);
    }

    const suitsByNumber = {};
    for (let number = 1; number <= 13; number++) {
      // suits are repeated here because there are twice as many cards as in e.g. klondike
      suitsByNumber[number] = suitArray.concat(suitArray);   // this must copy suitArray
    }

    for (const card of allCards) {
      // avoid changing the suit when not needed, that makes this a bit faster
      const i = suitsByNumber[card.number].indexOf(card.suit);
      if (i < 0) {
        card.suit = suitsByNumber[card.number].pop();
      } else {
        suitsByNumber[card.number].splice(i, 1);
      }
    }
  }

  constructor(allCards, numberOfSuits) {
    super(allCards);
    this._setDifficulty(allCards, numberOfSuits);
  }

  checkWin() {
    const foundationArrays = this.constructor.getCardPlaces().kindToPlaceIds.foundation.map(id => this.placeIdToCardArray[id]);
    return foundationArrays.every(cardArray => (cardArray.length === 13));
  }

  deal() {
    this.moveCards(this._allCards, 'stock', false);
    const numberOfTableau = this.constructor.getCardPlaces().kindToPlaceIds.tableau.length;

    const numberOfCardsNotDealt = 5*10;
    const howManyToDealTotal = this._allCards.length - numberOfCardsNotDealt;
    const atLeastHowManyToDealToEachTableau = Math.floor(howManyToDealTotal / numberOfTableau);
    const howManyTableauWillGetOneExtraCardEach = howManyToDealTotal % numberOfTableau;

    for (let i = 0; i < numberOfTableau; i++) {
      const howManyToDeal = atLeastHowManyToDealToEachTableau + !!(i < howManyTableauWillGetOneExtraCardEach);
      const cardsToMove = this.placeIdToCardArray.stock.splice(-howManyToDeal);
      this.moveCards(cardsToMove, 'tableau' + i);
      cardsToMove[cardsToMove.length - 1].visible = true;
    }
  }

  canMaybeMoveSomewhere(card, sourcePlaceId) {
    if (!( sourcePlaceId.startsWith('tableau') && card.visible )) {
      return false;
    }

    const cardArray = this.placeIdToCardArray[sourcePlaceId];
    const index = cardArray.indexOf(card);
    if (index < 0) {
      throw new Error("card and sourcePlaceId don't match");
    }
    const cardsToMove = cardArray.slice(index);

    // the numbers of the cards must be decreasing with decrement 1, e.g. 11 10 9 8 7 ...
    // also all the cards need to be of the same suit (doesn't matter when playing with 1 suit only)
    // note that the loop starts at i=1 to avoid doing cardsToMove[-1]
    for (let i = 1; i < cardsToMove.length; i++) {
      if ( cardsToMove[i].number !== cardsToMove[i-1].number-1 || cardsToMove[i].suit !== cardsToMove[i-1].suit ) {
        return false;
      }
    }
    return true;
  }

  canMove(card, sourcePlaceId, destPlaceId) {
    if (!destPlaceId.startsWith('tableau')) {
      return false;
    }

    const destArray = this.placeIdToCardArray[destPlaceId];
    if (destArray.length === 0) {
      return true;
    }
    return (card.number === destArray[destArray.length - 1].number - 1);
  }

  rawMove(card, sourcePlaceId, destPlaceId) {
    super.rawMove(card, sourcePlaceId, destPlaceId);

    const sourceArray = this.placeIdToCardArray[sourcePlaceId];
    if (sourcePlaceId.startsWith('tableau') && sourceArray.length !== 0) {
      sourceArray[sourceArray.length - 1].visible = true;
    }

    const destArray = this.placeIdToCardArray[destPlaceId];
    if (destPlaceId.startsWith('tableau') && destArray.length >= 13) {
      // if a tableau has visible cards K,Q,J,10,9,...,A at top AND they are all of the same suit
      // then foundation them
      for (let i = 1; i <= 13; i++) {
        const card = destArray[destArray.length - i];
        if (card.number !== i || card.suit !== destArray[destArray.length - 1].suit || !card.visible) {
          return;
        }
      }

      // find a free foundation and move there
      for (const foundationId of this.constructor.getCardPlaces().kindToPlaceIds.foundation.slice().reverse()) {
        if (this.placeIdToCardArray[foundationId].length === 0) {
          this.rawMove(destArray[destArray.length - 13], destPlaceId, foundationId);
          return;
        }
      }
      throw new Error("wtf not enough foundations");
    }
  }

  // stockToTableau is not allowed when there are empty tableaus
  // this returns an array of ids of tableaus (can be empty)
  // the ui complains to the user about the tableaus if nonempty
  whichTableausPreventStockToTableau() {
    return this.constructor.getCardPlaces().kindToPlaceIds.tableau.filter(id => this.placeIdToCardArray[id].length === 0);
  }

  stockToTableau() {
    if (this.whichTableausPreventStockToTableau().length !== 0) {
      throw new Error("whichTableausPreventStockToTableau() wasn't used");
    }

    const tableauIdArray = this.constructor.getCardPlaces().kindToPlaceIds.tableau;
    if (this.placeIdToCardArray.stock.length % tableauIdArray.length !== 0) {
      throw new Error("calculations are wrong");
    }
    if (this.placeIdToCardArray.stock.length === 0) {
      return;
    }

    for (const tableauId of tableauIdArray) {
      const card = this.placeIdToCardArray.stock[this.placeIdToCardArray.stock.length - 1];
      this.rawMove(card, 'stock', tableauId);
      card.visible = true;
    }
  }
}


class SpiderUI extends CardGameUI {
  constructor(gameDiv) {
    super(gameDiv, SpiderCore);

    for (const [ card, div ] of this.cardDivs.entries()) {
      div.addEventListener('click', () => this._onClick(card));
    }
  }

  _onClick(card) {
    if (this.currentGame.status !== GameStatus.PLAYING) {
      return;
    }
    if (this.currentGame.placeIdToCardArray.stock.includes(card)) {
      const whyNot = this.currentGame.whichTableausPreventStockToTableau();
      if (whyNot.length === 0) {
        this.currentGame.stockToTableau();
      } else {
        for (const placeId of whyNot) {
          this.cardPlaceDivs[placeId].classList.add('cannot-stock-to-tableau');
        }

        // TODO: use a css transition instead of setTimeout
        window.setTimeout(() => {
          for (const placeId of whyNot) {
            this.cardPlaceDivs[placeId].classList.remove('cannot-stock-to-tableau');
          }
        }, 500);
      }
    }
  }

  getNextCardOffset(card, movedCards, newPlaceId) {
    if (newPlaceId === 'stock') {
      // offset them so that the cards for each stockToTableau call are together
      const numberOfTableau = SpiderCore.getCardPlaces().kindToPlaceIds.tableau.length;
      return (movedCards.indexOf(card) % numberOfTableau === numberOfTableau - 1) ? [SPACING_SMALL, 0] : [0, 0];
    }
    if (newPlaceId.startsWith('tableau')) {
      return card.visible ? [0, SPACING_BIG] : [0, SPACING_SMALL];
    }
    return [0, 0];
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const gameDiv = document.getElementById('game');
  const newGameButton = document.getElementById('new-game-button');
  const difficultyInputs = document.getElementById('difficulty-inputs');

  const ui = new SpiderUI(gameDiv);
  ui.newGame(1);

  newGameButton.addEventListener('click', () => {
    const selectedInput = difficultyInputs.querySelector('input:checked');
    ui.newGame(+selectedInput.value);
  });
});

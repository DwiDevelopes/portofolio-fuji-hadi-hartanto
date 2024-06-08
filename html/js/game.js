export const GameStatus = Object.freeze({ PLAYING: 1, GAME_OVER: 2, WIN: 3 });

export class GameCore extends EventTarget {
  constructor() {
    super();
    this._status = GameStatus.PLAYING;
  }

  get status() {
    return this._status;
  }

  set status(newStatus) {
    this._status = newStatus;
    this.dispatchEvent(new Event('StatusChanged'));
  }
}

export class GameUI {
  constructor(gameDiv) {
    this.gameDiv = gameDiv;
    this.currentGame = null;

    this._statusMessagePara = document.createElement('p');
    this._statusMessagePara.classList.add('status-message');
    this._statusMessagePara.classList.add('hidden');
    gameDiv.appendChild(this._statusMessagePara);
  }

  // override this and call super() in the override after setting this.currentGame
  newGame() {
    if (this.currentGame === null) {
      throw new Error("newGame() wasn't overrided or the override didn't set this.currentGame");
    }

    this.currentGame.addEventListener('StatusChanged', () => this._onStatusChanged());
    this._onStatusChanged();
  }

  _onStatusChanged() {
    if (this.currentGame.status === GameStatus.GAME_OVER) {
      this._statusMessagePara.classList.remove('hidden');
      this._statusMessagePara.textContent = "Game Over :(";
    } else if (this.currentGame.status === GameStatus.WIN) {
      this._statusMessagePara.classList.remove('hidden');
      this._statusMessagePara.textContent = "You win :)";
    } else if (this.currentGame.status === GameStatus.PLAYING) {
      this._statusMessagePara.classList.add('hidden');
      this._statusMessagePara.textContent = "";   // why not reset it anyway, lol
    } else {
      throw new Error("unknown game status: " + this.currentGame.status);
    }
  }
}

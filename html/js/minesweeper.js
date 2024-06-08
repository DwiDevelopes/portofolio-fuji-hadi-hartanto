import { GameStatus, GameCore, GameUI } from './game.js';


class MinesweeperCore extends GameCore {
  constructor(width, height, mineCount) {
    super();
    if (mineCount > width*height - 1) {
      throw new Error("too many mines");
    }

    this.width = width;
    this.height = height;
    this.mineCount = mineCount;

    this._map = {};   // { "x,y": { opened: boolean, mine: boolean, flagged: boolean } }
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        this._map[x + ',' + y] = { opened: false, mine: false, flagged: false };
      }
    }

    this._minesAdded = false;
  }

  _getNeighbors(xy) {
    const [ x, y ] = xy;
    const possibleNeighbors = [
      [x-1, y-1],
      [x-1, y  ],
      [x-1, y+1],
      [x,   y+1],
      [x+1, y+1],
      [x+1, y  ],
      [x+1, y-1],
      [x,   y-1],
    ];
    return possibleNeighbors.filter(neighbor => {
      const [ nx, ny ] = neighbor;   // nx = neighbor x, ny = neighbor y
      return (0 <= nx && nx < this.width && 0 <= ny && ny < this.height);
    });
  }

  _countNeighborMines(xy) {
    let result = 0;
    for (const neighbor of this._getNeighbors(xy)) {
      if (this._map[neighbor].mine) {
        result++;
      }
    }
    return result;
  }

  getSquareInfo(xy) {
    return {
      opened: this._map[xy].opened,
      mine: this._map[xy].mine,
      flagged: this._map[xy].flagged,
      minesAround: this._countNeighborMines(xy),
    };
  }

  _addMines() {
    let mined = 0;
    while (mined < this.mineCount) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);
      const square = this._map[x + ',' + y];
      if (!square.opened && !square.mine) {
        square.mine = true;
        mined++;
      }
    }
 }

  _openRecurser(xy) {
    if (this._map[xy].opened) {
      return;
    }

    this._map[xy].opened = true;
    if (!this._minesAdded) {
      this._addMines();
      this._minesAdded = true;
    }

    if (this._map[xy].mine) {
      this.status = GameStatus.GAME_OVER;
    } else if (this._countNeighborMines(xy) === 0) {
      for (const neighbor of this._getNeighbors(xy)) {
        this._openRecurser(neighbor);
      }
    }
  }

  open(xy) {
    if (this.status !== GameStatus.PLAYING || this._map[xy].flagged) {
      return;
    }

    this._openRecurser(xy);
    if (this.status === GameStatus.GAME_OVER) {
      return;
    }
    if (this.status !== GameStatus.PLAYING) {
      throw new Error("unexpected status: " + this.status);
    }

    // try to find a non-mine, non-opened square, player won if there are none
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const square = this._map[x + ',' + y];
        if (!square.mine && !square.opened) {
          return;
        }
      }
    }
    this.status = GameStatus.WIN;
  }

  toggleFlag(xy) {
    if (this.status !== GameStatus.PLAYING || this._map[xy].opened) {
      return;
    }
    this._map[xy].flagged = !this._map[xy].flagged;
  }

  openAroundIfSafe(xy) {
    if (this.status !== GameStatus.PLAYING || !this._map[xy].opened) {
      return;
    }

    let neighborMines = 0;
    let neighborFlags = 0;
    for (const neighbor of this._getNeighbors(xy)) {
      if (this._map[neighbor].mine) {
        neighborMines++;
      }
      if (this._map[neighbor].flagged) {
        neighborFlags++;
      }
    }

    if (neighborMines === neighborFlags) {
      for (const neighbor of this._getNeighbors(xy)) {
        this.open(neighbor);
      }
    }
  }
}


const UNICODE_FLAG = '\u2691';
const UNICODE_ASTERISK = '\u2217';

class MinesweeperUI extends GameUI {
  constructor(gameDiv, statusBarElem) {
    super(gameDiv);
    gameDiv.addEventListener('contextmenu', event => event.preventDefault());   // makes it less annoying
    this._statusBarElem = statusBarElem;
    this._squareElems = {};
  }

  newGame(width, height, mineCount) {
    for (const elem of Object.values(this._squareElems)) {
      this.gameDiv.removeChild(elem);
    }
    this._squareElems = {};

    this.currentGame = new MinesweeperCore(width, height, mineCount);

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const elem = document.createElement('div');
        const innerSpan = document.createElement('span');
        elem.appendChild(innerSpan);
        // +1 because grid rows and columns have to start at 1 instead of 0, lel
        elem.style.gridColumn = x+1;
        elem.style.gridRow = y+1;
        elem.classList.add('square');

        elem.addEventListener('click', event => {
          this.currentGame.open([ x, y ]);
          this._updateSquares();
          event.preventDefault();
        });
        elem.addEventListener('dblclick', event => {
          this.currentGame.openAroundIfSafe([ x, y ]);
          this._updateSquares();
          event.preventDefault();
        });
        elem.addEventListener('contextmenu', event => {
          this.currentGame.toggleFlag([ x, y ]);
          this._updateSquares();
          event.preventDefault();
        });

        this._squareElems[x + ',' + y] = elem;
        this.gameDiv.appendChild(elem);
      }
    }

    this._updateSquares();
    super.newGame();
  }

  // TODO: should be implemented with callbacks instead of a huge updater function
  _updateSquares() {
    let flagsTotal = 0;

    for (let x = 0; x < this.currentGame.width; x++) {
      for (let y = 0; y < this.currentGame.height; y++) {
        const xy = [ x, y ];

        const squareInfo = this.currentGame.getSquareInfo(xy);

        if (squareInfo.flagged) {
          flagsTotal++;
        }

        let mineNumber = null;    // null for e.g. mines at end of game, or an integer: 0, 1, 2, ..., 8
        let textContent = "";

        if ((this.currentGame.status === GameStatus.PLAYING && squareInfo.opened) ||
            (this.currentGame.status !== GameStatus.PLAYING && !squareInfo.mine)) {
          mineNumber = squareInfo.minesAround;
          textContent += squareInfo.minesAround;
        } else if (this.currentGame.status === GameStatus.PLAYING) {
          if (squareInfo.flagged) {
            textContent += UNICODE_FLAG;
          }
        } else {
          // end of game and mine, show it
          textContent = UNICODE_ASTERISK;
          if (squareInfo.flagged) {
            textContent += UNICODE_FLAG;
          }
        }

        const elem = this._squareElems[xy];
        const [ innerSpan ] = elem.childNodes;
        innerSpan.textContent = textContent;

        if (squareInfo.opened) {
          elem.classList.add('opened');
          if (mineNumber !== null) {
            elem.classList.add('number' + mineNumber);
          }
          if (squareInfo.mine) {
            elem.classList.add('openedmine');
          }
        } else {
          elem.classList.remove('opened');
          for (let i = 0; i <= 8; i++) {
            elem.classList.remove('number' + i);
          }
        }
      }
    }

    this._statusBarElem.textContent = `${flagsTotal}/${this.currentGame.mineCount} mines flagged`;
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const widthInput = document.getElementById('width-input');
  const heightInput = document.getElementById('height-input');
  const mineCountInput = document.getElementById('mine-count-input');
  const minePercentageInput = document.getElementById('mine-percentage-input');

  const newGameButton = document.getElementById('new-game-button');
  const gameDiv = document.getElementById('game');
  const statusBarSpan = document.getElementById('game-statusbar');

  function validateEverything(minePercentageToCount) {
    if (!widthInput.checkValidity() || !heightInput.checkValidity()) {
      return;
    }

    const width = +widthInput.value;
    const height = +heightInput.value;

    // mine count must NOT be exactly width*height, because that way beginning the minesweeper
    // game without exploding would be impossible, even though that should happen every time
    mineCountInput.max = width*height - 1;

    if (minePercentageToCount) {
      if (!minePercentageInput.checkValidity()) {
        return;
      }

      const requestedPercentage = +minePercentageInput.value.slice(0, -1);

      // this might not be valid because rounding can produce 0 or width*height, but that's handled below
      mineCountInput.value = Math.round(requestedPercentage / 100 * (width*height));
    }

    if (!mineCountInput.checkValidity()) {
      return;
    }

    const percentage = (+mineCountInput.value) / (width*height) * 100;
    minePercentageInput.value = percentage.toFixed(3) + '%';
    if (!minePercentageInput.checkValidity()) {
      throw new Error(`something resulted in an invalid percentage: ${minePercentageInput.value}`);
    }

    newGameButton.disabled = false;
  }

  // minePercentageInput is special because validateEverything(true) would change its value
  widthInput.addEventListener('input', () => validateEverything(true));
  heightInput.addEventListener('input', () => validateEverything(true));
  mineCountInput.addEventListener('input', () => validateEverything(false));
  minePercentageInput.addEventListener('change', () => validateEverything(true));
  validateEverything(false);   // default count is set in the html, percentage isn't

  const allInputs = [ widthInput, heightInput, mineCountInput, minePercentageInput ];
  for (const input of allInputs) {
    input.addEventListener('input', () => {
      newGameButton.disabled = !allInputs.every(input => input.validity.valid);
    });
  }

  const ui = new MinesweeperUI(gameDiv, statusBarSpan);

  function startNewGame() {
    const width = +widthInput.value;
    const height = +heightInput.value;
    const nMines = +mineCountInput.value;
    ui.newGame(width, height, nMines);
  }

  newGameButton.addEventListener('click', startNewGame);
  startNewGame();
});

import { GameStatus, GameCore, GameUI } from './game.js';


function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function arrayHypot(arr1, arr2) {
  const [ x1, y1 ] = arr1;
  const [ x2, y2 ] = arr2;
  return Math.hypot(x2 - x1, y2 - y1);
}


const COLOR_IDS = [ 1, 2, 3, 4, 5, 6 ];
const BUBBLE_RADIUS = 10;

// bubbles can "slide" between other bubbles in handy ways with this
const EASY_SLIDE_FACTOR = 0.7;

// how many times to shoot until a new row of bubbles appears?
const SHOTS_PER_ROW = 4;

// size, as number of bubbles
// TODO: let the user decide these
const X_BUBBLE_COUNT_LIMIT = 20;
const Y_BUBBLE_COUNT_LIMIT = 15;

const WIDTH = (2*X_BUBBLE_COUNT_LIMIT + 1) * BUBBLE_RADIUS;
const HEIGHT = (1 + Math.sqrt(3)*(Y_BUBBLE_COUNT_LIMIT - 1) + 1) * BUBBLE_RADIUS;

// to disallow shooting the bubble e.g. down or very horizontally
const MOST_HORIZONTAL_ANGLE_SIN = 0.05;


class Bubble {
  constructor(coords, colorId, game) {
    this._coords = coords;
    this.colorId = colorId;
    this._game = game;
    this._doEvent('BubbleCreate');
  }

  _doEvent(name) {
    const event = new Event(name);
    event.bubble = this;
    this._game.dispatchEvent(event);
  }

  get coords() {
    return this._coords;
  }

  set coords(coords) {
    this._coords = coords;
    this._doEvent('BubbleMove');
  }

  doAttachedEvent() {
    this._doEvent('BubbleAttached');
  }

  destroy() {
    this._doEvent('BubbleDestroy');
  }
}

class BubbleShooterCore extends GameCore {
  static correctShootAngle(angle) {
    // using sin and cos here makes sure that it doesn't matter if the angle is e.g. off by 2pi
    if (Math.sin(angle) > -MOST_HORIZONTAL_ANGLE_SIN) {
      if (Math.cos(angle) > 0) {
        return -Math.asin(MOST_HORIZONTAL_ANGLE_SIN);
      } else {
        return Math.PI + Math.asin(MOST_HORIZONTAL_ANGLE_SIN);
      }
    }
    return angle;
  }

  constructor(shooterBubbleYRelative) {
    super();
    this._shooterBubbleY = HEIGHT + shooterBubbleYRelative;
    this._shotBubble = null;
    this._nextShotBubble = null;
    this._shootCounter = 0;
    this._attachedBubbles = {};   // { "xCount,yCount": Bubble }
  }

  onEventsConnected() {
    for (let i = 0; i < Y_BUBBLE_COUNT_LIMIT/2; i++) {
      this._addBubbleRowOrRows(COLOR_IDS);
    }
    for (const bubble of Object.values(this._attachedBubbles)) {
      bubble.doAttachedEvent();
    }

    this._createNextShotBubble();   // must be last for some reason
  }

  destroy() {
    for (const bubble of Object.values(this._attachedBubbles)) {
      bubble.destroy();
    }

    this._nextShotBubble.destroy();

    if (this._shotBubble !== null) {
      this._shotBubble.destroy();
      this._shotBubble = null;   // for shoot()
    }
  }

  _createNextShotBubble() {
    this._nextShotBubble = new Bubble(
      [ WIDTH/2, this._shooterBubbleY ], randomChoice(this._getUsedColorIds()), this);
  }

  _checkPlaying() {
    if (this.status !== GameStatus.PLAYING) {
      throw new Error("expected PLAYING status, but it is " + self.status);
    }
  }

  _updateStatus() {
    this._checkPlaying();
    if (Object.entries(this._attachedBubbles).length === 0) {
      this.status = GameStatus.WIN;
      return;
    }

    for (const countsStr of Object.keys(this._attachedBubbles)) {
      const [ xCount, yCount ] = countsStr.split(',').map(s => +s);
      if (xCount < 0 || xCount >= X_BUBBLE_COUNT_LIMIT) {
        throw new Error("invalid x count: " + xCount);
      }
      if (yCount < 0) {
        throw new Error("invalid y count: " + yCount);
      }
      if (yCount >= Y_BUBBLE_COUNT_LIMIT) {
        this.status = GameStatus.GAME_OVER;
        return;
      }
    }
  }

  _removeBubble(counts) {
    const bubble = this._attachedBubbles[counts];
    if (!( delete this._attachedBubbles[counts] )) {
      throw new Error("delete failed");
    }
    bubble.destroy();
  }

  _removeLooseBubbles() {
    const notLoose = new Set();

    const recurser = recurserCounts => {
      if (this._attachedBubbles[recurserCounts] !== undefined && !notLoose.has(recurserCounts + "")) {
        notLoose.add(recurserCounts + "");
        for (const neighbor of this._getNeighbors(recurserCounts)) {
          recurser(neighbor);
        }
      }
    };

    for (let x = 0; x < X_BUBBLE_COUNT_LIMIT; x++) {
      recurser([ x, 0 ]);
    }

    let didSomething = false;
    for (const countsStr of Object.keys(this._attachedBubbles)) {
      if (!notLoose.has(countsStr)) {
        this._removeBubble(countsStr.split(',').map(s => +s));
        didSomething = true;
      }
    }

    if (didSomething) {
      // removing loose bubbles may cause other bubbles to become loose
      this._removeLooseBubbles();
    } else {
      // this runs once only
      this._updateStatus();
    }
  }

  _getUsedColorIds() {
    const result = new Set();
    for (const bubble of Object.values(this._attachedBubbles)) {
      result.add(bubble.colorId);
    }
    return Array.from(result);
  }

  // may change this.status
  _addBubbleRowOrRows(colorIds) {
    this._checkPlaying();
    if (colorIds === undefined) {
      colorIds = this._getUsedColorIds();
    }

    // in the beginning of the game, add 1 row at a time
    // when all bubbles of some color are gone, add 2 rows at a time
    // etc.
    const howManyRows = COLOR_IDS.length - colorIds.length + 1;

    for (let i = 0; i < howManyRows; i++) {
      const theBubbles = this._attachedBubbles;
      this._attachedBubbles = {};

      for (const [ countsStr, bubble ] of Object.entries(theBubbles)) {
        const [ xCount, yCount ] = countsStr.split(',').map(s => +s);
        const newCounts = [ xCount, yCount+1 ];
        this._attachedBubbles[newCounts] = bubble;
        bubble.coords = this._getCoords(newCounts);
      }

      for (let xCount = 0; xCount < X_BUBBLE_COUNT_LIMIT; xCount++) {
        const coords = this._getCoords([ xCount, 0 ]);
        const bubble = new Bubble(coords, randomChoice(colorIds), this);
        this._attachedBubbles[xCount + ',0'] = bubble;
      }
    }

    this._removeLooseBubbles();
  }

  _getCoords(counts) {
    const [ xCount, yCount ] = counts;
    return [ (1 + (yCount % 2) + 2*xCount) * BUBBLE_RADIUS,
             (1 + yCount*Math.sqrt(3)) * BUBBLE_RADIUS ];
  }

  _getNeighbors(counts) {
    const [ xCount, yCount ] = counts;

    /* this returns the neighbors A,B,C,D,E,F of X

     A B
    C X D
     E F
    */
    const result = [
      [ xCount-1, yCount ],     // C
      [ xCount+1, yCount ],     // D
    ];
    for (const y of [ yCount-1, yCount+1 ]) {
      result.push([ xCount - 1 + (yCount % 2), y ]);  // A or E
      result.push([ xCount + (yCount % 2), y ]);      // B or F
    }
    return result;
  }

  _getSameColorNeighbors(counts) {
    const lookingForColorId = this._attachedBubbles[counts].colorId;
    const result = {};   // { "xCount,yCount": [ xCount, yCount ]}

    const recurser = recurserCounts => {
      result[recurserCounts] = recurserCounts;
      for (const neighbor of this._getNeighbors(recurserCounts)) {
        if (this._attachedBubbles[neighbor] !== undefined &&
            this._attachedBubbles[neighbor].colorId === lookingForColorId &&
            result[neighbor] === undefined) {
          recurser(neighbor);
        }
      }
    };

    recurser(counts);
    return Object.values(result);
  }

  _attachBubble(bubble) {
    // do nothing if it doesn't hit the ceiling or any of the other bubbles
    // this could be optimized a lot
    if (bubble.coords[1] > BUBBLE_RADIUS) {
      let foundNearbyBubble = false;
      for (const other of Object.values(this._attachedBubbles)) {
        const dist = arrayHypot(bubble.coords, other.coords);
        if (dist <= 2*BUBBLE_RADIUS*EASY_SLIDE_FACTOR) {
          foundNearbyBubble = true;
          break;
        }
      }
      if (!foundNearbyBubble) {
        return false;
      }
    }

    // what's the best place to put this bubble to?
    let nearestCounts = undefined;
    let nearestDistance = Infinity;
    for (let xCount = 0; xCount < X_BUBBLE_COUNT_LIMIT; xCount++) {
      // +1 to make it possible to get game over this way
      for (let yCount = 0; yCount < Y_BUBBLE_COUNT_LIMIT + 1; yCount++) {
        const counts = [ xCount, yCount ];
        if (this._attachedBubbles[counts] === undefined) {
          const dist = arrayHypot(bubble.coords, this._getCoords(counts));
          if (dist < nearestDistance) {
            nearestCounts = counts;
            nearestDistance = dist;
          }
        }
      }
    }

    this._attachedBubbles[nearestCounts] = bubble;
    bubble.doAttachedEvent();
    bubble.coords = this._getCoords(nearestCounts);

    const sameColor = this._getSameColorNeighbors(nearestCounts);
    if (sameColor.length >= 3) {
      for (const counts of sameColor) {
        this._removeBubble(counts);
      }
    } else {
      // no other bubbles were destroyed, so add some new rows if needed
      this._shootCounter++;
      if (this._shootCounter % SHOTS_PER_ROW === 0) {
        this._addBubbleRowOrRows();  // may change this.status
      }
    }

    if (this.status === GameStatus.PLAYING) {
      this._removeLooseBubbles();
    }
    return true;
  }

  get shotBubbleMoving() {
    return (this._shotBubble !== null);
  }

  // assumes that the angle is from correctShootAngle()
  shoot(angle) {
    const bubble = this._nextShotBubble;
    this._createNextShotBubble();
    this._shotBubble = bubble;

    const speed = 0.3;
    let xVelocity = speed*Math.cos(angle);
    let yVelocity = speed*Math.sin(angle);
    let prevTime = +new Date();

    const callback = () => {
      if (this._shotBubble === null) {
        // new game pressed while shot bubble was moving, see destroy()
        return;
      }

      const newTime = +new Date();
      const timePassed = newTime - prevTime;
      prevTime = newTime;

      let [ x, y ] = bubble.coords;
      x += xVelocity * timePassed;
      y += yVelocity * timePassed;

      if (x < BUBBLE_RADIUS) {
        x = BUBBLE_RADIUS;
        xVelocity = Math.abs(xVelocity);
      }
      if (x > WIDTH - BUBBLE_RADIUS) {
        x = WIDTH - BUBBLE_RADIUS;
        xVelocity = -Math.abs(xVelocity);
      }
      bubble.coords = [ x, y ];

      if (this._attachBubble(bubble)) {
        this._shotBubble = null;
      } else {
        window.requestAnimationFrame(callback);
      }
    };

    callback();
  }
}

class BubbleShooterUI extends GameUI {
  constructor(gameDiv, bubbleAreaDiv, shooterDiv) {
    super(gameDiv);
    this._bubbleAreaDiv = bubbleAreaDiv;
    this._shooterDiv = shooterDiv;
    this._bubbleElements = new Map();
    this._shooterRadius = shooterDiv.getBoundingClientRect().height / 2;  // this is here for consistency
    this.setShooterAngle(-2*Math.PI/4);   // up
  }

  setShooterAngle(angle) {
    this._correctedShooterAngle = BubbleShooterCore.correctShootAngle(angle);
    this._shooterDiv.style.transform = `rotate(${this._correctedShooterAngle}rad)`;
  }

  _bubbleCreateCb(bubble) {
    const elem = document.createElement('div');
    elem.style.width = 2*BUBBLE_RADIUS + 'px';
    elem.style.height = 2*BUBBLE_RADIUS + 'px';
    elem.classList.add('bubble');
    elem.classList.add('bubble' + bubble.colorId);
    elem.classList.add('invisible');   // for css animations
    this._bubbleAreaDiv.appendChild(elem);
    this._bubbleElements.set(bubble, elem);
    this._bubbleMoveCb(bubble);

    // this needs a timeout for some reason
    setTimeout((() => elem.classList.remove('invisible')), 50);
  }

  _bubbleMoveCb(bubble) {
    const elem = this._bubbleElements.get(bubble);
    const [ x, y ] = bubble.coords;
    elem.style.left = (x - BUBBLE_RADIUS) + 'px';
    elem.style.top = (y - BUBBLE_RADIUS) + 'px';
  }

  _bubbleAttachedCb(bubble) {
    this._bubbleElements.get(bubble).classList.add('attached');
  }

  _bubbleDestroyCb(bubble) {
    const elem = this._bubbleElements.get(bubble);
    if (!this._bubbleElements.delete(bubble)) {
      throw new Error("delete failed: " + bubble);
    }

    // this is not just elem.parentElement.removeChild(elem) because css animations
    elem.classList.add('invisible');
    window.setTimeout(1000, () => elem.parentElement.removeChild(elem));
  }

  newGame() {
    if (this.currentGame !== null) {
      this.currentGame.destroy();
    }

    this.currentGame = new BubbleShooterCore(this._shooterRadius);
    this.currentGame.addEventListener('BubbleCreate', event => this._bubbleCreateCb(event.bubble));
    this.currentGame.addEventListener('BubbleMove', event => this._bubbleMoveCb(event.bubble));
    this.currentGame.addEventListener('BubbleAttached', event => this._bubbleAttachedCb(event.bubble));
    this.currentGame.addEventListener('BubbleDestroy', event => this._bubbleDestroyCb(event.bubble));
    this.currentGame.onEventsConnected();
    super.newGame();
  }

  shoot() {
    if (this.currentGame.status === GameStatus.PLAYING && !this.currentGame.shotBubbleMoving) {
      this.currentGame.shoot(this._correctedShooterAngle);
    }
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const gameDiv = document.getElementById('game');
  const bubbleAreaDiv = document.getElementById('game-bubble-area');
  const shooterDiv = document.getElementById('game-shooter');
  const newGameButton = document.getElementById('new-game-button');

  bubbleAreaDiv.style.width = WIDTH + 'px';
  bubbleAreaDiv.style.height = HEIGHT + 'px';
  shooterDiv.style.marginTop = HEIGHT + 'px';

  const ui = new BubbleShooterUI(gameDiv, bubbleAreaDiv, shooterDiv);

  bubbleAreaDiv.addEventListener('mousemove', event => {
    const shooterRect = shooterDiv.getBoundingClientRect();
    const shooterCenterX = (shooterRect.left + shooterRect.right)/2;
    const shooterCenterY = (shooterRect.top + shooterRect.bottom)/2;
    const xDiff = event.clientX - shooterCenterX;
    const yDiff = event.clientY - shooterCenterY;
    ui.setShooterAngle(Math.atan2(yDiff, xDiff));
  });
  newGameButton.addEventListener('click', () => ui.newGame());
  gameDiv.addEventListener('click', () => ui.shoot());

  ui.newGame();
});

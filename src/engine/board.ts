export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export const WHITE = 8;
export const BLACK = 16;

export class Board {
  public squares: Uint8Array;
  public sideToMove: number;
  public pliesThisTurn: number;
  public activeEpTargets: bigint;
  public nextEpTargets: bigint;
  public castlingRights: number; // bit 0: WK, bit 1: WQ, bit 2: BK, bit 3: BQ

  constructor() {
    this.squares = new Uint8Array(64);
    this.sideToMove = WHITE;
    this.pliesThisTurn = 0;
    this.activeEpTargets = 0n;
    this.nextEpTargets = 0n;
    this.castlingRights = 15;
    this.setInitialPosition();
  }

  setInitialPosition() {
    this.squares.fill(EMPTY);
    
    // Black pieces
    const blackBack = [
      ROOK | BLACK, KNIGHT | BLACK, BISHOP | BLACK, QUEEN | BLACK,
      KING | BLACK, BISHOP | BLACK, KNIGHT | BLACK, ROOK | BLACK
    ];
    for (let i = 0; i < 8; i++) {
      this.squares[i] = blackBack[i];
      this.squares[8 + i] = PAWN | BLACK;
    }

    // White pieces
    const whiteBack = [
      ROOK | WHITE, KNIGHT | WHITE, BISHOP | WHITE, QUEEN | WHITE,
      KING | WHITE, BISHOP | WHITE, KNIGHT | WHITE, ROOK | WHITE
    ];
    for (let i = 0; i < 8; i++) {
      this.squares[48 + i] = PAWN | WHITE;
      this.squares[56 + i] = whiteBack[i];
    }

    this.sideToMove = WHITE;
    this.pliesThisTurn = 0;
    this.activeEpTargets = 0n;
    this.nextEpTargets = 0n;
    this.castlingRights = 15;
  }

  clone(): Board {
    const b = new Board();
    b.squares.set(this.squares);
    b.sideToMove = this.sideToMove;
    b.pliesThisTurn = this.pliesThisTurn;
    b.activeEpTargets = this.activeEpTargets;
    b.nextEpTargets = this.nextEpTargets;
    b.castlingRights = this.castlingRights;
    return b;
  }

  getPiece(sq: number): number {
    return this.squares[sq] & 7;
  }

  getColor(sq: number): number {
    return this.squares[sq] & 24;
  }

  isEmpty(sq: number): boolean {
    return this.squares[sq] === EMPTY;
  }
}

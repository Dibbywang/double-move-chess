import React from "react";
import { WHITE, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from "../engine/board";

// Mapping piece type+color to the pixel PNG asset filename (in pieces/)
const PIECE_IMAGE: Record<number, Record<number, string>> = {
  [PAWN]:   { [WHITE]: "pieces/wP.png", [16]: "pieces/bP.png" },
  [KNIGHT]: { [WHITE]: "pieces/wN.png", [16]: "pieces/bN.png" },
  [BISHOP]: { [WHITE]: "pieces/wB.png", [16]: "pieces/bB.png" },
  [ROOK]:   { [WHITE]: "pieces/wR.png", [16]: "pieces/bR.png" },
  [QUEEN]:  { [WHITE]: "pieces/wQ.png", [16]: "pieces/bQ.png" },
  [KING]:   { [WHITE]: "pieces/wK.png", [16]: "pieces/bK.png" },
};

export const RenderPiece: React.FC<{ type: number; color: number; className?: string }> = ({
  type,
  color,
  className,
}) => {
  const imagePath = PIECE_IMAGE[type]?.[color];
  if (!imagePath) return null;
  const src = import.meta.env.BASE_URL + imagePath;

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        cursor: "pointer",
      }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          width: "82%",
          height: "82%",
          objectFit: "contain",
          // Crisp pixel-art rendering — no bilinear blurring
          imageRendering: "pixelated",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

export default RenderPiece;

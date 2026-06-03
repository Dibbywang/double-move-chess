import React from "react";
import { WHITE, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from "../engine/board";

export const RenderPiece: React.FC<{ type: number; color: number; className?: string }> = ({
  type,
  color,
  className,
}) => {
  const isWhite = color === WHITE;
  
  // Use standard filled Unicode characters for both sides, but style them by color
  // Alternatively, use standard outlines for white and filled for black.
  // We'll use standard outlines for white and filled for black as requested by "normal chess sets"
  let char = "";
  switch (type) {
    case PAWN:   char = "♟"; break;
    case KNIGHT: char = "♞"; break;
    case BISHOP: char = "♝"; break;
    case ROOK:   char = "♜"; break;
    case QUEEN:  char = "♛"; break;
    case KING:   char = "♚"; break;
    default: return null;
  }

  // To make it look clean and normal, we'll apply a simple text style
  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "8cqw", // Scale up the Unicode character relative to the board
        lineHeight: 1,
        fontFamily: "Arial, sans-serif",
        color: isWhite ? "#ffffff" : "#000000",
        textShadow: isWhite ? "0px 1px 2px rgba(0,0,0,0.5)" : "0px 1px 2px rgba(255,255,255,0.3)",
        userSelect: "none",
        cursor: "pointer",
      }}
    >
      {char}
    </div>
  );
};

export default RenderPiece;

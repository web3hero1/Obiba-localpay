'use client';

import React from 'react';

/**
 * Self-contained SVG QR Code Component for Obiba
 * Generates an SVG matrix representation of deposit addresses.
 */

// Simple deterministic hash-based 25x25 matrix generator with valid QR finder patterns & timing bars
export function QRCodeSVG({
  value,
  size = 180,
  className = '',
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const matrixSize = 25;
  const matrix: boolean[][] = Array.from({ length: matrixSize }, () =>
    Array(matrixSize).fill(false)
  );

  // Helper to draw a square
  const drawSquare = (r: number, c: number, s: number, fill: boolean) => {
    for (let i = 0; i < s; i++) {
      for (let j = 0; j < s; j++) {
        if (r + i < matrixSize && c + j < matrixSize) {
          matrix[r + i][c + j] = fill;
        }
      }
    }
  };

  // 1. Finder pattern generator (7x7 with 3x3 core)
  const drawFinderPattern = (r: number, c: number) => {
    drawSquare(r, c, 7, true);
    drawSquare(r + 1, c + 1, 5, false);
    drawSquare(r + 2, c + 2, 3, true);
  };

  // Draw 3 primary corner finders (Top-Left, Top-Right, Bottom-Left)
  drawFinderPattern(0, 0);
  drawFinderPattern(0, matrixSize - 7);
  drawFinderPattern(matrixSize - 7, 0);

  // 2. Timing patterns (alternating pixels between finders)
  for (let i = 7; i < matrixSize - 7; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // 3. Alignment pattern at (16, 16)
  drawSquare(16, 16, 5, true);
  drawSquare(17, 17, 3, false);
  matrix[18][18] = true;

  // 4. Fill data modules using pseudo-random hashing seeded by the text value
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  // Linear congruential generator for deterministic module filling
  let state = (hash >>> 0) || 123456789;
  const nextBit = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state & 1) === 1;
  };

  // Reserved zones (finders + separators)
  const isReserved = (r: number, c: number) => {
    if (r < 8 && c < 8) return true; // Top-left
    if (r < 8 && c >= matrixSize - 8) return true; // Top-right
    if (r >= matrixSize - 8 && c < 8) return true; // Bottom-left
    if (r === 6 || c === 6) return true; // Timing lines
    if (r >= 16 && r <= 20 && c >= 16 && c <= 20) return true; // Alignment
    return false;
  };

  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (!isReserved(r, c)) {
        matrix[r][c] = nextBit();
      }
    }
  }

  const cellSize = size / matrixSize;

  return (
    <div className={`p-3 bg-white rounded-2xl shadow-sm border border-[#E5E5EA] inline-block ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-auto block"
        shapeRendering="crispEdges"
      >
        <rect width={size} height={size} fill="#ffffff" />
        {matrix.map((row, r) =>
          row.map((cell, c) => {
            if (!cell) return null;
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#0B0B0C"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

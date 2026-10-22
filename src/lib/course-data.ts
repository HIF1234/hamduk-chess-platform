// "Course path": six levels named after the pieces, Pawn to King. Each unit bundles a
// lesson (an existing tutorial), practice puzzles (an existing puzzle theme/rating band), a
// short quiz (new, authored here), and a bot to beat (an existing bot persona) -- completing
// all four finishes the unit. Mobile-only for now; no web page reads this yet.

export type QuizQuestion = {
  question: string;
  choices: string[];
  correct: number; // index into choices
};

export type CourseUnit = {
  id: string;
  level: number; // 1-6, Pawn to King
  pieceName: string;
  title: string;
  description: string;
  tutorialId: string;
  puzzleTheme?: string; // omitted = general puzzles in the rating band, no tactic filter
  puzzleCount: number;
  minRating: number;
  maxRating: number;
  botId: string;
  quiz: QuizQuestion[];
};

export const COURSE_UNITS: CourseUnit[] = [
  {
    id: "pawn",
    level: 1,
    pieceName: "Pawn",
    title: "The Board & Setup",
    description: "Where everything starts: the squares, the setup, and who moves first.",
    tutorialId: "board-basics",
    puzzleCount: 5,
    minRating: 400,
    maxRating: 700,
    botId: "army_legend",
    quiz: [
      {
        question: "How many squares are on a chessboard?",
        choices: ["32", "48", "64", "100"],
        correct: 2,
      },
      {
        question: "Which colour moves first?",
        choices: ["White", "Black", "Whoever is younger", "A coin flip"],
        correct: 0,
      },
      {
        question: "How many pawns does each side start with?",
        choices: ["6", "8", "10", "16"],
        correct: 1,
      },
      {
        question: "A square that's light for White is light for Black too. True or false?",
        choices: ["True", "False"],
        correct: 0,
      },
      {
        question: "Which piece is worth the least?",
        choices: ["Knight", "Bishop", "Pawn", "Rook"],
        correct: 2,
      },
    ],
  },
  {
    id: "knight",
    level: 2,
    pieceName: "Knight",
    title: "How the Pieces Move",
    description: "Every piece's legal moves, including the knight's famous L-shape.",
    tutorialId: "how-pieces-move",
    puzzleTheme: "fork",
    puzzleCount: 5,
    minRating: 500,
    maxRating: 800,
    botId: "agbero",
    quiz: [
      {
        question: "A knight's move looks like which letter?",
        choices: ["T", "L", "X", "Z"],
        correct: 1,
      },
      { question: "Can a knight jump over other pieces?", choices: ["Yes", "No"], correct: 0 },
      {
        question: "Which piece moves only diagonally?",
        choices: ["Rook", "Bishop", "Knight", "Pawn"],
        correct: 1,
      },
      {
        question: "Which piece moves only in straight lines along files and ranks?",
        choices: ["Bishop", "Rook", "Knight", "King"],
        correct: 1,
      },
      {
        question: "How many squares can a king move in one turn (normally)?",
        choices: ["1", "2", "Up to 8", "Any number"],
        correct: 0,
      },
    ],
  },
  {
    id: "bishop",
    level: 3,
    pieceName: "Bishop",
    title: "Check, Checkmate & Stalemate",
    description: "Telling a check from a checkmate, and spotting a stalemate draw.",
    tutorialId: "check-and-checkmate",
    puzzleTheme: "pin",
    puzzleCount: 5,
    minRating: 600,
    maxRating: 900,
    botId: "iyaamala",
    quiz: [
      {
        question: 'What is "check"?',
        choices: [
          "The king is attacked",
          "The game is over",
          "A piece is pinned",
          "A pawn promotes",
        ],
        correct: 0,
      },
      {
        question: "In checkmate, can the player in check make any legal move?",
        choices: ["Yes", "No"],
        correct: 1,
      },
      {
        question: "Stalemate happens when a player has no legal move and...",
        choices: [
          "...is in check (that's checkmate instead)",
          "...is not in check",
          "...has only a king left",
          "...runs out of time",
        ],
        correct: 1,
      },
      {
        question: "A stalemate results in...",
        choices: [
          "A win for the player not in check",
          "A draw",
          "A win for whoever has more material",
          "The game continues",
        ],
        correct: 1,
      },
      {
        question: 'A "back-rank mate" happens on which rank, typically?',
        choices: [
          "The 4th or 5th rank",
          "The king's own back rank",
          "Any rank with a rook",
          "The h-file",
        ],
        correct: 1,
      },
    ],
  },
  {
    id: "rook",
    level: 4,
    pieceName: "Rook",
    title: "Special Moves",
    description: "Castling (which moves a rook), en passant, and pawn promotion.",
    tutorialId: "special-moves",
    puzzleTheme: "skewer",
    puzzleCount: 5,
    minRating: 700,
    maxRating: 1000,
    botId: "baba_ijebu",
    quiz: [
      {
        question: "Castling moves the king and which other piece?",
        choices: ["A pawn", "A rook", "A bishop", "A knight"],
        correct: 1,
      },
      {
        question: "To castle, has the king ever moved before?",
        choices: ["It can have moved", "It must never have moved"],
        correct: 1,
      },
      {
        question: "En passant is a special capture made by which piece?",
        choices: ["Pawn", "Knight", "Rook", "King"],
        correct: 0,
      },
      {
        question: "A pawn promotes when it reaches...",
        choices: [
          "The 4th rank",
          "The opponent's back rank",
          "Any rank after move 10",
          "The center",
        ],
        correct: 1,
      },
      {
        question: "A pawn can promote to any piece except...",
        choices: ["A queen", "A rook", "A king", "A knight"],
        correct: 2,
      },
    ],
  },
  {
    id: "queen",
    level: 5,
    pieceName: "Queen",
    title: "Opening Principles",
    description:
      "Control the center, develop pieces, and castle early -- the plan for any opening.",
    tutorialId: "opening-principles",
    puzzleTheme: "discoveredAttack",
    puzzleCount: 5,
    minRating: 800,
    maxRating: 1100,
    botId: "mama_cass",
    quiz: [
      {
        question: 'Which squares make up "the center"?',
        choices: ["a1, a8, h1, h8", "d4, d5, e4, e5", "The whole first rank", "The 4 corners"],
        correct: 1,
      },
      {
        question: "What should you usually do before moving the same piece twice in the opening?",
        choices: [
          "Develop another piece",
          "Bring the queen out",
          "Push the h-pawn",
          "Castle immediately",
        ],
        correct: 0,
      },
      {
        question: "Why castle early?",
        choices: [
          "It wins material",
          "It's required by the rules",
          "It safeguards the king and connects the rooks",
          "It blocks all pawns",
        ],
        correct: 2,
      },
      {
        question: "Bringing the queen out very early is usually risky because...",
        choices: [
          "It can be attacked and must move again, losing time",
          "The queen can't move diagonally",
          "It's against the rules",
          "It blocks castling",
        ],
        correct: 0,
      },
      {
        question: "Which is a sound opening goal?",
        choices: [
          "Push every pawn forward immediately",
          "Control the center and develop pieces",
          "Move the king out first",
          "Trade all the pawns",
        ],
        correct: 1,
      },
    ],
  },
  {
    id: "king",
    level: 6,
    pieceName: "King",
    title: "Hanging Pieces",
    description: "Spot undefended pieces -- free material is the most common way games are won.",
    tutorialId: "mg-hanging",
    puzzleTheme: "hangingPiece",
    puzzleCount: 5,
    minRating: 900,
    maxRating: 1200,
    botId: "area_father",
    quiz: [
      {
        question: 'A "hanging" piece is one that is...',
        choices: ["Promoted", "Pinned", "Undefended and can be captured for free", "Castled"],
        correct: 2,
      },
      {
        question: "Before every move, what should you check for?",
        choices: [
          "Checks, captures, and threats",
          "Only your own plan",
          "The clock",
          "Nothing, just move",
        ],
        correct: 0,
      },
      {
        question: "If your opponent leaves a piece undefended, you should usually...",
        choices: [
          "Ignore it",
          "Capture it if nothing bad happens after",
          "Castle instead",
          "Offer a draw",
        ],
        correct: 1,
      },
      {
        question: "A piece defended by another piece is called...",
        choices: ["Hanging", "Protected", "Promoted", "Pinned"],
        correct: 1,
      },
      {
        question: "Why do hanging pieces happen so often between beginners?",
        choices: [
          "The rules allow it only sometimes",
          "Missed captures and threats",
          "Pawns are too weak",
          "The board is too big",
        ],
        correct: 1,
      },
    ],
  },
];

export function getCourseUnit(id: string): CourseUnit | undefined {
  return COURSE_UNITS.find((u) => u.id === id);
}

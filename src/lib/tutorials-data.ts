import { MIDDLEGAME_TUTORIALS } from "@/lib/middlegame-lessons";

// Beginner tutorial content. Static — no CMS needed for now.
// Each tutorial is a series of steps. A step is either:
//   - "observe": read the instruction, click Next.
//   - "move": make the expected move on the board. Optional hint = from square.

/** The non-English languages offered at onboarding (see src/lib/languages.ts) that have
 * translated lesson text. Machine-translated, not reviewed by a native speaker -- a
 * starting point for the 5 basics tutorials, swappable later for human-reviewed copy. */
export type TranslatedLang = "pcm" | "yo" | "ha" | "ig";

export type TutorialStep =
  | {
      kind: "observe";
      fen: string;
      title: string;
      body: string;
      translations?: Partial<Record<TranslatedLang, { title: string; body: string }>>;
    }
  | {
      kind: "move";
      fen: string;
      title: string;
      body: string;
      /** UCI move e.g. "e2e4" or "e7e8q". */
      answer: string;
      hint?: string;
      translations?: Partial<Record<TranslatedLang, { title: string; body: string }>>;
    };

export type Tutorial = {
  id: string;
  title: string;
  description: string;
  level: "starter" | "beginner" | "intermediate";
  /** Grouping on the Learn page; basics when absent. */
  topic?: "basics" | "middlegame";
  estimatedMinutes: number;
  steps: TutorialStep[];
  translations?: Partial<Record<TranslatedLang, { title: string; description: string }>>;
};

/** Overlays a tutorial's own translated text (and each step's) for `lang`, falling back to
 * English wherever a translation is missing. Unknown/missing/"en" lang returns `t` as-is. */
export function localizeTutorial(t: Tutorial, lang?: string): Tutorial {
  const l = lang as TranslatedLang | undefined;
  if (!l || l === ("en" as TranslatedLang)) return t;
  const tt = t.translations?.[l];
  return {
    ...t,
    title: tt?.title ?? t.title,
    description: tt?.description ?? t.description,
    steps: t.steps.map((s) => {
      const st = s.translations?.[l];
      return st ? { ...s, title: st.title, body: st.body } : s;
    }),
  };
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const BASICS: Tutorial[] = [
  {
    id: "board-basics",
    title: "The Board & Setup",
    description: "Learn the ranks, files, and how the pieces are placed at the start.",
    level: "starter",
    estimatedMinutes: 4,
    translations: {
      pcm: {
        title: "Di Board & Setup",
        description: "Learn how di ranks and files dey, and how dem arrange di pieces for start.",
      },
      yo: {
        title: "Pátákó Ẹ̀wòrìn & Ìsètò",
        description:
          "Kọ ẹkọ nipa awọn ipele ati awọn kọlamu, àti bí wọ́n ṣe ń ṣètò àwọn ohun èlò nígbà tí eré bá bẹ̀rẹ̀.",
      },
      ha: {
        title: "Dashboard & Shiryawa",
        description: "Ka koyi matakai da layuka, da yadda ake shirya sassan a farkon wasa.",
      },
      ig: {
        title: "Bọọdụ & Ntọala",
        description: "Mụta usoro ahịrị na kọlụm, na otu esi edozi ihe egwuregwu na mmalite.",
      },
    },
    steps: [
      {
        kind: "observe",
        fen: START_FEN,
        title: "Welcome",
        body: "A chess board has 64 squares — 8 files (columns a–h) and 8 ranks (rows 1–8). White always sits at ranks 1–2, Black at ranks 7–8. The bottom-right square from White's view is a light square: 'light on right'.",
        translations: {
          pcm: {
            title: "Welcome",
            body: "Chess board get 64 squares — 8 files (column a to h) and 8 ranks (row 1 to 8). White dey always sidon for rank 1-2, Black for rank 7-8. Di square for bottom-right side wey White dey face na light square: 'light on right'.",
          },
          yo: {
            title: "Ẹ ku abọ",
            body: "Pátákó ṣẹẹsì ní àwọn ọ̀ọ̀ta mẹ́rìnlélọ́gọ́ta (64) — kọ́lámù mẹ́jọ (a sí h) àti ipele mẹ́jọ (1 sí 8). White máa ń wà ní ipele 1 àti 2, Black sì wà ní ipele 7 àti 8. Ọ̀ọ̀ta tí ó wà ní ìsàlẹ̀ apá ọ̀tún láti ojú-ìwòye White jẹ́ funfun: 'ìmọ́lẹ̀ ní apá ọ̀tún'.",
          },
          ha: {
            title: "Barka da zuwa",
            body: "Dashboard na chess yana da murabba'i 64 — layuka 8 (ginshiƙi a zuwa h) da matakai 8 (jeri 1 zuwa 8). White kan kasance a mataki 1-2, Black a mataki 7-8. Murabba'i na dama-kasa daga idon White fari ne: 'haske a dama'.",
          },
          ig: {
            title: "Nnọọ",
            body: "Bọọdụ chess nwere kwaza iri isii na anọ (64) — kọlụm asatọ (a ruo h) na ahịrị asatọ (ahịrị 1 ruo 8). Ọcha na-anọkarị n'ahịrị 1-2, Oji n'ahịrị 7-8. Kwaza dị n'ala aka nri site n'anya Ọcha bụ nke na-egbuke egbuke: 'ìhè n'aka nri'.",
          },
        },
      },
      {
        kind: "observe",
        fen: START_FEN,
        title: "Piece values",
        body: "Pawn = 1, Knight = 3, Bishop = 3, Rook = 5, Queen = 9. The King is priceless — losing it ends the game. These values guide trades: giving up a knight for a rook is usually a good deal.",
        translations: {
          pcm: {
            title: "How pieces get value",
            body: "Pawn = 1, Knight = 3, Bishop = 3, Rook = 5, Queen = 9. King no get price — if you lose am, game don finish. Dis values go help you sabi how to trade: if you give Knight take Rook, na correct deal be dat for many times.",
          },
          yo: {
            title: "Iye àwọn ohun èlò",
            body: "Pawn = 1, Knight = 3, Bishop = 3, Rook = 5, Queen = 9. King kò ní iye owó — bí ó bá sọnù, eré náà ti parí. Àwọn iye wọ̀nyí ni yóò ràn ọ́ lọ́wọ́ láti mọ ìgbà tí ó yẹ kí o pààrọ̀: fífi Knight pààrọ̀ fún Rook sábà máa ń jẹ́ ìpinnu tí ó dára.",
          },
          ha: {
            title: "Darajar sassa",
            body: "Pawn = 1, Knight = 3, Bishop = 3, Rook = 5, Queen = 9. King ba shi da daraja ta kuɗi — idan ya ɓace, wasan ya ƙare. Waɗannan darajoji suna taimaka maka wajen canji: ba da Knight don samun Rook yawanci kyakkyawan ciniki ne.",
          },
          ig: {
            title: "Uru ihe egwuregwu",
            body: "Pawn = 1, Knight = 3, Bishop = 3, Rook = 5, Queen = 9. King enweghị ọnụ ahịa — ọ bụrụ na i tufuo ya, egwuregwu akwụsị. Uru ndị a na-eduzi gị ka ị mara mgbe ị ga-agbanwe ihe: ị nyefee Knight ka inweta Rook na-abụkarị ezigbo mgbanwe.",
          },
        },
      },
      {
        kind: "observe",
        fen: START_FEN,
        title: "White to move first",
        body: "White always plays the first move. Then the players alternate. Ready to try one?",
        translations: {
          pcm: {
            title: "White dey start",
            body: "White dey always play di first move. Afta dat, di players go dey take turns. You ready to try one?",
          },
          yo: {
            title: "White ló kọ́kọ́ ṣeré",
            body: "White ni yóò kọ́kọ́ ṣeré nígbà gbogbo. Lẹ́yìn náà, àwọn tí ń ṣeré yóò máa yí padà. Ṣé o ti múra láti gbìyànjú ọ̀kan?",
          },
          ha: {
            title: "White ke farawa",
            body: "White kan fara wasa koyaushe. Sannan 'yan wasan za su riƙa musanyawa. Kana shirye ka gwada ɗaya?",
          },
          ig: {
            title: "Ọcha na-amalite",
            body: "Ọcha na-egwu nke mbụ mgbe niile. Mgbe ahụ, ndị na-egwu na-agbanwe. Ị dị njikere ịgbalị otu?",
          },
        },
      },
      {
        kind: "move",
        fen: START_FEN,
        title: "Open the center",
        body: "A classic first move is pushing the king's pawn two squares — e2 to e4. It controls the center and lets the bishop and queen out. Play 1. e4.",
        answer: "e2e4",
        hint: "e2",
        translations: {
          pcm: {
            title: "Open di center",
            body: "One classic first move na to push king pawn two squares — from e2 go e4. E go control di center and e go let Bishop and Queen comot. Play 1. e4.",
          },
          yo: {
            title: "Ṣí àárín gbùngbùn pátákó",
            body: "Ìṣísẹ̀ àkọ́kọ́ tí ó gbajúmọ̀ ni láti fa pawn ọba síwájú ọ̀ọ̀ta méjì — láti e2 sí e4. Ó máa ń ṣàkóso àárín gbùngbùn, ó sì máa ń jẹ́ kí Bishop àti Queen jáde. Ṣeré 1. e4.",
          },
          ha: {
            title: "Buɗe tsakiya",
            body: "Mataki na farko na gargajiya shi ne turawa pawn na king murabba'i biyu — daga e2 zuwa e4. Yana sarrafa tsakiya kuma yana barin Bishop da Queen su fito. Yi wasa 1. e4.",
          },
          ig: {
            title: "Mepee etiti",
            body: "Nkwalite izizi a na-ejikarị eme ihe bụ ịkwaga pawn eze kwaza abụọ — site na e2 ruo e4. Ọ na-achị etiti, ma na-ekwe ka Bishop na Queen pụọ. Gwuo 1. e4.",
          },
        },
      },
    ],
  },
  {
    id: "how-pieces-move",
    title: "How the Pieces Move",
    description: "Pawn, knight, bishop, rook, queen, and king — one at a time.",
    level: "starter",
    estimatedMinutes: 8,
    translations: {
      pcm: {
        title: "How Pieces Dey Move",
        description: "Pawn, Knight, Bishop, Rook, Queen, and King — one by one.",
      },
      yo: {
        title: "Bí Àwọn Ohun Èlò Ṣe Ń Rìn",
        description: "Pawn, Knight, Bishop, Rook, Queen, àti King — ọ̀kọ̀ọ̀kan.",
      },
      ha: {
        title: "Yadda Sassa Ke Motsi",
        description: "Pawn, Knight, Bishop, Rook, Queen, da King — ɗaya bayan ɗaya.",
      },
      ig: {
        title: "Otu Ihe Egwuregwu Si Akwaga",
        description: "Pawn, Knight, Bishop, Rook, Queen, na King — otu n'otu.",
      },
    },
    steps: [
      {
        kind: "move",
        fen: "8/8/8/8/8/8/4P3/4K3 w - - 0 1",
        title: "The pawn",
        body: "Pawns move forward one square, but on their first move they may go two. They capture diagonally. Push the pawn to e4.",
        answer: "e2e4",
        hint: "e2",
        translations: {
          pcm: {
            title: "Pawn",
            body: "Pawn dey waka forward one square, but for di first move e fit waka two squares. Dem dey capture for diagonal line. Push di pawn go e4.",
          },
          yo: {
            title: "Pawn",
            body: "Pawn máa ń lọ síwájú ọ̀ọ̀ta kan, ṣùgbọ́n ní ìṣísẹ̀ àkọ́kọ́ rẹ̀ ó lè lọ ọ̀ọ̀ta méjì. Ó máa ń gbá ní ọ̀nà agbékọ̀rí (diagonal). Fa pawn náà sí e4.",
          },
          ha: {
            title: "Pawn",
            body: "Pawn yana tafiya gaba murabba'i ɗaya, amma a mataki na farko yana iya tafiya biyu. Yana cin abu ta hanyar diagonal. Tura pawn zuwa e4.",
          },
          ig: {
            title: "Pawn",
            body: "Pawn na-aga n'ihu kwaza otu, mana na nkwalite izizi ya nwere ike ịga abụọ. Ọ na-ejide site n'ụzọ diagonal. Kwaga pawn ahụ gaa e4.",
          },
        },
      },
      {
        kind: "move",
        fen: "8/8/8/8/8/8/8/4K2N w - - 0 1",
        title: "The knight — L-shape",
        body: "Knights jump in an 'L': two squares one way, then one square perpendicular. They can leap over other pieces. Move the knight from h1 to f2.",
        answer: "h1f2",
        hint: "h1",
        translations: {
          pcm: {
            title: "Knight — di L-shape",
            body: "Knight dey jump for 'L' shape: two squares one way, den one square for side. Dem fit jump pass oda pieces. Move di Knight from h1 go f2.",
          },
          yo: {
            title: "Knight — ìrísí L",
            body: "Knight máa ń fò ní àpẹrẹ 'L': ọ̀ọ̀ta méjì ní ọ̀nà kan, lẹ́yìn náà ọ̀ọ̀ta kan ní apá kejì. Ó lè fò kọjá àwọn ohun èlò mìíràn. Gbé Knight láti h1 sí f2.",
          },
          ha: {
            title: "Knight — siffar L",
            body: "Knight yana tsalle a siffar 'L': murabba'i biyu wata hanya, sannan murabba'i ɗaya a gefe. Yana iya tsallaka wasu sassa. Matsar da Knight daga h1 zuwa f2.",
          },
          ig: {
            title: "Knight — ụdị L",
            body: "Knight na-amafe n'ụdị 'L': kwaza abụọ n'otu akụkụ, mgbe ahụ kwaza otu n'akụkụ ọzọ. O nwere ike ịgafe ihe egwuregwu ndị ọzọ. Kwaga Knight site na h1 gaa f2.",
          },
        },
      },
      {
        kind: "move",
        fen: "8/8/8/8/8/8/8/2B1K3 w - - 0 1",
        title: "The bishop — diagonals",
        body: "Bishops slide any distance along diagonals. A bishop always stays on squares of the same color. Move the bishop from c1 to h6.",
        answer: "c1h6",
        hint: "c1",
        translations: {
          pcm: {
            title: "Bishop — diagonal lines",
            body: "Bishop dey slide any distance for diagonal line. Bishop dey always stay for squares wey get same color. Move di Bishop from c1 go h6.",
          },
          yo: {
            title: "Bishop — ọ̀nà agbékọ̀rí",
            body: "Bishop lè rìn ní ìjìnnà èyíkéyìí ní ọ̀nà agbékọ̀rí (diagonal). Bishop máa ń wà ní àwọn ọ̀ọ̀ta tí àwọ̀ wọn jọra nígbà gbogbo. Gbé Bishop láti c1 sí h6.",
          },
          ha: {
            title: "Bishop — layin diagonal",
            body: "Bishop na iya zamewa a kowace nisa a kan layin diagonal. Bishop koyaushe yana zama a murabba'ai masu launi iri ɗaya. Matsar da Bishop daga c1 zuwa h6.",
          },
          ig: {
            title: "Bishop — ahịrị diagonal",
            body: "Bishop nwere ike ịme mbugharị n'ebe ọ bụla site n'ahịrị diagonal. Bishop na-anọkarị na kwaza nwere otu agba. Kwaga Bishop site na c1 gaa h6.",
          },
        },
      },
      {
        kind: "move",
        fen: "8/8/8/8/8/8/8/R3K3 w - - 0 1",
        title: "The rook — files & ranks",
        body: "Rooks slide any distance along files (up/down) and ranks (side to side). Move the rook from a1 to a8.",
        answer: "a1a8",
        hint: "a1",
        translations: {
          pcm: {
            title: "Rook — files and ranks",
            body: "Rook dey slide any distance for files (up/down) and ranks (side to side). Move di Rook from a1 go a8.",
          },
          yo: {
            title: "Rook — kọ́lámù àti ipele",
            body: "Rook lè rìn ní ìjìnnà èyíkéyìí ní orí kọ́lámù (sókè/sísàlẹ̀) àti ipele (láti apá sí apá). Gbé Rook láti a1 sí a8.",
          },
          ha: {
            title: "Rook — ginshiƙai da matakai",
            body: "Rook na iya zamewa a kowace nisa a kan ginshiƙai (sama/ƙasa) da matakai (gefe zuwa gefe). Matsar da Rook daga a1 zuwa a8.",
          },
          ig: {
            title: "Rook — kọlụm na ahịrị",
            body: "Rook nwere ike ịme mbugharị n'ebe ọ bụla site na kọlụm (elu/ala) na ahịrị (akụkụ gaa akụkụ). Kwaga Rook site na a1 gaa a8.",
          },
        },
      },
      {
        kind: "move",
        fen: "8/8/8/8/8/8/8/3QK3 w - - 0 1",
        title: "The queen — most powerful",
        body: "The queen combines rook and bishop — any distance along ranks, files, or diagonals. Slide the queen from d1 to h5.",
        answer: "d1h5",
        hint: "d1",
        translations: {
          pcm: {
            title: "Queen — di strongest piece",
            body: "Queen dey combine Rook and Bishop power — e fit go any distance for ranks, files, or diagonal. Slide di Queen from d1 go h5.",
          },
          yo: {
            title: "Queen — alágbára jùlọ",
            body: "Queen ní agbára Rook àti Bishop papọ̀ — ó lè rìn ní ìjìnnà èyíkéyìí ní orí ipele, kọ́lámù, tàbí agbékọ̀rí. Fa Queen láti d1 sí h5.",
          },
          ha: {
            title: "Queen — mafi ƙarfi",
            body: "Queen tana haɗa ikon Rook da Bishop — tana iya tafiya kowace nisa a matakai, ginshiƙai, ko diagonal. Matsar da Queen daga d1 zuwa h5.",
          },
          ig: {
            title: "Queen — ike kacha ike",
            body: "Queen na-ejikọta ike Rook na Bishop — ọ nwere ike ịga ebe ọ bụla site n'ahịrị, kọlụm, ma ọ bụ diagonal. Kwaga Queen site na d1 gaa h5.",
          },
        },
      },
      {
        kind: "move",
        fen: "8/8/8/8/8/8/8/4K3 w - - 0 1",
        title: "The king — one step",
        body: "The king moves one square in any direction. Protect it at all costs. Move the king from e1 to e2.",
        answer: "e1e2",
        hint: "e1",
        translations: {
          pcm: {
            title: "King — one step",
            body: "King dey waka one square for any direction. Protect am well well. Move di King from e1 go e2.",
          },
          yo: {
            title: "King — ìṣísẹ̀ kan",
            body: "King máa ń lọ ọ̀ọ̀ta kan ní ìtọ́sọ́nà èyíkéyìí. Dáàbò bò ó dáradára. Gbé King láti e1 sí e2.",
          },
          ha: {
            title: "King — mataki ɗaya",
            body: "King yana tafiya murabba'i ɗaya a kowace hanya. Kiyaye shi da kowane farashi. Matsar da King daga e1 zuwa e2.",
          },
          ig: {
            title: "King — otu nzọụkwụ",
            body: "King na-aga kwaza otu n'ebe ọ bụla. Chebe ya nke ọma. Kwaga King site na e1 gaa e2.",
          },
        },
      },
    ],
  },
  {
    id: "check-and-checkmate",
    title: "Check, Checkmate & Stalemate",
    description: "Recognise threats to the king and how the game ends.",
    level: "beginner",
    estimatedMinutes: 6,
    translations: {
      pcm: {
        title: "Check, Checkmate & Stalemate",
        description: "Sabi how to see threat to King and how game dey end.",
      },
      yo: {
        title: "Check, Checkmate & Stalemate",
        description: "Mọ bí a ṣe ń ṣe ìhàlẹ̀ mọ́ ọba àti bí eré ṣe ń parí.",
      },
      ha: {
        title: "Check, Checkmate & Stalemate",
        description: "Gane barazana ga king da yadda wasan yake ƙarewa.",
      },
      ig: {
        title: "Check, Checkmate & Stalemate",
        description: "Mata otu esi amata iyi egwu nye king na otu egwuregwu si agwụ.",
      },
    },
    steps: [
      {
        kind: "observe",
        fen: "4k3/8/4K3/4Q3/8/8/8/8 w - - 0 1",
        title: "What is check?",
        body: "A king is in 'check' when it is attacked. The player in check must respond: move the king, block the attack, or capture the attacker.",
        translations: {
          pcm: {
            title: "Wetin be check?",
            body: "King dey 'check' when dem dey attack am. Di player wey dey check must respond: move di King, block di attack, or capture di piece wey dey attack.",
          },
          yo: {
            title: "Kín ni 'check'?",
            body: "King wà ní 'check' nígbà tí wọ́n bá kọlu rẹ̀. Olùṣeré tí ó wà ní 'check' gbọ́dọ̀ dáhùn: gbé king náà, dí ìkọlù náà, tàbí gbá ohun èlò tí ó ń kọlù.",
          },
          ha: {
            title: "Mene ne 'check'?",
            body: "King yana cikin 'check' idan an kai masa hari. Dole ɗan wasan da ke cikin check ya mayar da martani: ya matsar da king, ya toshe harin, ko ya kama abin da ke kai harin.",
          },
          ig: {
            title: "Gịnị bụ 'check'?",
            body: "King nọ na 'check' mgbe a na-awakpo ya. Onye na-egwu nọ na check ga-aghaghị ime ihe: kwaga king, gbochie mwakpo ahụ, ma ọ bụ jide ihe na-awakpo.",
          },
        },
      },
      {
        kind: "move",
        fen: "4k3/8/4K3/4Q3/8/8/8/8 w - - 0 1",
        title: "Deliver checkmate",
        body: "Black's king on e8 has nowhere to run — the white king covers the escape squares. Move your queen to e7 and it's checkmate: attacked, and no legal reply.",
        answer: "e5e7",
        hint: "e5",
        translations: {
          pcm: {
            title: "Give checkmate",
            body: "Black King wey dey e8 no get where to run — White King dey cover di escape squares. Move your Queen go e7 and na checkmate: dem attack am, no legal answer remain.",
          },
          yo: {
            title: "Ṣe 'checkmate'",
            body: "King Black tí ó wà ní e8 kò ní ibi tí yóò sá lọ — King White ti bo gbogbo ọ̀ọ̀ta tí ó lè sá lọ sí. Gbé Queen rẹ sí e7, ó sì jẹ́ 'checkmate': ó ti kọlù, kò sì ṣí ìdáhùn tó bófin mu mọ́.",
          },
          ha: {
            title: "Yi checkmate",
            body: "King na Black da ke e8 babu inda zai gudu — King na White ya rufe dukkan murabba'an tsira. Matsar da Queen zuwa e7, kuma shi ne checkmate: an kai masa hari, babu amsa bisa doka.",
          },
          ig: {
            title: "Mee checkmate",
            body: "King Oji nọ n'e8 enweghị ebe ọ ga-agba ọsọ gaa — King Ọcha ekpuchiela kwaza nile ọ ga-agbanarị. Kwaga Queen gị gaa e7, ọ bụrụ 'checkmate': a wakpo ya, enweghịkwa ọsịsa ziri ezi.",
          },
        },
      },
      {
        kind: "observe",
        fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
        title: "Stalemate — a draw",
        body: "If it's your turn and you have NO legal move but you are NOT in check, that's stalemate — the game is drawn. Beware of stalemating a losing opponent.",
        translations: {
          pcm: {
            title: "Stalemate — na draw",
            body: "If na your turn and you no get any legal move but you no dey check, na stalemate — game don draw. Make you dey careful make you no stalemate opponent wey dey lose.",
          },
          yo: {
            title: "Stalemate — eré tí kò burú",
            body: "Bí ó bá jẹ́ yípo rẹ, tí o kò sì ní ìṣísẹ̀ tí ó bófin mu, ṣùgbọ́n o KÒ sí nínú 'check', ìyẹn ni stalemate — eré náà di 'draw'. Ṣọ́ra kí o má ṣe fi stalemate pa alátakò tí ó fẹ́ ṣẹ́gùn.",
          },
          ha: {
            title: "Stalemate — daidaituwa",
            body: "Idan ya zo lokacinka kuma babu wani mataki bisa doka amma kai BA cikin check ba, wannan stalemate ne — wasan ya zama daidai. Ka yi hankali kada ka kai abokin hamayya da zai rasa zuwa stalemate.",
          },
          ig: {
            title: "Stalemate — nhazi",
            body: "Ọ bụrụ na ọ bụ oge gị ma ị nweghị nzọụkwụ ziri ezi ọ bụla ma ị NỌGHỊ na check, nke ahụ bụ stalemate — egwuregwu agbaa 'draw'. Kpachara anya ka ị ghara ime onye na-emeri stalemate.",
          },
        },
      },
      {
        kind: "move",
        fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
        title: "Back-rank mate",
        body: "Black's king is trapped behind its own pawns on the 8th rank. Slide the rook to e8 for mate.",
        answer: "e1e8",
        hint: "e1",
        translations: {
          pcm: {
            title: "Back-rank mate",
            body: "Black King don trap behind im own pawns for di 8th rank. Slide di Rook go e8 make mate.",
          },
          yo: {
            title: "Back-rank mate",
            body: "King Black ti dí sí ẹ̀yìn àwọn pawn tirẹ̀ ní ipele kẹjọ. Fa Rook sí e8 fún mate.",
          },
          ha: {
            title: "Back-rank mate",
            body: "King na Black ya makale a bayan pawns nasa a mataki na 8. Matsar da Rook zuwa e8 don mate.",
          },
          ig: {
            title: "Back-rank mate",
            body: "King Oji dabara n'azụ pawn ya n'ahịrị nke asatọ. Kwaga Rook gaa e8 maka mate.",
          },
        },
      },
    ],
  },
  {
    id: "special-moves",
    title: "Special Moves",
    description: "Castling, en passant, and pawn promotion.",
    level: "beginner",
    estimatedMinutes: 6,
    translations: {
      pcm: { title: "Special Moves", description: "Castling, en passant, and pawn promotion." },
      yo: { title: "Àwọn Ìṣísẹ̀ Pàtàkì", description: "Castling, en passant, àti ìgbéga pawn." },
      ha: { title: "Matakai Na Musamman", description: "Castling, en passant, da haɓakar pawn." },
      ig: { title: "Nkwalite Pụrụ Iche", description: "Castling, en passant, na mbuli pawn elu." },
    },
    steps: [
      {
        kind: "observe",
        fen: "r3k2r/pppqbppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQBPPP/R3K2R w KQkq - 0 1",
        title: "Castling",
        body: "Castling gets your king to safety and activates a rook in one move. Requirements: neither piece has moved, no pieces between them, the king isn't in check and doesn't pass through check.",
        translations: {
          pcm: {
            title: "Castling",
            body: "Castling dey take your King go safe place and e dey activate Rook for one move. Wetin you need: both pieces no don move before, no piece dey between dem, King no dey check and e no go pass through check.",
          },
          yo: {
            title: "Castling",
            body: "Castling máa ń mú king rẹ lọ sí ààbò, ó sì ń mú rook ṣiṣẹ́ pẹ̀lú ìṣísẹ̀ kan ṣoṣo. Àwọn ohun tí a nílò: ẹ̀yọ méjèèjì kò tí ì rìn rí, kò sí ohun èlò láàrín wọn, king kò sí nínú 'check' kò sì kọjá nípasẹ̀ 'check'.",
          },
          ha: {
            title: "Castling",
            body: "Castling yana kai king ɗinka cikin aminci kuma yana kunna rook da mataki ɗaya. Abin da ake bukata: babu wani sashe da ya taɓa motsi, babu sashe tsakanin su, king ba ya cikin check kuma ba ya wucewa ta cikin check.",
          },
          ig: {
            title: "Castling",
            body: "Castling na-eweta king gị n'ebe nchebe ma na-emeghe rook n'otu nkwalite. Ihe achọrọ: ọ dịghị akụkụ ọ bụla kwagara, ọ dịghị ihe dị n'etiti ha, king anọghị na check ma ọ naghị agafe na check.",
          },
        },
      },
      {
        kind: "move",
        fen: "r3k2r/pppqbppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQBPPP/R3K2R w KQkq - 0 1",
        title: "Castle kingside",
        body: "Move your king from e1 to g1. The rook on h1 automatically hops to f1. Try it now.",
        answer: "e1g1",
        hint: "e1",
        translations: {
          pcm: {
            title: "Castle kingside",
            body: "Move your King from e1 go g1. Di Rook wey dey h1 go automatic jump go f1. Try am now.",
          },
          yo: {
            title: "Ṣe castle ní apá king",
            body: "Gbé king rẹ láti e1 sí g1. Rook tí ó wà ní h1 yóò fò lọ sí f1 láìfọwọ́kánlẹ̀. Gbìyànjú rẹ̀ nísinsìnyí.",
          },
          ha: {
            title: "Yi castle a gefen king",
            body: "Matsar da king ɗinka daga e1 zuwa g1. Rook da yake h1 zai yi tsalle zuwa f1 kai tsaye. Gwada yanzu.",
          },
          ig: {
            title: "Mee castle n'akụkụ king",
            body: "Kwaga king gị site na e1 gaa g1. Rook nọ na h1 ga-amafe gaa f1 n'onwe ya. Nwaa ya ugbu a.",
          },
        },
      },
      {
        kind: "observe",
        fen: "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3",
        title: "En passant",
        body: "When a Black pawn moves two squares and lands beside your pawn (like d7-d5 next to your e5 pawn), you can capture it 'in passing' on the very next move — as if it moved one square.",
        translations: {
          pcm: {
            title: "En passant",
            body: "If Black pawn waka two squares and e land beside your pawn (like d7-d5 wey dey beside your e5 pawn), you fit capture am 'in passing' for di next move — as if e waka only one square.",
          },
          yo: {
            title: "En passant",
            body: "Nígbà tí pawn Black bá lọ ọ̀ọ̀ta méjì tí ó sì dúró lẹ́gbẹ̀ẹ́ pawn rẹ (bí d7-d5 lẹ́gbẹ̀ẹ́ pawn e5 rẹ), o lè gbá a 'ní ìlọ́pọ̀' ní ìṣísẹ̀ tí ó tẹ̀lé — bí ẹni pé ó lọ ọ̀ọ̀ta kan ṣoṣo.",
          },
          ha: {
            title: "En passant",
            body: "Idan pawn na Black ya tafi murabba'i biyu ya sauka kusa da pawn naka (kamar d7-d5 kusa da pawn naka na e5), kana iya kama shi 'a hanya' a mataki na gaba — kamar dai ya tafi murabba'i ɗaya kawai.",
          },
          ig: {
            title: "En passant",
            body: "Mgbe pawn Oji kwagara kwaza abụọ ma rue n'akụkụ pawn gị (dịka d7-d5 n'akụkụ pawn gị nke e5), ị nwere ike ijide ya 'n'agafe' na nkwalite na-esote — dịka a ga-asị na ọ kwagara kwaza otu.",
          },
        },
      },
      {
        kind: "move",
        fen: "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3",
        title: "Capture en passant",
        body: "Take the d5 pawn with your e5 pawn by moving to d6.",
        answer: "e5d6",
        hint: "e5",
        translations: {
          pcm: {
            title: "Capture en passant",
            body: "Take di d5 pawn with your e5 pawn by moving go d6.",
          },
          yo: {
            title: "Gbá en passant",
            body: "Gbá pawn d5 pẹ̀lú pawn e5 rẹ nípa gbígbé lọ sí d6.",
          },
          ha: {
            title: "Kama en passant",
            body: "Kama pawn na d5 da pawn naka na e5 ta hanyar matsawa zuwa d6.",
          },
          ig: {
            title: "Jide en passant",
            body: "Jide pawn d5 site na pawn gị e5 site n'ịkwaga gaa d6.",
          },
        },
      },
      {
        kind: "move",
        fen: "8/P7/8/8/8/8/8/4K2k w - - 0 1",
        title: "Promotion",
        body: "When a pawn reaches the last rank it MUST promote — almost always to a queen. Push your a7 pawn to a8 and promote.",
        answer: "a7a8q",
        hint: "a7",
        translations: {
          pcm: {
            title: "Promotion",
            body: "If pawn reach di last rank, e MUST promote — most time to Queen. Push your a7 pawn go a8 and promote am.",
          },
          yo: {
            title: "Ìgbéga (Promotion)",
            body: "Nígbà tí pawn bá dé ipele tí ó kẹyìn, ó GBỌ́DỌ̀ di ohun mìíràn — ní ọ̀pọ̀ ìgbà di Queen. Fa pawn a7 rẹ sí a8 kí o sì gbé e ga.",
          },
          ha: {
            title: "Haɓakawa (Promotion)",
            body: "Idan pawn ya kai mataki na ƙarshe, dole ne ya canza — galibi zuwa Queen. Tura pawn naka na a7 zuwa a8 sannan ka haɓaka shi.",
          },
          ig: {
            title: "Mbuli elu (Promotion)",
            body: "Mgbe pawn ruru ahịrị ikpeazụ, ọ GHAGHỊ ịgbanwe — na ọtụtụ oge ọ na-aghọ Queen. Kwaga pawn gị nke a7 gaa a8 wee bulie ya elu.",
          },
        },
      },
    ],
  },
  {
    id: "opening-principles",
    title: "Opening Principles",
    description: "Control the center, develop pieces, get your king safe.",
    level: "beginner",
    estimatedMinutes: 7,
    translations: {
      pcm: {
        title: "Opening Principles",
        description: "Control di center, develop your pieces, make your King safe.",
      },
      yo: {
        title: "Òfin Ìbẹ̀rẹ̀ Eré",
        description: "Ṣàkóso àárín gbùngbùn, mú àwọn ohun èlò rẹ jáde, mú kí king rẹ wà láìléwu.",
      },
      ha: {
        title: "Ƙa'idojin Buɗewa",
        description: "Mallaki tsakiya, haɓaka sassa, kuma kiyaye king lafiya.",
      },
      ig: {
        title: "Iwu Mmalite Egwuregwu",
        description: "Chịkwaa etiti, zụlite ihe egwuregwu gị, mee ka king gị dị ndu.",
      },
    },
    steps: [
      {
        kind: "move",
        fen: START_FEN,
        title: "1. Control the center",
        body: "Your first job is to fight for the four central squares (d4, e4, d5, e5). Push a central pawn — try 1. e4.",
        answer: "e2e4",
        hint: "e2",
        translations: {
          pcm: {
            title: "1. Control di center",
            body: "Your first work na to fight for di four center squares (d4, e4, d5, e5). Push one center pawn — try 1. e4.",
          },
          yo: {
            title: "1. Ṣàkóso àárín gbùngbùn",
            body: "Iṣẹ́ àkọ́kọ́ rẹ ni láti jà fún àwọn ọ̀ọ̀ta àárín mẹ́rin (d4, e4, d5, e5). Fa pawn àárín kan síwájú — gbìyànjú 1. e4.",
          },
          ha: {
            title: "1. Mallaki tsakiya",
            body: "Aikinka na farko shi ne yin yaƙi don murabba'ai huɗu na tsakiya (d4, e4, d5, e5). Tura pawn na tsakiya — gwada 1. e4.",
          },
          ig: {
            title: "1. Chịkwaa etiti",
            body: "Ọrụ mbụ gị bụ ịlụ ọgụ maka kwaza etiti anọ (d4, e4, d5, e5). Kwaga pawn etiti — nwaa 1. e4.",
          },
        },
      },
      {
        kind: "move",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        title: "2. Develop a knight",
        body: "Knights before bishops. Bring the knight to f3 — it attacks the center and prepares to castle.",
        answer: "g1f3",
        hint: "g1",
        translations: {
          pcm: {
            title: "2. Develop Knight",
            body: "Knight before Bishop. Bring di Knight go f3 — e go attack di center and e go prepare for castle.",
          },
          yo: {
            title: "2. Mú Knight jáde",
            body: "Knight ṣáájú Bishop. Mú knight wá sí f3 — ó máa ń kọlu àárín gbùngbùn, ó sì ń ṣe ìmúrasílẹ̀ fún castling.",
          },
          ha: {
            title: "2. Haɓaka Knight",
            body: "Knight kafin Bishop. Kawo Knight zuwa f3 — yana kai hari tsakiya kuma yana shirya castling.",
          },
          ig: {
            title: "2. Zụlite Knight",
            body: "Knight tupu Bishop. Kpọta Knight gaa f3 — ọ na-awakpo etiti ma na-akwado castling.",
          },
        },
      },
      {
        kind: "move",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
        title: "3. Black develops too",
        body: "Black plays 2...Nc6 to defend the e5 pawn and control d4. (Click Next.)",
        answer: "b8c6",
        hint: "b8",
        translations: {
          pcm: {
            title: "3. Black sef dey develop",
            body: "Black go play 2...Nc6 to defend di e5 pawn and control d4. (Click Next.)",
          },
          yo: {
            title: "3. Black náà ń mú ohun èlò jáde",
            body: "Black ṣeré 2...Nc6 láti dáàbò bo pawn e5 àti láti ṣàkóso d4. (Tẹ Next.)",
          },
          ha: {
            title: "3. Black ma yana haɓakawa",
            body: "Black yana yin 2...Nc6 don kare pawn na e5 da mallaki d4. (Danna Next.)",
          },
          ig: {
            title: "3. Oji na-azụlitekwa",
            body: "Oji na-egwu 2...Nc6 iji chebe pawn e5 ma chịkwaa d4. (Pịa Next.)",
          },
        },
      },
      {
        kind: "move",
        fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
        title: "4. Bishop out",
        body: "Develop a bishop where it eyes the enemy king. Bb5 pins the knight against Black's king — this is the Ruy López.",
        answer: "f1b5",
        hint: "f1",
        translations: {
          pcm: {
            title: "4. Bishop comot",
            body: "Develop Bishop go where e fit face enemy King. Bb5 go pin Knight against Black King — na dis be Ruy López.",
          },
          yo: {
            title: "4. Mú Bishop jáde",
            body: "Mú bishop jáde sí ibi tí yóò ti ojú lé king ọ̀tá. Bb5 máa ń dí knight mọ́ king Black — èyí ni Ruy López.",
          },
          ha: {
            title: "4. Fitar da Bishop",
            body: "Haɓaka Bishop zuwa inda zai fuskanci king na abokin gaba. Bb5 yana daure Knight da king na Black — wannan shi ne Ruy López.",
          },
          ig: {
            title: "4. Mee ka Bishop pụọ",
            body: "Zụlite Bishop gaa ebe ọ ga-ele king onye iro anya. Bb5 na-ejide Knight megide king Oji — nke a bụ Ruy López.",
          },
        },
      },
      {
        kind: "observe",
        fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 3 3",
        title: "5. Castle soon",
        body: "With both minor pieces out, castling is next — that tucks the king away and connects the rooks. The three rules: center, development, king safety. Follow them and you'll survive most openings.",
        translations: {
          pcm: {
            title: "5. Castle quick quick",
            body: "Now wey both minor pieces don comot, castling na next tin — e go hide King well and e go connect di Rooks. Di three rules: center, development, King safety. Follow dem and you go survive most openings.",
          },
          yo: {
            title: "5. Ṣe castle láìpẹ́",
            body: "Bí àwọn ohun èlò kékeré méjèèjì ti jáde tán, castling ni ó tẹ̀lé — ó máa ń fi king pamọ́ ó sì ń so àwọn rook pọ̀. Òfin mẹ́ta: àárín gbùngbùn, ìmúdàgbàsókè, àbo king. Tẹ̀lé wọn, o óò sì la ọ̀pọ̀lọ́pọ̀ ìbẹ̀rẹ̀ eré já.",
          },
          ha: {
            title: "5. Yi castle da sauri",
            body: "Da yake ƙananan sassa biyu sun fita, castling ne na gaba — yana ɓoye king kuma yana haɗa Rooks. Dokoki uku: tsakiya, haɓakawa, amincin king. Bi su za ka tsira daga yawancin buɗewa.",
          },
          ig: {
            title: "5. Mee castle ngwa ngwa",
            body: "Ebe ihe egwuregwu nta abụọ ahụ apụọla, castling bụ ihe na-esote — ọ na-ezobe king ma jikọọ Rooks. Iwu atọ: etiti, mmepe, nchekwa king. Soro ha, ị ga-adịkwa ndụ n'ọtụtụ mmalite egwuregwu.",
          },
        },
      },
    ],
  },
];

export function getTutorial(id: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.id === id);
}

export const TUTORIALS: Tutorial[] = [...BASICS, ...MIDDLEGAME_TUTORIALS];

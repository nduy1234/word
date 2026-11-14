/**
 * Seed content for Word. Pure data — no IWSDK imports, unit-testable.
 * Target language: English (CEFR A1–A2). Helper hints: es + vi.
 * Full packs ship as packs/en/{room}.json later; this seeds the M1 slice.
 * `article` is stored in data ("a" | "an"), never computed at runtime.
 */
export interface WordEntry {
  id: string;
  word: string;
  ipa: string;
  partOfSpeech: 'noun' | 'verb' | 'phrasalVerb' | 'preposition' | 'adjective';
  plural?: string;
  article?: 'a' | 'an';
  cefr: 'A1' | 'A2';
  example: string;
  helper: { es: string; vi: string };
  sceneLabel?: string;
  propId?: string;
  wakeFx: string;
  rarity: 'common' | 'rare' | 'gold';
  audio: string;
}

export const ROOM_WORDS: WordEntry[] = [
  { id: 'table', word: 'table', ipa: '/ˈteɪbəl/', partOfSpeech: 'noun', plural: 'tables', article: 'a', cefr: 'A1', example: 'The table is big.', helper: { es: 'la mesa', vi: 'cái bàn' }, sceneLabel: 'table', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/table.wav' },
  { id: 'wall', word: 'wall', ipa: '/wɔːl/', partOfSpeech: 'noun', plural: 'walls', article: 'a', cefr: 'A1', example: 'The wall is white.', helper: { es: 'la pared', vi: 'bức tường' }, sceneLabel: 'wall', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/wall.wav' },
  { id: 'floor', word: 'floor', ipa: '/flɔːr/', partOfSpeech: 'noun', plural: 'floors', article: 'a', cefr: 'A1', example: 'The floor is clean.', helper: { es: 'el suelo', vi: 'sàn nhà' }, sceneLabel: 'floor', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/floor.wav' },
  { id: 'ceiling', word: 'ceiling', ipa: '/ˈsiːlɪŋ/', partOfSpeech: 'noun', plural: 'ceilings', article: 'a', cefr: 'A2', example: 'The ceiling is high.', helper: { es: 'el techo', vi: 'trần nhà' }, sceneLabel: 'ceiling', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/ceiling.wav' },
  { id: 'door', word: 'door', ipa: '/dɔːr/', partOfSpeech: 'noun', plural: 'doors', article: 'a', cefr: 'A1', example: 'The door is closed.', helper: { es: 'la puerta', vi: 'cửa' }, sceneLabel: 'door', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/door.wav' },
  { id: 'window', word: 'window', ipa: '/ˈwɪndoʊ/', partOfSpeech: 'noun', plural: 'windows', article: 'a', cefr: 'A1', example: 'The window is open.', helper: { es: 'la ventana', vi: 'cửa sổ' }, sceneLabel: 'window', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/window.wav' },
  { id: 'couch', word: 'couch', ipa: '/kaʊtʃ/', partOfSpeech: 'noun', plural: 'couches', article: 'a', cefr: 'A1', example: 'The couch is soft.', helper: { es: 'el sofá', vi: 'ghế sofa' }, sceneLabel: 'couch', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/couch.wav' },
  { id: 'lamp', word: 'lamp', ipa: '/læmp/', partOfSpeech: 'noun', plural: 'lamps', article: 'a', cefr: 'A1', example: 'The lamp is on.', helper: { es: 'la lámpara', vi: 'đèn' }, sceneLabel: 'lamp', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/lamp.wav' },
  { id: 'plant', word: 'plant', ipa: '/plænt/', partOfSpeech: 'noun', plural: 'plants', article: 'a', cefr: 'A1', example: 'The plant is green.', helper: { es: 'la planta', vi: 'cây' }, sceneLabel: 'plant', wakeFx: 'bloom', rarity: 'rare', audio: 'assets/audio/en-US/plant.wav' },
  { id: 'screen', word: 'screen', ipa: '/skriːn/', partOfSpeech: 'noun', plural: 'screens', article: 'a', cefr: 'A1', example: 'The screen is big.', helper: { es: 'la pantalla', vi: 'màn hình' }, sceneLabel: 'screen', wakeFx: 'bloom', rarity: 'rare', audio: 'assets/audio/en-US/screen.wav' },
  { id: 'bed', word: 'bed', ipa: '/bed/', partOfSpeech: 'noun', plural: 'beds', article: 'a', cefr: 'A1', example: 'The bed is small.', helper: { es: 'la cama', vi: 'giường' }, sceneLabel: 'bed', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/bed.wav' },
  { id: 'shelf', word: 'shelf', ipa: '/ʃelf/', partOfSpeech: 'noun', plural: 'shelves', article: 'a', cefr: 'A2', example: 'The shelf is high.', helper: { es: 'la estantería', vi: 'kệ' }, sceneLabel: 'storage', wakeFx: 'bloom', rarity: 'rare', audio: 'assets/audio/en-US/shelf.wav' },
];

export const KITCHEN_PROPS: WordEntry[] = [
  { id: 'cup', word: 'cup', ipa: '/kʌp/', partOfSpeech: 'noun', plural: 'cups', article: 'a', cefr: 'A1', example: 'The cup is hot.', helper: { es: 'la taza', vi: 'cái cốc' }, propId: 'cup', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/cup.wav' },
  { id: 'plate', word: 'plate', ipa: '/pleɪt/', partOfSpeech: 'noun', plural: 'plates', article: 'a', cefr: 'A1', example: 'The plate is empty.', helper: { es: 'el plato', vi: 'cái đĩa' }, propId: 'plate', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/plate.wav' },
  { id: 'apple', word: 'apple', ipa: '/ˈæpəl/', partOfSpeech: 'noun', plural: 'apples', article: 'an', cefr: 'A1', example: 'The apple is red.', helper: { es: 'la manzana', vi: 'quả táo' }, propId: 'apple', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/apple.wav' },
  { id: 'chair', word: 'chair', ipa: '/tʃer/', partOfSpeech: 'noun', plural: 'chairs', article: 'a', cefr: 'A1', example: 'The chair is small.', helper: { es: 'la silla', vi: 'cái ghế' }, propId: 'chair', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/chair.wav' },
  { id: 'book', word: 'book', ipa: '/bʊk/', partOfSpeech: 'noun', plural: 'books', article: 'a', cefr: 'A1', example: 'The book is new.', helper: { es: 'el libro', vi: 'quyển sách' }, propId: 'book', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/book.wav' },
];

export const CAFE_PROPS: WordEntry[] = [
  { id: 'milk', word: 'milk', ipa: '/mɪlk/', partOfSpeech: 'noun', plural: 'milks', cefr: 'A1', example: 'The milk is cold.', helper: { es: 'la leche', vi: 'sữa' }, propId: 'milk', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/milk.wav' },
  { id: 'tea', word: 'tea', ipa: '/tiː/', partOfSpeech: 'noun', plural: 'teas', cefr: 'A1', example: 'The tea is hot.', helper: { es: 'el té', vi: 'trà' }, propId: 'tea', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/tea.wav' },
  { id: 'cake', word: 'cake', ipa: '/keɪk/', partOfSpeech: 'noun', plural: 'cakes', article: 'a', cefr: 'A1', example: 'The cake is sweet.', helper: { es: 'el pastel', vi: 'bánh' }, propId: 'cake', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/cake.wav' },
  { id: 'bread', word: 'bread', ipa: '/bred/', partOfSpeech: 'noun', plural: 'breads', cefr: 'A1', example: 'The bread is new.', helper: { es: 'el pan', vi: 'bánh mì' }, propId: 'bread', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/bread.wav' },
  { id: 'egg', word: 'egg', ipa: '/eɡ/', partOfSpeech: 'noun', plural: 'eggs', article: 'an', cefr: 'A1', example: 'The egg is small.', helper: { es: 'el huevo', vi: 'trứng' }, propId: 'egg', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/egg.wav' },
  { id: 'cheese', word: 'cheese', ipa: '/tʃiːz/', partOfSpeech: 'noun', plural: 'cheeses', cefr: 'A1', example: 'The cheese is good.', helper: { es: 'el queso', vi: 'phô mai' }, propId: 'cheese', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/cheese.wav' },
  { id: 'juice', word: 'juice', ipa: '/dʒuːs/', partOfSpeech: 'noun', plural: 'juices', cefr: 'A1', example: 'The juice is cold.', helper: { es: 'el jugo', vi: 'nước ép' }, propId: 'juice', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/juice.wav' },
  { id: 'water', word: 'water', ipa: '/ˈwɔːtər/', partOfSpeech: 'noun', plural: 'waters', cefr: 'A1', example: 'The water is cold.', helper: { es: 'el agua', vi: 'nước' }, propId: 'water', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/water.wav' },
  { id: 'spoon', word: 'spoon', ipa: '/spuːn/', partOfSpeech: 'noun', plural: 'spoons', article: 'a', cefr: 'A1', example: 'The spoon is small.', helper: { es: 'la cuchara', vi: 'thìa' }, propId: 'spoon', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/spoon.wav' },
  { id: 'fork', word: 'fork', ipa: '/fɔːrk/', partOfSpeech: 'noun', plural: 'forks', article: 'a', cefr: 'A1', example: 'The fork is new.', helper: { es: 'el tenedor', vi: 'nĩa' }, propId: 'fork', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/fork.wav' },
  { id: 'sugar', word: 'sugar', ipa: '/ˈʃʊɡər/', partOfSpeech: 'noun', plural: 'sugars', cefr: 'A1', example: 'The sugar is sweet.', helper: { es: 'el azúcar', vi: 'đường' }, propId: 'sugar', wakeFx: 'bloom', rarity: 'common', audio: 'assets/audio/en-US/sugar.wav' },
  { id: 'menu', word: 'menu', ipa: '/ˈmenjuː/', partOfSpeech: 'noun', plural: 'menus', article: 'a', cefr: 'A2', example: 'The menu is new.', helper: { es: 'el menú', vi: 'thực đơn' }, propId: 'menu', wakeFx: 'bloom', rarity: 'rare', audio: 'assets/audio/en-US/menu.wav' },
];

export const VERBS: WordEntry[] = [
  { id: 'open', word: 'open', ipa: '/ˈoʊpən/', partOfSpeech: 'verb', cefr: 'A1', example: 'Open the door.', helper: { es: 'abre', vi: 'mở' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/open.wav' },
  { id: 'close', word: 'close', ipa: '/kloʊz/', partOfSpeech: 'verb', cefr: 'A1', example: 'Close the window.', helper: { es: 'cierra', vi: 'đóng' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/close.wav' },
  { id: 'touch', word: 'touch', ipa: '/tʌtʃ/', partOfSpeech: 'verb', cefr: 'A1', example: 'Touch the table.', helper: { es: 'toca', vi: 'chạm' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/touch.wav' },
  { id: 'look', word: 'look', ipa: '/lʊk/', partOfSpeech: 'verb', cefr: 'A1', example: 'Look at the plant.', helper: { es: 'mira', vi: 'nhìn' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/look.wav' },
  { id: 'put', word: 'put', ipa: '/pʊt/', partOfSpeech: 'verb', cefr: 'A1', example: 'Put the cup on the table.', helper: { es: 'pon', vi: 'đặt' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/put.wav' },
  { id: 'take', word: 'take', ipa: '/teɪk/', partOfSpeech: 'verb', cefr: 'A1', example: 'Take the book.', helper: { es: 'toma', vi: 'lấy' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/take.wav' },
  { id: 'find', word: 'find', ipa: '/faɪnd/', partOfSpeech: 'verb', cefr: 'A1', example: 'Find the cup.', helper: { es: 'encuentra', vi: 'tìm' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/find.wav' },
  { id: 'wake', word: 'wake', ipa: '/weɪk/', partOfSpeech: 'verb', cefr: 'A2', example: 'Wake the lamp.', helper: { es: 'despierta', vi: 'đánh thức' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/wake.wav' },
];

export const PHRASAL_VERBS: WordEntry[] = [
  { id: 'turn-on', word: 'turn on', ipa: '/tɜːrn ɑːn/', partOfSpeech: 'phrasalVerb', cefr: 'A1', example: 'Turn on the lamp.', helper: { es: 'enciende', vi: 'bật' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/turn-on.wav' },
  { id: 'turn-off', word: 'turn off', ipa: '/tɜːrn ɔːf/', partOfSpeech: 'phrasalVerb', cefr: 'A1', example: 'Turn off the lamp.', helper: { es: 'apaga', vi: 'tắt' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/turn-off.wav' },
  { id: 'pick-up', word: 'pick up', ipa: '/pɪk ʌp/', partOfSpeech: 'phrasalVerb', cefr: 'A1', example: 'Pick up the cup.', helper: { es: 'recoge', vi: 'nhặt lên' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/pick-up.wav' },
  { id: 'put-down', word: 'put down', ipa: '/pʊt daʊn/', partOfSpeech: 'phrasalVerb', cefr: 'A1', example: 'Put down the cup.', helper: { es: 'deja', vi: 'đặt xuống' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/put-down.wav' },
  { id: 'look-at', word: 'look at', ipa: '/lʊk æt/', partOfSpeech: 'phrasalVerb', cefr: 'A1', example: 'Look at the window.', helper: { es: 'mira', vi: 'nhìn vào' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/look-at.wav' },
  { id: 'clean-up', word: 'clean up', ipa: '/kliːn ʌp/', partOfSpeech: 'phrasalVerb', cefr: 'A2', example: 'Clean up the table.', helper: { es: 'limpia', vi: 'dọn dẹp' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/clean-up.wav' },
];

export const PREPOSITIONS: WordEntry[] = [
  { id: 'on', word: 'on', ipa: '/ɑːn/', partOfSpeech: 'preposition', cefr: 'A1', example: 'The cup is on the table.', helper: { es: 'sobre', vi: 'trên' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/on.wav' },
  { id: 'in', word: 'in', ipa: '/ɪn/', partOfSpeech: 'preposition', cefr: 'A1', example: 'The apple is in the box.', helper: { es: 'en', vi: 'trong' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/in.wav' },
  { id: 'under', word: 'under', ipa: '/ˈʌndər/', partOfSpeech: 'preposition', cefr: 'A1', example: 'The cup is under the table.', helper: { es: 'debajo de', vi: 'dưới' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/under.wav' },
  { id: 'next-to', word: 'next to', ipa: '/nekst tuː/', partOfSpeech: 'preposition', cefr: 'A1', example: 'The chair is next to the table.', helper: { es: 'al lado de', vi: 'bên cạnh' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/next-to.wav' },
  { id: 'in-front-of', word: 'in front of', ipa: '/ɪn frʌnt ʌv/', partOfSpeech: 'preposition', cefr: 'A2', example: 'The chair is in front of the door.', helper: { es: 'delante de', vi: 'trước' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/in-front-of.wav' },
  { id: 'behind', word: 'behind', ipa: '/bɪˈhaɪnd/', partOfSpeech: 'preposition', cefr: 'A2', example: 'The chair is behind the door.', helper: { es: 'detrás de', vi: 'sau' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/behind.wav' },
];

export const ADJECTIVES: WordEntry[] = [
  { id: 'red', word: 'red', ipa: '/red/', partOfSpeech: 'adjective', cefr: 'A1', example: 'The apple is red.', helper: { es: 'rojo', vi: 'đỏ' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/red.wav' },
  { id: 'blue', word: 'blue', ipa: '/bluː/', partOfSpeech: 'adjective', cefr: 'A1', example: 'The cup is blue.', helper: { es: 'azul', vi: 'xanh dương' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/blue.wav' },
  { id: 'green', word: 'green', ipa: '/ɡriːn/', partOfSpeech: 'adjective', cefr: 'A1', example: 'The plant is green.', helper: { es: 'verde', vi: 'xanh lá' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/green.wav' },
  { id: 'big', word: 'big', ipa: '/bɪɡ/', partOfSpeech: 'adjective', cefr: 'A1', example: 'The table is big.', helper: { es: 'grande', vi: 'to' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/big.wav' },
  { id: 'small', word: 'small', ipa: '/smɔːl/', partOfSpeech: 'adjective', cefr: 'A1', example: 'The chair is small.', helper: { es: 'pequeño', vi: 'nhỏ' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/small.wav' },
  { id: 'hot', word: 'hot', ipa: '/hɑːt/', partOfSpeech: 'adjective', cefr: 'A1', example: 'The cup is hot.', helper: { es: 'caliente', vi: 'nóng' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/hot.wav' },
  { id: 'cold', word: 'cold', ipa: '/koʊld/', partOfSpeech: 'adjective', cefr: 'A1', example: 'The apple is cold.', helper: { es: 'frío', vi: 'lạnh' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/cold.wav' },
  { id: 'new', word: 'new', ipa: '/nuː/', partOfSpeech: 'adjective', cefr: 'A1', example: 'The book is new.', helper: { es: 'nuevo', vi: 'mới' }, wakeFx: 'spell', rarity: 'common', audio: 'assets/audio/en-US/new.wav' },
];

const BY_SCENE_LABEL = new Map(ROOM_WORDS.filter((w) => w.sceneLabel).map((w) => [w.sceneLabel as string, w]));
const BY_ID = new Map(
  [...ROOM_WORDS, ...KITCHEN_PROPS, ...CAFE_PROPS, ...VERBS, ...PHRASAL_VERBS, ...PREPOSITIONS, ...ADJECTIVES].map((w) => [w.id, w]),
);

/** Word for a detected scene label; undefined for unknown labels (skip those).
 * Lookup is case-insensitive: runtimes do not guarantee label casing. */
export function wordForSceneLabel(label: string): WordEntry | undefined {
  return BY_SCENE_LABEL.get(label.toLowerCase());
}

export function wordById(id: string): WordEntry | undefined {
  return BY_ID.get(id);
}

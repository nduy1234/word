/**
 * Seed content for Word. Pure data — no IWSDK imports, unit-testable.
 * Full packs ship as packs/es/{room}.json later; this seeds the M1 slice.
 */
export interface WordEntry {
  id: string;
  target: string;
  english: string;
  partOfSpeech: 'noun' | 'verb' | 'adjective';
  gender?: 'm' | 'f';
  example: string;
  sceneLabel?: string;
  propId?: string;
  wakeFx: string;
  rarity: 'common' | 'rare' | 'gold';
}

export const ROOM_WORDS: WordEntry[] = [
  { id: 'mesa', target: 'la mesa', english: 'the table', partOfSpeech: 'noun', gender: 'f', example: 'La mesa es grande.', sceneLabel: 'table', wakeFx: 'bloom', rarity: 'common' },
  { id: 'pared', target: 'la pared', english: 'the wall', partOfSpeech: 'noun', gender: 'f', example: 'La pared es blanca.', sceneLabel: 'wall', wakeFx: 'bloom', rarity: 'common' },
  { id: 'puerta', target: 'la puerta', english: 'the door', partOfSpeech: 'noun', gender: 'f', example: 'La puerta está cerrada.', sceneLabel: 'door', wakeFx: 'bloom', rarity: 'common' },
  { id: 'ventana', target: 'la ventana', english: 'the window', partOfSpeech: 'noun', gender: 'f', example: 'La ventana está abierta.', sceneLabel: 'window', wakeFx: 'bloom', rarity: 'common' },
  { id: 'sofa', target: 'el sofá', english: 'the couch', partOfSpeech: 'noun', gender: 'm', example: 'El sofá es suave.', sceneLabel: 'couch', wakeFx: 'bloom', rarity: 'common' },
  { id: 'suelo', target: 'el suelo', english: 'the floor', partOfSpeech: 'noun', gender: 'm', example: 'El suelo está limpio.', sceneLabel: 'floor', wakeFx: 'bloom', rarity: 'common' },
  { id: 'lampara', target: 'la lámpara', english: 'the lamp', partOfSpeech: 'noun', gender: 'f', example: 'La lámpara brilla.', sceneLabel: 'lamp', wakeFx: 'bloom', rarity: 'rare' },
  { id: 'planta', target: 'la planta', english: 'the plant', partOfSpeech: 'noun', gender: 'f', example: 'La planta es verde.', sceneLabel: 'plant', wakeFx: 'bloom', rarity: 'rare' },
  { id: 'pantalla', target: 'la pantalla', english: 'the screen', partOfSpeech: 'noun', gender: 'f', example: 'La pantalla es grande.', sceneLabel: 'screen', wakeFx: 'bloom', rarity: 'rare' },
  { id: 'estanteria', target: 'la estantería', english: 'the shelf', partOfSpeech: 'noun', gender: 'f', example: 'La estantería es alta.', sceneLabel: 'storage', wakeFx: 'bloom', rarity: 'rare' },
];

export const KITCHEN_PROPS: WordEntry[] = [
  { id: 'taza', target: 'la taza', english: 'the cup', partOfSpeech: 'noun', gender: 'f', example: 'La taza está caliente.', propId: 'cup', wakeFx: 'bloom', rarity: 'common' },
  { id: 'plato', target: 'el plato', english: 'the plate', partOfSpeech: 'noun', gender: 'm', example: 'El plato está vacío.', propId: 'plate', wakeFx: 'bloom', rarity: 'common' },
  { id: 'manzana', target: 'la manzana', english: 'the apple', partOfSpeech: 'noun', gender: 'f', example: 'La manzana es roja.', propId: 'apple', wakeFx: 'bloom', rarity: 'common' },
  { id: 'silla', target: 'la silla', english: 'the chair', partOfSpeech: 'noun', gender: 'f', example: 'La silla es pequeña.', propId: 'chair', wakeFx: 'bloom', rarity: 'common' },
  { id: 'libro', target: 'el libro', english: 'the book', partOfSpeech: 'noun', gender: 'm', example: 'El libro es nuevo.', propId: 'book', wakeFx: 'bloom', rarity: 'common' },
];

export const VERBS: WordEntry[] = [
  { id: 'abre', target: 'abre', english: 'open!', partOfSpeech: 'verb', example: 'Abre la puerta.', wakeFx: 'spell', rarity: 'common' },
  { id: 'cierra', target: 'cierra', english: 'close!', partOfSpeech: 'verb', example: 'Cierra la ventana.', wakeFx: 'spell', rarity: 'common' },
  { id: 'toca', target: 'toca', english: 'touch!', partOfSpeech: 'verb', example: 'Toca la mesa.', wakeFx: 'spell', rarity: 'common' },
  { id: 'mira', target: 'mira', english: 'look!', partOfSpeech: 'verb', example: 'Mira la planta.', wakeFx: 'spell', rarity: 'common' },
];

const BY_SCENE_LABEL = new Map(ROOM_WORDS.filter((w) => w.sceneLabel).map((w) => [w.sceneLabel as string, w]));
const BY_ID = new Map([...ROOM_WORDS, ...KITCHEN_PROPS, ...VERBS].map((w) => [w.id, w]));

/** Word for a detected scene label; undefined for unknown labels (skip those). */
export function wordForSceneLabel(label: string): WordEntry | undefined {
  return BY_SCENE_LABEL.get(label);
}

export function wordById(id: string): WordEntry | undefined {
  return BY_ID.get(id);
}

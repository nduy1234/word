/** English word matching for voice wake. Intelligibility only, never accent. Pure. */

/** Confusable minimal pairs: [word, pair, hint]. Hearing pair for word = "almost". */
export const MINIMAL_PAIRS: [string, string, string][] = [
  ['ship', 'sheep', 'ship = short i | sheep = long ee'],
  ['sheep', 'ship', 'sheep = long ee | ship = short i'],
  ['light', 'right', 'light = L | right = R'],
  ['right', 'light', 'right = R | light = L'],
  ['cap', 'cup', 'cap = a | cup = uh'],
  ['cup', 'cap', 'cup = uh | cap = a'],
  ['bed', 'bad', 'bed = e | bad = a'],
  ['bad', 'bed', 'bad = a | bed = e'],
  ['door', 'dog', 'door ends quiet | dog ends with g'],
  ['tree', 'three', 'three starts with th'],
  ['three', 'tree', 'three starts with th'],
];

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(the|a|an)\s+/, '');
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export type MatchResult =
  | { result: 'exact'; heard: string }
  | { result: 'almost'; heard: string; hint: string; kind: 'minimal-pair' | 'close' | 'stress' }
  | { result: 'wrong'; heard: string };

/** Syllable stress pattern from IPA: index of syllable containing ˈ . */
export function stressIndex(ipa: string): number {
  const clean = ipa.replace(/\//g, '');
  const mark = clean.indexOf('ˈ');
  if (mark < 0) return 0;
  return (clean.slice(0, mark).match(/[aeiouæɑɔɛɪʊə]+/g) ?? []).length;
}

/** Stress hint, e.g. "TA-ble BIG-small" for 2-syllable words (ASCII only: UIKit font). */
export function stressHint(word: string, ipa: string, syllables: number): string {
  if (syllables < 2) return word;
  const idx = Math.min(stressIndex(ipa), syllables - 1);
  const dots = Array.from({ length: syllables }, (_, i) => (i === idx ? 'BIG' : 'small')).join('-');
  return `${word} ${dots} - bounce on the BIG beat`;
}

export function matchTranscript(transcript: string, targetWord: string, targetIpa = ''): MatchResult {
  const heard = normalize(transcript);
  const target = normalize(targetWord);
  if (!heard) return { result: 'wrong', heard };
  // Phrasal verbs: whole phrase as contiguous tokens (never substring: "in" must not match "window").
  const ht = heard.split(' '); const tt = target.split(' ');
  const phrase = tt.length > 1 && ht.some((_, i) => tt.every((w, j) => ht[i + j] === w));
  if (heard === target || phrase) return { result: 'exact', heard };
  const heardWords = heard.split(' ');
  const heardWord = heardWords.find((w) => w === target) ?? heardWords[heardWords.length - 1] ?? heard;
  if (heardWord === target) return { result: 'exact', heard };
  const pair = MINIMAL_PAIRS.find(([w, p]) => w === target && p === heardWord);
  if (pair) return { result: 'almost', heard, kind: 'minimal-pair', hint: `Almost! ${pair[2]}. Try: ${target}` };
  const dist = editDistance(heardWord, target);
  if (dist <= Math.max(1, Math.ceil(target.length / 3))) {
    return { result: 'almost', heard, kind: 'close', hint: `Almost! Listen: ${target}` };
  }
  return { result: 'wrong', heard };
}

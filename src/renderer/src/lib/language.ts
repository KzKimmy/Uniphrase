type Script = 'thai' | 'japanese' | 'korean' | 'han' | 'latin' | 'cyrillic'

const targetScripts: Record<string, Script> = {
  thai: 'thai',
  th: 'thai',
  ไทย: 'thai',
  ภาษาไทย: 'thai',
  english: 'latin',
  en: 'latin',
  japanese: 'japanese',
  ja: 'japanese',
  jp: 'japanese',
  日本語: 'japanese',
  korean: 'korean',
  ko: 'korean',
  chinese: 'han',
  zh: 'han',
  'zh-cn': 'han',
  'zh-tw': 'han',
  russian: 'cyrillic',
  ru: 'cyrillic'
}

export function sameAsTarget(text: string, language: string): boolean {
  const target = targetScripts[language.trim().toLowerCase()]
  if (!target) return false
  return dominantScript(text) === target
}

function dominantScript(text: string): Script | null {
  let thai = 0
  let kana = 0
  let hangul = 0
  let han = 0
  let latin = 0
  let cyrillic = 0
  for (const char of text) {
    if (/\p{Script=Thai}/u.test(char)) thai += 1
    else if (/\p{Script=Hiragana}/u.test(char) || /\p{Script=Katakana}/u.test(char)) kana += 1
    else if (/\p{Script=Hangul}/u.test(char)) hangul += 1
    else if (/\p{Script=Han}/u.test(char)) han += 1
    else if (/\p{Script=Latin}/u.test(char)) latin += 1
    else if (/\p{Script=Cyrillic}/u.test(char)) cyrillic += 1
  }
  const counts: [Script, number][] = [
    ['thai', thai],
    ['japanese', kana > 0 ? kana + han : 0],
    ['korean', hangul],
    ['han', kana === 0 ? han : 0],
    ['latin', latin],
    ['cyrillic', cyrillic]
  ]
  const letters = thai + kana + hangul + han + latin + cyrillic
  if (letters === 0) return null
  const [script, count] = counts.reduce((best, item) => (item[1] > best[1] ? item : best))
  return count / letters >= 0.6 ? script : null
}

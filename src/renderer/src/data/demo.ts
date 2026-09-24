import type { EngineEntry } from '@shared/contracts'

const lines: Array<[string, string, string, string, string, string]> = [
  ['sharedassets0.assets', '1001', 'm_Script', 'TextAsset', 'DialogData', 'Hello, adventurer!'],
  ['sharedassets0.assets', '1004', 'm_Script', 'TextAsset', 'GateWarning', 'The gate will open at dawn. Bring the silver key.'],
  ['sharedassets0.assets', '1002', 'm_Script', 'TextAsset', 'ItemNames', 'Rusty Sword\nHealing Salve\nLantern'],
  ['sharedassets0.assets', '1003', 'm_Script', 'TextAsset', 'SystemMenu', 'New Game\nContinue\nSettings\nQuit'],
  ['resources.assets', '2201', 'm_lines/Array/data#0/m_text', 'MonoBehaviour', 'Quest_Bridge', 'The bridge collapsed during the storm.'],
  ['resources.assets', '2201', 'm_lines/Array/data#1/m_text', 'MonoBehaviour', 'Quest_Bridge', 'Can you help us rebuild it?'],
  ['resources.assets', '2201', 'm_lines/Array/data#2/m_text', 'MonoBehaviour', 'Quest_Bridge', 'We only need timber from the western grove.'],
  ['resources.assets', '2204', 'm_speakerName', 'MonoBehaviour', 'NPC_Mira', 'Mira the cartographer'],
  ['resources.assets', '2204', 'm_greeting', 'MonoBehaviour', 'NPC_Mira', 'You look lost. The capital is two ridges east.'],
  ['resources.assets', '2204', 'm_farewell', 'MonoBehaviour', 'NPC_Mira', 'Safe travels. Watch the fog after sunset.'],
  ['resources.assets', '2288', 'm_choices/Array/data#0/m_label', 'MonoBehaviour', 'Innkeeper', 'Yes'],
  ['resources.assets', '2288', 'm_choices/Array/data#1/m_label', 'MonoBehaviour', 'Innkeeper', 'Not tonight.'],
  ['resources.assets', '2288', 'm_body', 'MonoBehaviour', 'Innkeeper', 'A room is twelve coins, supper included.'],
  ['bundles/dialogue.bundle::CAB-dialog', '501', 'm_Script', 'TextAsset', 'Ending_A', 'You left the city lights behind and kept walking.'],
  ['bundles/dialogue.bundle::CAB-dialog', '502', 'm_Script', 'TextAsset', 'Ending_B', 'The key turned. Somewhere below, water started to rise.'],
  ['bundles/locale.bundle::locale/ui', '40', 'm_entries/Array/data#0/m_value', 'MonoBehaviour', 'UITable', 'Press any key'],
  ['bundles/locale.bundle::locale/ui', '40', 'm_entries/Array/data#1/m_value', 'MonoBehaviour', 'UITable', 'Inventory full'],
  ['bundles/locale.bundle::locale/ui', '40', 'm_entries/Array/data#2/m_value', 'MonoBehaviour', 'UITable', 'Quest updated']
]

export function demoEntries(): EngineEntry[] {
  return lines.map(([assetPath, pathId, fieldPath, type, name, original], index) => ({
    assetPath,
    pathId,
    fieldPath,
    type,
    name,
    original,
    translation: index === 0 ? 'Xin chào, nhà thám hiểm!' : index === 4 ? 'Cây cầu đã sập trong cơn bão.' : ''
  }))
}

const samples = [
  'The watchtower bell rings twice.',
  'Take this letter to the harbor master.',
  'I have never seen the river this low.',
  'Careful. The tiles are loose.',
  'We bury our dead facing the sea.',
  'That song is older than the kingdom.',
  'The password is the name of the first ship.',
  'Come back when the lanterns are lit.'
]

export function stressEntries(count: number): EngineEntry[] {
  const assets = [
    'sharedassets0.assets',
    'resources.assets',
    'bundles/dialogue.bundle::CAB-dialog',
    'bundles/locale.bundle::locale/ui'
  ]
  return Array.from({ length: count }, (_, index) => {
    const assetPath = assets[index % assets.length]
    const mono = index % 2 === 1
    return {
      assetPath,
      pathId: String(10_000 + index),
      fieldPath: mono ? `m_lines/Array/data#${index}/m_text` : 'm_Script',
      type: mono ? 'MonoBehaviour' : 'TextAsset',
      name: mono ? `Dialogue_${String(index).padStart(4, '0')}` : `Text_${String(index).padStart(4, '0')}`,
      original: `${samples[index % samples.length]} (${index + 1})`,
      translation: index % 7 === 0 ? `Translated line ${index + 1}` : ''
    }
  })
}

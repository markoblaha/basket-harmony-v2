const STATES = [
  ['home', (b) => b.jump('home')], ['lists', (b) => b.jump('lists')], ['list', (b) => b.jump('lists', 'list', { id: 'l1' })],
  ['recipes', (b) => b.jump('recipes')], ['recipe-new', (b) => b.jump('recipes', 'recipe', { id: 'segedin' })], ['recipe-old', (b) => b.jump('recipes', 'recipe', { id: 'gulas' })],
  ['rcol', (b) => b.jump('recipes', 'rcol', { cat: 'polievky' })], ['rcol-ai', (b) => b.jump('recipes', 'rcol', { col: 'aitest' })],
  ['money', (b) => b.jump('money')], ['category', (b) => b.jump('money', 'category', { cat: 'dairy_eggs' })], ['kind', (b) => b.jump('money', 'kind', { kind: 'Pivo' })],
  ['product', (b) => b.jump('money', 'product', { pid: 'mlieko' })], ['store', (b) => b.jump('money', 'store', { name: 'Lidl' })], ['receipts', (b) => b.jump('money', 'receipts')],
  ['receipt', (b) => b.jump('money', 'receipt', { id: b.S.receipts && b.S.receipts[0] ? b.S.receipts[0].id : 'r0' })], ['more', (b) => b.jump('home', 'more')], ['more-pantry', (b) => { b.jump('home', 'more'); setTimeout(() => { const r = [...document.querySelectorAll('.scr.top .row.tap')].find((x) => x.textContent.includes('Čo mám doma')); r && r.click(); }, 500); }], ['history', (b) => b.jump('lists', 'history')], ['m-voice-items', (b) => b.voice({})], ['bookmap', (b) => b.jump('home', 'bookmap')],
  ['m-shop', (b) => b.modal('shop', { listId: 'l1' })], ['m-follow', (b) => b.modal('follow')], ['m-cook', (b) => b.modal('cook', { id: 'segedin' })], ['m-scan', (b) => b.modal('scan', { listId: 'l1' })],
  ['m-voice', (b) => b.voice({})], ['m-taste', (b) => b.modal('taste')],
  ['s-item', (b) => { b.jump('lists', 'list', { id: 'l1' }); setTimeout(() => window.__bh.sheet('item', { listId: 'l1', itemId: window.__bh.S.lists.find((l) => l.id === 'l1').items[0].id }), 400); }],
  ['s-newList', (b) => b.sheet('newList')], ['s-listMenu', (b) => b.sheet('listMenu', { id: 'l1' })], ['s-finish', (b) => b.sheet('finish', { listId: 'l1' })], ['s-plan', (b) => b.sheet('plan', { rid: 'segedin' })],
  ['s-plan-day', (b) => b.sheet('plan', { day: new Date().toISOString().slice(0, 10) })], ['s-import', (b) => b.sheet('import', { start: 'link' })], ['s-addRecipe', (b) => b.sheet('addRecipe', { rid: 'segedin', por: 4 })],
  ['s-budget', (b) => b.sheet('budget')], ['s-notif', (b) => b.sheet('notif')], ['s-help', (b) => b.sheet('help', { screen: 'lists' })],
];

module.exports = STATES;

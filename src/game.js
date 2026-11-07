export function accuracy(position) { return Math.max(0, 1 - Math.abs(position - 0.72) / 0.4); }
export function flipChance(skill) { return 0.16 + Math.max(0, Math.min(1, skill)) * 0.72; }
export function resolveTurn(state, skill, random = Math.random) {
  if (state.phase !== 'duel' && state.phase !== 'pair') return state;
  const next = {...state, faces: [...state.faces], score: [...state.score], turn: state.turn + 1};
  const side = state.player;
  if (state.phase === 'duel') {
    next.faces[side] = random() < flipChance(skill);
    if (side === 0) { next.player = 1; next.message = next.faces[0] ? 'Your cap is face up. Bot is next.' : 'No flip. Bot is next.'; }
    else if (next.faces[0] !== next.faces[1]) { next.phase = 'pair'; next.player = next.faces[0] ? 0 : 1; next.message = next.player === 0 ? 'Your advantage! Flip both to take the pair.' : 'Bot has the advantage and slams the pair.'; }
    else { next.phase='rps';next.player=0;next.rpsRound=1;next.message='A tie! Let the fingers decide.'; }
  } else {
    next.faces = [random() < flipChance(skill), random() < flipChance(skill)];
    if (next.faces.every(Boolean)) { next.score[side] += 2; next.phase = 'finished'; next.message = side === 0 ? 'The pair is yours! Two more legends for the collection.' : 'Bot took the pair. Want a rematch?'; }
    else { next.player = 1 - side; next.message = next.player === 0 ? 'Your chance! Both caps must land face up.' : 'The pair stays on the table. Bot is next.'; }
  }
  return next;
}
export const newGame = (score = [0, 0]) => ({phase:'duel',player:0,faces:[false,false],score:[...score],turn:0,message:'Your turn. Hold it. Slam it!'});

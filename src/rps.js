export const RPS_CHOICES=['rock','scissors','paper'];
export const RPS_LABELS={rock:'Rock',scissors:'Scissors',paper:'Paper'};
export function rpsWinner(yours,theirs){
 if(!RPS_CHOICES.includes(theirs))throw new Error('Invalid opponent choice');
 if(yours==null)return 1;
 if(!RPS_CHOICES.includes(yours))throw new Error('Invalid player choice');
 if(yours===theirs)return null;
 return {rock:'scissors',scissors:'paper',paper:'rock'}[yours]===theirs?0:1;
}
export function resolveRps(state,yours,theirs){
 if(state.phase!=='rps')return state;
 const winner=rpsWinner(yours,theirs);
 if(winner===null)return {...state,rpsRound:(state.rpsRound||1)+1,message:'Another tie. Go again!'};
 const score=[...state.score];score[winner]+=2;
 return {...state,phase:'finished',player:winner,score,wonBy:'rps',message:winner===0?'The hands have spoken. The pair is yours!':yours==null?'Too slow! Bot waits for no one.':'Bot won the hand showdown.'};
}

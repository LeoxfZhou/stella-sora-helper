// Same bounded search as the desktop solver: 32 candidates/task, beam 800.
// BigInt masks keep travelers above index 31 distinct.
function solve(database, tasksRequested) {
  const training = tasksRequested !== undefined;
  const tasks = training ? tasksRequested.map(id => database.commissions.find(t => t.id === id)) : database.commissions;
  if (training && (tasks.length !== 4 || new Set(tasksRequested).size !== 4 || tasks.some(t => !t || t.tier !== 3))) throw new Error('Select four distinct Tier III commissions');
  tasks.sort((a,b)=>database.commissions.indexOf(a)-database.commissions.indexOf(b));
  const available = database.trekkers.filter(t => t.owned);
  const order = (a,b) => b.score-a.score || (a.mask < b.mask ? -1 : a.mask > b.mask ? 1 : 0);
  let states = [{mask:0n,score:0,teams:[]}];
  for (const task of tasks) {
    let choices = [];
    function enumerate(start, chosen) {
      if (chosen.length === task.requirements.length) {
        const members = chosen.map(i => available[i]);
        const trainees = members.filter(t => t.level < (task.tier === 3 ? 70 : task.tier === 2 ? 40 : 1));
        if (!training && trainees.length) return;
        const traits = {};
        for (const t of members) for (const trait of t.traits) traits[trait.id] = (traits[trait.id] || 0)+1;
        const remaining = {...traits};
        for (const r of task.requirements) { if (!(remaining[r.id] > 0)) return; remaining[r.id]--; }
        const bonus = task.bonuses.filter(b => traits[b.id] > 0).length;
        const score = [0,1e8,1e10,1e12][task.tier]+bonus*1e7+task.categoryPriority-(training ? trainees.length*1e6 : 0);
        choices.push({mask:chosen.reduce((m,i)=>m|(1n<<BigInt(i)),0n),score, taskId:task.id, task:task.name,tier:task.tier,categoryPriority:task.categoryPriority,bonus,bonusTotal:task.bonuses.length,members:members.map(t=>({id:t.id,name:t.name,image:t.image,level:t.level,training:trainees.includes(t)}))});
        return;
      }
      for(let i=start;i<=available.length-(task.requirements.length-chosen.length);i++) enumerate(i+1,[...chosen,i]);
    }
    enumerate(0,[]);
    choices.sort((a,b)=>b.score-a.score || a.members.map(t=>t.id).join(',').localeCompare(b.members.map(t=>t.id).join(',')));
    choices = choices.slice(0,32);
    const groups = Array.from({length:5},()=>[]);
    for(const state of states) {
      groups[state.teams.length].push(state);
      if(state.teams.length === 4) continue;
      for(const choice of choices) if(!(state.mask & choice.mask)) groups[state.teams.length+1].push({mask:state.mask|choice.mask,score:state.score+choice.score,teams:[...state.teams,choice]});
    }
    states = [];
    for(const group of groups) {
      group.sort(order);
      const seen = new Set(), counts = new Map();
      for(const state of group) {
        const taskKey = state.teams.map(t=>t.taskId).join(',');
        const key = state.mask+'|'+taskKey;
        if((counts.get(taskKey)||0)>=12 || seen.has(key)) continue;
        seen.add(key); counts.set(taskKey,(counts.get(taskKey)||0)+1); states.push(state);
        if(seen.size>=800) break;
      }
    }
  }
  const plans=[],seen=new Set();
  for(const state of states.sort(order)) {
    if(state.teams.length!==4) continue;
    state.teams.sort((a,b)=>b.categoryPriority-a.categoryPriority || b.tier-a.tier || a.taskId.localeCompare(b.taskId));
    const signature = training ? state.teams.map(t=>t.taskId+':'+t.members.map(m=>m.id).sort().join(',')).join('|') : state.teams.map(t=>t.taskId).sort().join('|');
    if(seen.has(signature)) continue;
    seen.add(signature);
    plans.push({rank:plans.length+1,score:state.score,teams:state.teams.map(({mask,...team})=>team),training:state.teams.flatMap(t=>t.members.filter(m=>m.training).map(m=>({id:m.id,name:m.name,currentLevel:m.level,targetLevel:70})))});
    if(plans.length===5) break;
  }
  return {plans};
}
if(typeof module !== 'undefined') module.exports = {solve};
else self.onmessage = event => {try {self.postMessage({result:solve(event.data.database,event.data.tasks)});} catch(e){self.postMessage({error:e.message});}};

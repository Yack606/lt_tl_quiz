// Simple Vocabulary Quiz with Leitner (spaced repetition) in localStorage
const els = {
  mode: document.getElementById('mode'),
  direction: document.getElementById('direction'),
  chapter: document.getElementById('chapter'),
  filter: document.getElementById('filter'),
  start: document.getElementById('start'),
  reset: document.getElementById('resetProgress'),
  card: document.getElementById('card'),
  prompt: document.getElementById('prompt'),
  answer: document.getElementById('answer'),
  reveal: document.getElementById('reveal'),
  next: document.getElementById('next'),
  mcqBox: document.getElementById('mcqBox'),
  typeBox: document.getElementById('typeBox'),
  typed: document.getElementById('typed'),
  check: document.getElementById('check'),
  typedFeedback: document.getElementById('typedFeedback'),
  leitnerBtns: document.getElementById('leitnerBtns'),
  progress: document.getElementById('progress')
};

let DATA = [];
let queue = [];
let current = null;
let seen = 0;

const STORE_KEY = 'lt_tl_leitner_v1';

function loadStore(){
  try{
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  }catch(e){ return {}; }
}
function saveStore(obj){
  localStorage.setItem(STORE_KEY, JSON.stringify(obj));
}

function normalize(s){
  return (s||'').toString().trim().toLowerCase();
}

async function loadData(){
  const res = await fetch('data/vocab.json');
  const json = await res.json();
  DATA = json.words;
  // populate chapters
  const chapters = [...new Set(DATA.map(w => w.chapter))].sort((a,b)=>a-b);
  els.chapter.innerHTML = chapters.map(c => `<option value="${c}">Chapter ${c}</option>`).join('');
}

function getLeitnerState(){
  const store = loadStore();
  // default boxes: 0..4, with intervals in days [0,1,3,7,21]
  if(!store.boxes){
    store.boxes = {}; // key: id -> {box, due}
  }
  if(!store.intervals){
    store.intervals = [0, 1, 3, 7, 21];
  }
  saveStore(store);
  return store;
}

function isDue(state, id){
  const box = state.boxes[id];
  if(!box) return true; // new -> due
  const today = new Date(); today.setHours(0,0,0,0);
  return !box.due || new Date(box.due) <= today;
}

function schedule(state, id, grade){
  // grade: 0 again, 1 hard, 2 good, 3 easy
  const now = new Date(); now.setHours(0,0,0,0);
  let b = state.boxes[id]?.box ?? 0;
  if(grade === 0){ b = 0; }
  else if(grade === 1){ b = Math.max(0, b); }
  else if(grade === 2){ b = Math.min(4, b+1); }
  else if(grade === 3){ b = Math.min(4, b+2); }
  const days = state.intervals[Math.min(b, state.intervals.length-1)];
  const due = new Date(now); due.setDate(now.getDate() + days);
  state.boxes[id] = { box: b, due: due.toISOString() };
  saveStore(state);
}

function setupQueue(){
  const chapter = parseInt(els.chapter.value, 10);
  const dir = els.direction.value;
  const filter = els.filter.value;
  const state = getLeitnerState();

  let pool = DATA.filter(w => w.chapter === chapter);

  if(filter === 'due'){
    pool = pool.filter(w => isDue(state, w.id));
  } else if(filter === 'new'){
    pool = pool.filter(w => !state.boxes[w.id]);
  }
  // Shuffle
  queue = pool.sort(() => Math.random()-0.5);
  seen = 0;
  els.progress.textContent = `${seen} / ${queue.length}`;
}

function renderCard(word){
  const mode = els.mode.value;
  const dir = els.direction.value;

  const prompt = dir === 'lt2tl' ? word.lt : word.tl;
  const answer = dir === 'lt2tl' ? word.tl : word.lt;

  els.prompt.textContent = prompt;
  els.answer.textContent = answer;

  // reset views
  els.answer.classList.add('hidden');
  els.leitnerBtns.classList.add('hidden');
  els.next.classList.add('hidden');
  els.reveal.classList.remove('hidden');
  els.typed.value = '';
  els.typedFeedback.textContent = '';

  els.mcqBox.classList.add('hidden');
  els.typeBox.classList.add('hidden');

  if(mode === 'mcq'){
    els.mcqBox.innerHTML = '';
    els.mcqBox.classList.remove('hidden');
    // build choices
    const choices = [answer];
    const pool = DATA.filter(w => (dir==='lt2tl'? w.tl : w.lt) !== answer);
    while(choices.length < 4 && pool.length){
      const candidate = (dir==='lt2tl'
        ? pool.splice(Math.floor(Math.random()*pool.length),1)[0].tl
        : pool.splice(Math.floor(Math.random()*pool.length),1)[0].lt);
      if(!choices.includes(candidate)) choices.push(candidate);
    }
    choices.sort(() => Math.random()-0.5);
    choices.forEach(ch => {
      const btn = document.createElement('button');
      btn.textContent = ch;
      btn.onclick = () => {
        els.answer.classList.remove('hidden');
        els.leitnerBtns.classList.remove('hidden');
        els.next.classList.remove('hidden');
        els.reveal.classList.add('hidden');
        btn.style.borderColor = (normalize(ch)===normalize(answer)) ? '#22c55e' : '#ef4444';
      };
      els.mcqBox.appendChild(btn);
    });
  } else if(mode === 'type'){
    els.typeBox.classList.remove('hidden');
  } else {
    // flashcards default
  }
}

function nextCard(){
  if(queue.length === 0){
    els.prompt.textContent = '🎉 Done for now! Change filters or chapter to continue.';
    els.answer.classList.add('hidden');
    els.leitnerBtns.classList.add('hidden');
    els.next.classList.add('hidden');
    els.reveal.classList.add('hidden');
    return;
  }
  current = queue.shift();
  seen++;
  els.progress.textContent = `${seen-1} / ${seen-1 + queue.length + 1}`;
  renderCard(current);
}

els.start.onclick = () => {
  setupQueue();
  els.card.classList.remove('hidden');
  nextCard();
};

els.reveal.onclick = () => {
  els.answer.classList.remove('hidden');
  els.leitnerBtns.classList.remove('hidden');
  els.next.classList.remove('hidden');
  els.reveal.classList.add('hidden');
};

els.next.onclick = () => {
  nextCard();
};

els.check.onclick = () => {
  const guess = normalize(els.typed.value);
  const dir = els.direction.value;
  const answer = dir === 'lt2tl' ? current.tl : current.lt;
  const ok = guess === normalize(answer);
  els.typedFeedback.textContent = ok ? '✔️ Correct' : `✖️ Correct: ${answer}`;
  els.answer.classList.remove('hidden');
  els.leitnerBtns.classList.remove('hidden');
  els.next.classList.remove('hidden');
  els.reveal.classList.add('hidden');
};

els.leitnerBtns.addEventListener('click', (e) => {
  if(!e.target.dataset.grade) return;
  const grade = parseInt(e.target.dataset.grade, 10);
  const state = getLeitnerState();
  schedule(state, current.id, grade);
  nextCard();
});

els.reset.onclick = () => {
  localStorage.removeItem(STORE_KEY);
  alert('Progress cleared.');
};

loadData();

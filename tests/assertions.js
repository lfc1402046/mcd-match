/* ===== v3 冒烟测试（v2 修复：不触发 buildBoard 死循环）===== */
(async () => {
  const out = [];
  const A = (n,c) => out.push((c?"PASS":"FAIL")+" | "+n);
  const fillNull = n => Array.from({length:n},()=>Array(n).fill(null));
  const realRandom = Math.random;
  const beginLevel = lv => { state.cur = lv; state.pool = FOODS.slice(0, lv.types);
                             state.score = 0; state.moves = lv.moves; state.ice = new Map(); };

  // ---------- 结构 ----------
  A("等级上限上调为 12", LEVELS.length === 12);
  A("3 大章节 × 4 关", CHAPTERS.length===3 && [1,2,3].every(c=>LEVELS.filter(l=>l.ch===c).length===4));
  A("LV6 难度显著上调(18步/3000分/8冰)", (()=>{const l=LEVELS[5]; return l.moves===18 && l.target===3000 && l.ice===8;})());
  A("LV12 为 BOSS(双倍厚冰)", (()=>{const l=LEVELS[11]; return l.boss===1 && l.layers===2 && l.ice===10;})());
  A("章节宝箱在 LV4/8/12", LEVELS.filter(l=>l.chest).map(l=>l.num).join(",")==="4,8,12");
  A("每步得分压力全程不降", (()=>{
    for(let i=1;i<LEVELS.length;i++){
      if(LEVELS[i].target/LEVELS[i].moves < LEVELS[i-1].target/LEVELS[i-1].moves - 1) return false;
    }
    return true;
  })());
  A("食物种类 6→10 递增", LEVELS.map(l=>l.types).join(",")==="6,6,7,7,8,8,9,9,10,10,10,10");
  A("冰块数量随关卡递增", LEVELS[4].ice<LEVELS[7].ice && LEVELS[7].ice<LEVELS[10].ice);
  A("LV6 比 v2 同关更紧(步数<=20 且 目标>=3000)", (()=>{const l=LEVELS[5]; return l.moves<=20 && l.target>=3000;})());

  // ---------- 可变比率奖池 ----------
  A("奖池权重合计 100", BOX_POOL.reduce((s,x)=>s+x.w,0)===100);
  A("奖池 5 个层级", BOX_POOL.length===5);
  {
    const cnt = {};
    for(let i=0;i<3000;i++){ const r=rollFromPool(BOX_POOL); cnt[r.tier]=(cnt[r.tier]||0)+1; }
    A("3000 次抽取全覆盖 5 档", Object.keys(cnt).length===5);
    A("普通档频率最高", cnt["普通"]>cnt["传说"] && cnt["普通"]>cnt["限定"]);
    A("限定档低频(<10%)", cnt["限定"]<300);
  }
  state.meta.lastDate = today();
  Math.random = () => 0.99; A("非首通99%不掉落", Game.rollBoxDrop()===false);
  Math.random = () => 0.30; A("非首通30%掉落", Game.rollBoxDrop()===true);
  state.meta.lastDate = null;
  Math.random = () => 0.60; A("每日首通60%也掉落(0.7)", Game.rollBoxDrop()===true);
  state.meta.lastDate = today();
  Math.random = () => 0.60; A("非首通60%不掉落(0.45)", Game.rollBoxDrop()===false);
  Math.random = realRandom;

  // ---------- 开局 LV12（真实随机，buildBoard 正常终止）----------
  state.unlocked = 12;
  Game.start(12);
  A("LV12 冰块 10 格", state.ice.size === 10);
  A("LV12 双层冰 → 20 层", iceLayersLeft() === 20);
  A("LV12 棋盘 9×9 无三连", state.board.length===9 && Game.findMatches().length===0);
  A("LV12 有可消步骤", !!Game.findHint());

  // ---------- 双层冰：一次只掉一层（确定性补牌，无级联）----------
  state.cur = {grid:4, moves:5, target:99999, ice:1, layers:2, num:99, name:"t", ch:3, reward:{title:"t",cond:"",code:"T-XXXX"}};
  state.pool = ["A","B","C"];
  state.ice = new Map([["0,0", 2]]);
  state.board = fillNull(4);
  state.board[0] = [null,"A","A","A"];
  state.board[1] = ["B","C","B","C"];
  state.board[2] = ["C","B","C","B"];
  state.board[3] = ["B","C","B","C"];
  const seq = [0.1, 0.5, 0.9]; let si = 0;
  Math.random = () => seq[si++ % seq.length];
  await Game.resolveBoard();
  Math.random = realRandom;
  A("双层冰一次只减一层", state.ice.get("0,0") === 1);

  // ---------- 级联 + Combo 倍率（验证 resolveBoard 修复：数据层同步清除）----------
  state.cur = {grid:4, moves:5, target:99999, ice:0, layers:1, num:99, name:"t", ch:1, reward:{title:"t",cond:"",code:"T-XXXX"}};
  state.pool = ["A","B","C"];
  state.ice = new Map();
  state.board = fillNull(4);
  state.board[0] = ["A","A","A","B"];
  state.board[1] = ["C","C","B","C"];
  state.board[2] = ["B","B","C","B"];
  state.board[3] = ["C","B","C","B"];
  state.score = 0;
  const seq2 = [0.1,0.1,0.1, 0.1,0.5,0.9]; let sj = 0;
  Math.random = () => seq2[sj++ % seq2.length];
  await Game.resolveBoard();
  Math.random = realRandom;
  A("级联: 首消30 + 二消60(combo×2) = 90", state.score === 90);
  A("级联后棋盘无残留匹配", Game.findMatches().length === 0);
  A("级联后棋盘无空格(补牌完整)", state.board.every(row=>row.every(v=>v!==null)));

  // ---------- 分段重力(带层数) ----------
  state.cur = {grid:8, moves:5, target:100, ice:1, layers:2, num:99, name:"t", ch:3, reward:{title:"t",cond:"",code:"T-XXXX"}};
  state.ice = new Map([["3,0", 2]]);
  state.board = fillNull(8);
  state.board[0][0]="A"; state.board[1][0]="B";
  Game.dropCells();
  A("分段重力: 食物不穿过双层冰", state.board[2][0]!=null && state.board[0][0]===null);

  // ---------- 通关 / 星级 / 连胜 / 惊喜盒 ----------
  state.unlocked = 12; state.completed.clear(); state.stars = {};
  state.meta = {streak:0, bestStreak:0, lastDate:null, reviveUsedDate:null};
  Math.random = () => 0;
  beginLevel(LEVELS[0]); state.score = LEVELS[0].target; state.moves = 8;
  Game.checkEnd();
  A("通关入册", state.completed.has(1));
  A("剩余8步 → 3 星", state.stars[1] === 3);
  A("连胜 +1", state.meta.streak === 1);
  A("LV1 概率掉落 → ×1", __elems["modal"].innerHTML.includes("惊喜盒 ×1"));
  A("弹窗含概率公示", __elems["modal"].innerHTML.includes("概率公示"));

  beginLevel(LEVELS[3]); state.score = LEVELS[3].target; state.moves = 5;
  Game.checkEnd();
  A("LV4 章节保底2+掉落1 = ×3", __elems["modal"].innerHTML.includes("惊喜盒 ×3"));
  A("章节宝箱文案", __elems["modal"].innerHTML.includes("章节宝箱"));

  beginLevel(LEVELS[11]); state.score = LEVELS[11].target; state.moves = 5;
  Game.checkEnd();
  A("LV12 BOSS 保底3+掉落1+3连胜1 = ×5", __elems["modal"].innerHTML.includes("惊喜盒 ×5"));
  A("终极宝箱文案", __elems["modal"].innerHTML.includes("终极宝箱"));

  state.meta.streak = 2;
  beginLevel(LEVELS[0]); state.score = LEVELS[0].target; state.moves = 8;
  Game.checkEnd();
  A("3 连胜触发额外盒(×2)", __elems["modal"].innerHTML.includes("惊喜盒 ×2"));
  A("连胜奖励文案", __elems["modal"].innerHTML.includes("连胜奖励"));
  Math.random = realRandom;

  // ---------- 失败 / 近失 / 续命 ----------
  state.meta.streak = 5;
  beginLevel(LEVELS[0]); state.score = 500; state.moves = 0; // 500/700≈71%
  Game.checkEnd();
  A("失败断连胜", state.meta.streak === 0);
  A("近失文案: 还差 200 分", __elems["modal"].innerHTML.includes("还差 200 分"));
  A("达60%提供续命券", __elems["modal"].innerHTML.includes("续命券"));
  Game.revive();
  A("续命 +3 步", state.moves === 3);
  A("续命记录今日", state.meta.reviveUsedDate === today());

  beginLevel(LEVELS[0]); state.score = 500; state.moves = 0;
  Game.checkEnd();
  A("当日续命用后不再提供", !__elems["modal"].innerHTML.includes("续命券"));

  state.meta.reviveUsedDate = null;
  beginLevel(LEVELS[0]); state.score = 100; state.moves = 0;
  Game.checkEnd();
  A("低于60%不提供续命", !__elems["modal"].innerHTML.includes("续命券"));

  beginLevel(LEVELS[4]); state.score = LEVELS[4].target; state.moves = 0;
  state.ice = new Map([["1,1",1]]); // 手动放一层冰，模拟冰未清完
  Game.checkEnd();
  A("冰未清完判失败", __elems["modal"].innerHTML.includes("冰块未击碎"));

  const code = generateCoupon(LEVELS[0]);
  A("券码生成", code.startsWith("MCMD15-2-") && code.length > 12);

  console.log(out.join("\n"));
  const fails = out.filter(l=>l.startsWith("FAIL")).length;
  console.log(`\n==== ${out.length-fails}/${out.length} 通过, ${fails} 失败 ====`);
  process.exit(fails?1:0);
})().catch(e=>{ console.error("TEST CRASH:", e); process.exit(2); });

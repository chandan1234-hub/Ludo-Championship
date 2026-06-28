    // ═══════════════════════════════════════════════
    //  CONFIG
    // ═══════════════════════════════════════════════
    const NP = 8, NC = 48, HL = 5;

    const COLORS = [
        '#ef233c','#3a86ff','#06d6a0','#ffbe0b',
        '#8338ec','#fb5607','#ff006e','#0077b6'
    ];
    const NAMES = ['Player 1','Player 2','Player 3','Player 4',
        'Player 5','Player 6','Player 7','Player 8'];
    const DICE_FACE = ['⚀','⚁','⚂','⚃','⚄','⚅'];

    // Player token starts at outer-track cell = p*6 (evenly spaced)
    const P_START       = Array.from({length:NP},(_,p)=>p*6);
    // Home entry = cell BEFORE start (token passes here then enters home stretch)
    const P_HOME_ENTRY  = Array.from({length:NP},(_,p)=>(p*6-1+NC)%NC);
    const SAFE          = new Set(P_START);

    // ═══════════════════════════════════════════════
    //  CANVAS / GEOMETRY
    // ═══════════════════════════════════════════════
    const cv  = document.getElementById('board');
    const ctx = cv.getContext('2d');
    const W=672, H=672, CX=W/2, CY=H/2;
    cv.width=W; cv.height=H;

    const OR   = 252;  // outer ring radius (cell centers)
    const CS   = 15;   // cell half-size  → 30×30 px cells
    const HBI  = 274;  // home-base inner radius
    const HBO  = 328;  // home-base outer radius
    const CTR  = 50;   // center star radius
    // Home-stretch steps 0..4 → radii
    const HS_R = [214, 177, 140, 103, 66];

    function outerAngle(cell){ return -Math.PI/2+(cell/NC)*Math.PI*2; }
    function outerXY(cell){
        const a=outerAngle(cell);
        return {x:CX+OR*Math.cos(a), y:CY+OR*Math.sin(a), a};
    }
    function hsXY(p,step){
        const a=-Math.PI/2+(p/NP)*Math.PI*2;
        const r=HS_R[step];
        return {x:CX+r*Math.cos(a), y:CY+r*Math.sin(a), a};
    }
    function hbCenter(p){
        const a=-Math.PI/2+(p/NP)*Math.PI*2;
        const r=(HBI+HBO)/2;
        return {x:CX+r*Math.cos(a), y:CY+r*Math.sin(a), a};
    }
    function hbTokenXY(p,t){
        const {x,y,a}=hbCenter(p);
        const rad={x:Math.cos(a),y:Math.sin(a)};
        const tan={x:-Math.sin(a),y:Math.cos(a)};
        const dr=12,dt=12;
        const rd=(t<2)?-1:1, td=(t%2===0)?-1:1;
        return {x:x+td*dt*tan.x+rd*dr*rad.x, y:y+td*dt*tan.y+rd*dr*rad.y};
    }

    function hexRgb(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)};}
    function rgba(hex,a){const{r,g,b}=hexRgb(hex);return `rgba(${r},${g},${b},${a})`;}

    // ═══════════════════════════════════════════════
    //  GAME STATE
    // ═══════════════════════════════════════════════
    // pos: -1=home_base  0-47=outer_track  100+s=home_stretch  200=finished
    const S = {
        cur:0, dice:null, rolled:false, busy:false, winner:null,
        tokens:Array.from({length:NP},()=>Array(4).fill(-1)),
        scores:Array(NP).fill(0),
        movable:[],   // [{p,t}]
    };

    // relative position along player's path (0=start,47=home_entry,48-52=stretch,53=finish)
    function relPos(p,pos){
        if(pos>=100) return NC+(pos-100);
        return (pos-P_START[p]+NC)%NC;
    }
    function canMove(p,t,v){
        const pos=S.tokens[p][t];
        if(pos===200)return false;
        if(pos===-1)return v===6;
        return relPos(p,pos)+v<=NC+HL;
    }
    function applyMove(p,t,v){
        const pos=S.tokens[p][t];
        if(pos===-1){S.tokens[p][t]=P_START[p]; capture(p,t); return;}
        const nr=relPos(p,pos)+v;
        if(nr===NC+HL){
            S.tokens[p][t]=200; S.scores[p]++;
            updateUI();
            toast(`${NAMES[p]}'s token ${t+1} reached home! 🏠`);
        } else if(nr>=NC){
            S.tokens[p][t]=100+(nr-NC);
        } else {
            S.tokens[p][t]=(P_START[p]+nr)%NC;
            capture(p,t);
        }
    }
    function capture(p,t){
        const pos=S.tokens[p][t];
        if(pos<0||pos>=48||SAFE.has(pos))return;
        for(let op=0;op<NP;op++){
            if(op===p)continue;
            for(let ot=0;ot<4;ot++){
                if(S.tokens[op][ot]===pos){
                    S.tokens[op][ot]=-1;
                    toast(`${NAMES[p]} captured ${NAMES[op]}'s token! ⚔️`);
                }
            }
        }
    }

    // ═══════════════════════════════════════════════
    //  DRAWING
    // ═══════════════════════════════════════════════
    function rrPath(x,y,w,h,r){
        ctx.beginPath();
        ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
        ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
        ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
        ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
    }

    function drawBG(){
        ctx.save();
        ctx.beginPath(); ctx.arc(CX,CY,HBO+6,0,Math.PI*2);
        ctx.shadowColor='rgba(163,177,198,.85)'; ctx.shadowBlur=22; ctx.shadowOffsetX=10; ctx.shadowOffsetY=10;
        ctx.fillStyle='#e0e5ec'; ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.arc(CX,CY,HBO+6,0,Math.PI*2);
        ctx.shadowColor='rgba(255,255,255,.96)'; ctx.shadowBlur=18; ctx.shadowOffsetX=-8; ctx.shadowOffsetY=-8;
        ctx.fillStyle='#e0e5ec'; ctx.fill();
        ctx.restore();
    }

    function drawHomeBase(p){
        const halfSect=Math.PI/NP;
        const a=-Math.PI/2+(p/NP)*Math.PI*2;
        const s=a-halfSect+0.04, e=a+halfSect-0.04;

        ctx.save();
        ctx.beginPath();
        ctx.arc(CX,CY,HBO-3,s,e);
        ctx.arc(CX,CY,HBI+3,e,s,true);
        ctx.closePath();
        ctx.shadowColor='rgba(163,177,198,.45)'; ctx.shadowBlur=7; ctx.shadowOffsetX=3; ctx.shadowOffsetY=3;
        ctx.fillStyle=rgba(COLORS[p],.22); ctx.fill();
        ctx.shadowColor='transparent';
        ctx.strokeStyle=rgba(COLORS[p],.65); ctx.lineWidth=1.8; ctx.stroke();
        ctx.restore();

        // Label
        const {x,y}=hbCenter(p);
        ctx.save();
        ctx.fillStyle=rgba(COLORS[p],.9);
        ctx.font='bold 8px Nunito';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(`P${p+1}`,x,y+22*Math.sin(a-(a-Math.PI/2))); // just below center
        ctx.fillText(`P${p+1}`,x,y); // center label
        ctx.restore();
    }

    function drawTrackRing(){
        ctx.save();
        ctx.beginPath();
        ctx.arc(CX,CY,OR+CS+9,0,Math.PI*2);
        ctx.arc(CX,CY,OR-CS-9,0,Math.PI*2,true);
        ctx.fillStyle='rgba(210,218,228,.35)'; ctx.fill();
        ctx.restore();
    }

    function drawOuterCell(i){
        const {x,y,a}=outerXY(i);
        let fill='#e0e5ec';
        for(let p=0;p<NP;p++){
            if(i===P_START[p]){fill=rgba(COLORS[p],.38);break;}
        }
        ctx.save();
        ctx.translate(x,y); ctx.rotate(a+Math.PI/2);
        const s=CS;
        ctx.shadowColor='rgba(163,177,198,.85)'; ctx.shadowBlur=5; ctx.shadowOffsetX=3; ctx.shadowOffsetY=3;
        rrPath(-s,-s,s*2,s*2,5);
        ctx.fillStyle=fill; ctx.fill();
        // Highlight sheen
        ctx.shadowColor='transparent';
        const g=ctx.createLinearGradient(-s,-s,0,0);
        g.addColorStop(0,'rgba(255,255,255,.45)'); g.addColorStop(1,'rgba(255,255,255,0)');
        rrPath(-s,-s,s*2,s*2,5); ctx.fillStyle=g; ctx.fill();
        ctx.restore();
    }

    function drawHomeStretch(p){
        const a=-Math.PI/2+(p/NP)*Math.PI*2;
        for(let step=0;step<HL;step++){
            const {x,y}=hsXY(p,step);
            const s=CS*0.88;
            const frac=step/(HL-1);
            ctx.save();
            ctx.translate(x,y); ctx.rotate(a+Math.PI/2);
            ctx.shadowColor='rgba(163,177,198,.65)'; ctx.shadowBlur=4; ctx.shadowOffsetX=2; ctx.shadowOffsetY=2;
            rrPath(-s,-s,s*2,s*2,5);
            ctx.fillStyle=rgba(COLORS[p],.2+frac*.45); ctx.fill();
            ctx.restore();
        }
    }

    function drawCenter(){
        const nr=CTR, ir=CTR*.38, pts=NP*2;
        ctx.save();
        ctx.shadowColor='rgba(163,177,198,.6)'; ctx.shadowBlur=10; ctx.shadowOffsetX=5; ctx.shadowOffsetY=5;
        ctx.beginPath();
        for(let i=0;i<pts;i++){
            const ang=-Math.PI/2+(i/pts)*Math.PI*2;
            const r=i%2===0?nr:ir;
            if(i===0) ctx.moveTo(CX+r*Math.cos(ang),CY+r*Math.sin(ang));
            else       ctx.lineTo(CX+r*Math.cos(ang),CY+r*Math.sin(ang));
        }
        ctx.closePath();
        const g=ctx.createRadialGradient(CX,CY,0,CX,CY,nr);
        g.addColorStop(0,'#f4f6fa'); g.addColorStop(1,'#d0d8e6');
        ctx.fillStyle=g; ctx.fill();
        ctx.restore();
        // Colored wedges in star
        ctx.save();
        ctx.shadowColor='transparent';
        for(let p=0;p<NP;p++){
            const a0=-Math.PI/2+(p*2/pts)*Math.PI*2;
            const a1=-Math.PI/2+((p*2+1)/pts)*Math.PI*2;
            const am=(a0+a1)/2;
            ctx.beginPath();
            ctx.moveTo(CX,CY);
            ctx.lineTo(CX+nr*Math.cos(a0),CY+nr*Math.sin(a0));
            ctx.lineTo(CX+nr*Math.cos(am),CY+nr*Math.sin(am));
            ctx.lineTo(CX+nr*Math.cos(a1),CY+nr*Math.sin(a1));
            ctx.closePath();
            ctx.fillStyle=rgba(COLORS[p],.42); ctx.fill();
        }
        ctx.restore();
    }

    function drawTokenDot(x,y,p,t,isMovable,r){
        ctx.save();
        if(isMovable){
            const pulse=0.5+0.5*Math.sin(Date.now()/230);
            ctx.shadowColor=COLORS[p]; ctx.shadowBlur=6+pulse*12; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
        } else {
            ctx.shadowColor='rgba(163,177,198,.9)'; ctx.shadowBlur=4; ctx.shadowOffsetX=2; ctx.shadowOffsetY=2;
        }
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
        ctx.fillStyle=COLORS[p]; ctx.fill();
        ctx.shadowColor='transparent';
        // Sheen
        ctx.beginPath(); ctx.arc(x-r*.3,y-r*.32,r*.42,0,Math.PI*2);
        ctx.fillStyle='rgba(255,255,255,.52)'; ctx.fill();
        // Number
        ctx.fillStyle='rgba(255,255,255,.92)';
        ctx.font=`bold ${Math.round(r*.72)}px Nunito`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(t+1,x,y+0.5);
        ctx.restore();
    }

    function drawFinished(){
        for(let p=0;p<NP;p++){
            let cnt=0;
            for(let t=0;t<4;t++) if(S.tokens[p][t]===200) cnt++;
            if(!cnt) continue;
            const a=-Math.PI/2+(p/NP)*Math.PI*2;
            for(let i=0;i<cnt;i++){
                const r2=32-i*10;
                ctx.save();
                ctx.beginPath(); ctx.arc(CX+r2*Math.cos(a),CY+r2*Math.sin(a),5.5,0,Math.PI*2);
                ctx.shadowColor='rgba(0,0,0,.18)'; ctx.shadowBlur=3;
                ctx.fillStyle=COLORS[p]; ctx.fill();
                ctx.restore();
            }
        }
    }

    function drawAllTokens(){
        drawFinished();
        // Outer-track groups
        const og=new Map();
        for(let p=0;p<NP;p++) for(let t=0;t<4;t++){
            const pos=S.tokens[p][t];
            if(pos<0||pos>=48) continue;
            if(!og.has(pos)) og.set(pos,[]);
            og.get(pos).push({p,t});
        }
        for(const [pos,grp] of og){
            const {x,y}=outerXY(pos);
            grp.forEach(({p,t},i)=>{
                const im=S.movable.some(m=>m.p===p&&m.t===t);
                let ox=x, oy=y;
                if(grp.length>1){ const ang=(i/grp.length)*Math.PI*2; ox+=7*Math.cos(ang); oy+=7*Math.sin(ang); }
                drawTokenDot(ox,oy,p,t,im,9.5);
            });
        }
        // Home stretch
        for(let p=0;p<NP;p++) for(let t=0;t<4;t++){
            const pos=S.tokens[p][t];
            if(pos<100||pos>=200) continue;
            const {x,y}=hsXY(p,pos-100);
            const im=S.movable.some(m=>m.p===p&&m.t===t);
            drawTokenDot(x,y,p,t,im,9.5);
        }
        // Home base
        for(let p=0;p<NP;p++) for(let t=0;t<4;t++){
            if(S.tokens[p][t]!==-1) continue;
            const {x,y}=hbTokenXY(p,t);
            const im=S.movable.some(m=>m.p===p&&m.t===t);
            drawTokenDot(x,y,p,t,im,9.5);
        }
    }

    function drawBoard(){
        ctx.clearRect(0,0,W,H);
        drawBG();
        for(let p=0;p<NP;p++) drawHomeBase(p);
        drawTrackRing();
        for(let i=0;i<NC;i++) drawOuterCell(i);
        for(let p=0;p<NP;p++) drawHomeStretch(p);
        drawCenter();
        drawAllTokens();
    }

    // ═══════════════════════════════════════════════
    //  GAME LOGIC
    // ═══════════════════════════════════════════════
    function rollDice(){
        if(S.rolled||S.busy||S.winner) return;
        S.busy=true;
        document.getElementById('roll-btn').disabled=true;
        const d=document.getElementById('dice');
        d.classList.add('rolling');
        let cnt=0;
        const iv=setInterval(()=>{
            d.textContent=DICE_FACE[Math.floor(Math.random()*6)];
            if(++cnt>=11){
                clearInterval(iv);
                const v=Math.floor(Math.random()*6)+1;
                d.textContent=DICE_FACE[v-1];
                S.dice=v; S.rolled=true; S.busy=false;
                d.classList.remove('rolling');
                processRoll(v);
            }
        },70);
    }

    function processRoll(v){
        const p=S.cur; S.movable=[];
        for(let t=0;t<4;t++) if(canMove(p,t,v)) S.movable.push({p,t});
        if(!S.movable.length){
            toast(`${NAMES[p]} has no valid moves — skipping!`);
            setTimeout(nextTurn,1700);
        } else if(S.movable.length===1){
            const {p:mp,t:mt}=S.movable[0];
            setTimeout(()=>handleMove(mp,mt),380);
        } else {
            document.getElementById('roll-btn').disabled=true; // wait for click
        }
    }

    function handleMove(p,t){
        if(!S.rolled||!S.movable.some(m=>m.p===p&&m.t===t)) return;
        const v=S.dice; S.movable=[];
        applyMove(p,t,v);
        if(S.scores[p]===4){ S.winner=p; updateUI(); setTimeout(()=>showWin(p),500); return; }
        S.rolled=false;
        if(v===6){
            document.getElementById('roll-btn').disabled=false;
            toast(`${NAMES[p]} rolled a 6 — extra turn! 🎉`);
            updateUI();
        } else { nextTurn(); }
    }

    function nextTurn(){
        S.cur=(S.cur+1)%NP; S.rolled=false; S.dice=null; S.movable=[];
        document.getElementById('dice').textContent='🎲';
        document.getElementById('roll-btn').disabled=false;
        updateUI();
    }

    // ═══════════════════════════════════════════════
    //  UI
    // ═══════════════════════════════════════════════
    function updateUI(){
        const p=S.cur;
        const tn=document.getElementById('turn-name');
        tn.textContent=NAMES[p]; tn.style.color=COLORS[p];

        for(let i=0;i<NP;i++){
            const c=document.getElementById(`pc-${i}`);
            if(c){ c.classList.toggle('active',i===p&&!S.winner); c.classList.toggle('winner-card',S.winner===i); }
            const sc=document.getElementById(`psc-${i}`);
            if(sc) sc.textContent=S.scores[i];
            // Token progress dots
            const tk=document.getElementById(`ptk-${i}`);
            if(tk){
                const home=S.tokens[i].filter(x=>x===200).length;
                tk.textContent=['●','●','●','●'].map((_,j)=>j<home?'●':'○').join(' ');
                tk.style.color=home?COLORS[i]:document.documentElement.style.getPropertyValue('--sub')||'#6b7fa3';
            }
        }
    }

    let _toastTm;
    function toast(msg){
        clearTimeout(_toastTm);
        document.querySelector('.toast')?.remove();
        const el=document.createElement('div');
        el.className='toast'; el.textContent=msg;
        document.body.appendChild(el);
        _toastTm=setTimeout(()=>el.remove(),2700);
    }

    function showWin(p){
        const ov=document.createElement('div');
        ov.className='win-overlay';
        ov.innerHTML=`
    <div class="win-card">
      <div class="win-trophy">🏆</div>
      <div class="win-title" style="color:${COLORS[p]}">${NAMES[p]} Wins!</div>
      <div class="win-sub">All 4 tokens safely home — legendary!</div>
      <button class="pa-btn" id="paBtn">Play Again</button>
    </div>`;
        document.body.appendChild(ov);
        ov.querySelector('#paBtn').onclick=resetGame;
    }

    function resetGame(){
        document.querySelector('.win-overlay')?.remove();
        S.cur=0; S.dice=null; S.rolled=false; S.busy=false; S.winner=null; S.movable=[];
        S.tokens=Array.from({length:NP},()=>Array(4).fill(-1));
        S.scores=Array(NP).fill(0);
        document.getElementById('dice').textContent='🎲';
        document.getElementById('roll-btn').disabled=false;
        updateUI();
    }

    // ═══════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════
    document.getElementById('roll-btn').onclick=rollDice;

    cv.addEventListener('click',e=>{
        if(!S.rolled||!S.movable.length||S.busy) return;
        const r=cv.getBoundingClientRect();
        const sx=W/r.width, sy=H/r.height;
        const mx=(e.clientX-r.left)*sx, my=(e.clientY-r.top)*sy;

        for(const {p,t} of S.movable){
            const pos=S.tokens[p][t];
            let tx,ty;
            if(pos===-1){const q=hbTokenXY(p,t);tx=q.x;ty=q.y;}
            else if(pos>=100){const q=hsXY(p,pos-100);tx=q.x;ty=q.y;}
            else{const q=outerXY(pos);tx=q.x;ty=q.y;}
            if(Math.hypot(mx-tx,my-ty)<22){handleMove(p,t);return;}
        }
    });

    // ═══════════════════════════════════════════════
    //  LOOP
    // ═══════════════════════════════════════════════
    (function loop(){drawBoard();requestAnimationFrame(loop);})();
    updateUI();

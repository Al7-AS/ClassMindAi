/* ClassMind AI — FX layer (page transitions, ripples, count-up, modal motion).
   Additive: relies only on existing globals (page, go, closeModal) and the DOM. */
(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const content=$('#content');
  if(!content)return;

  /* ---- 1. Page enter: stagger items, titles, count-up ---- */
  const ITEM_SEL=[
    '#content > *:not(.stats):not(.cols):not(.dashboard-grid):not(#liveDateTime)',
    '#content .stats > *','#content .cols > *','#content .dashboard-grid > *',
    '#content .quick-grid > *','#content .notification-list > *',
    '#content .smart-strip-grid > *','#content .group-insight-grid > *',
    '#content .comparison-grid > *','#content .grade-summary > *','#content .finance-summary > *'
  ].join(',');
  let lastPage=null,playTimer=null;

  function countUp(el){
    const txt=el.textContent.trim();
    const m=txt.match(/[\d٠-٩]+(?:[,٬][\d٠-٩]{3})*(?:[.٫][\d٠-٩]+)?/g);
    if(!m||m.length!==1)return;
    const token=m[0],arabic=/[٠-٩]/.test(token);
    const norm=token.replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬]/g,'').replace('٫','.');
    const target=parseFloat(norm);
    if(!isFinite(target)||target<=0)return;
    const decimals=(norm.split('.')[1]||'').length;
    const fmt=new Intl.NumberFormat(arabic?'ar-EG':'en-US',{maximumFractionDigits:decimals,minimumFractionDigits:decimals});
    const t0=performance.now(),dur=1100;
    const tick=now=>{
      const p=Math.min(1,(now-t0)/dur),e=1-Math.pow(2,-10*p); // easeOutExpo
      el.textContent=p>=1?txt:txt.replace(token,fmt.format(target*e));
      if(p<1&&el.isConnected)requestAnimationFrame(tick);else if(el.isConnected)el.textContent=txt;
    };
    el.textContent=txt.replace(token,fmt.format(0));
    requestAnimationFrame(tick);
  }

  let pending=false;
  function enter(){
    if(reduced)return;
    if(document.body.classList.contains('entry-locked')){pending=true;return}
    let i=0;
    content.querySelectorAll(ITEM_SEL).forEach(el=>{
      el.style.setProperty('--i',Math.min(i++,16));
      el.classList.add('fx-item');
    });
    content.classList.add('fx-play');
    const title=$('#title');
    if(title){title.classList.remove('fx-title');void title.offsetWidth;title.classList.add('fx-title')}
    content.querySelectorAll('.stat-value').forEach(countUp);
    clearTimeout(playTimer);
    playTimer=setTimeout(()=>content.classList.remove('fx-play'),2200);
  }

  // Re-renders replace #content's children: animate only when the page actually changed.
  const check=()=>{
    if(!content.firstElementChild)return;
    const cur=typeof page!=='undefined'?page:null;
    if(cur!==lastPage){lastPage=cur;enter()}
  };
  new MutationObserver(check).observe(content,{childList:true});
  check(); // first render may already have happened before this script ran

  /* ---- 2. Page exit before navigating ---- */
  if(typeof go==='function'&&!reduced){
    const origGo=go;let token=0;
    window.go=go=function(next){
      if(next===page||document.body.classList.contains('entry-locked')){return origGo(next)}
      const my=++token;
      content.classList.remove('fx-play');
      content.classList.add('fx-leave');
      setTimeout(()=>{
        if(my!==token)return;
        content.classList.remove('fx-leave');
        origGo(next);
      },190);
    };
  }

  /* ---- 3. Modal close animation ---- */
  if(typeof closeModal==='function'&&!reduced){
    const origClose=closeModal;
    window.closeModal=closeModal=function(){
      const root=$('#modalRoot'),bd=root&&root.firstElementChild;
      if(!bd||bd.classList.contains('fx-closing')){return origClose()}
      activeStudent=null;
      bd.classList.add('fx-closing');
      setTimeout(()=>{if(bd.parentNode===root)origClose()},220);
    };
  }
  // Smart-analysis modal is removed directly by app.js; intercept in capture phase to animate first.
  document.addEventListener('click',e=>{
    if(reduced)return;
    const bd=$('#smartBackdrop');
    if(!bd)return;
    if(e.target.closest('#closeSmartAnalysis')||e.target===bd){
      if(bd.classList.contains('fx-closing')){e.stopPropagation();return}
      e.stopPropagation();
      bd.classList.add('fx-closing');
      setTimeout(()=>bd.remove(),220);
    }
  },true);

  /* ---- 4. Ripple on buttons ---- */
  const RIPPLE='.primary,.secondary,.danger,.outline,.quick,.tiny,.nav,.smart-analysis-btn,.theme-toggle,.modal-close,.smart-refresh,.smart-close,.entry-submit';
  document.addEventListener('pointerdown',e=>{
    if(reduced)return;
    const b=e.target.closest(RIPPLE);
    if(!b||b.disabled)return;
    const r=b.getBoundingClientRect(),size=Math.max(r.width,r.height)*2.2;
    const s=document.createElement('span');
    s.className='fx-ripple';
    s.style.width=s.style.height=size+'px';
    s.style.left=(e.clientX-r.left-size/2)+'px';
    s.style.top=(e.clientY-r.top-size/2)+'px';
    b.appendChild(s);
    setTimeout(()=>s.remove(),750);
  },{passive:true});

  /* ---- 5. Mouse spotlight on cards ---- */
  const SPOT='.stat,.quick,.notification-card,.group-insight,.smart-strip-grid>div,.comparison-grid>div';
  document.addEventListener('pointermove',e=>{
    const c=e.target.closest&&e.target.closest(SPOT);
    if(!c)return;
    const r=c.getBoundingClientRect();
    c.style.setProperty('--mx',(e.clientX-r.left)+'px');
    c.style.setProperty('--my',(e.clientY-r.top)+'px');
  },{passive:true});

  /* ---- 6. Smooth theme switch ---- */
  document.addEventListener('click',e=>{
    if(!e.target.closest('#themeToggle'))return;
    document.body.classList.add('fx-theming');
    setTimeout(()=>document.body.classList.remove('fx-theming'),650);
  });

  /* ---- 7. Sidebar boot sequence after unlocking ---- */
  document.querySelectorAll('#nav .nav').forEach((b,i)=>b.style.setProperty('--n',i));
  let wasLocked=document.body.classList.contains('entry-locked');
  new MutationObserver(()=>{
    const locked=document.body.classList.contains('entry-locked');
    if(wasLocked&&!locked){
      document.body.classList.add('fx-boot');
      setTimeout(()=>document.body.classList.remove('fx-boot'),2200);
      if(pending){pending=false;setTimeout(enter,250)}
    }
    wasLocked=locked;
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
})();

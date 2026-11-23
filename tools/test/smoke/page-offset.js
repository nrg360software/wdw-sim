// Nov 22 (Nick, iPhone): after Phone alerts every tap landed one button lower than drawn. iOS had scrolled the document
// (html/body are overflow:hidden, everything is fixed) when a control in the overlay took focus. The page must snap back to 0.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};
await lib.startDay(pg,'MK','map',660);
// make the document scrollable the way iOS treats it, then scroll it while the overlay is open (as focusing a checkbox does)
out.close=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const sp=document.createElement('div');sp.id='iosSpacer';sp.style.cssText='height:3000px;width:1px';document.body.appendChild(sp);
 document.documentElement.style.overflow='auto';document.body.style.overflow='auto';document.body.style.height='auto';document.documentElement.style.height='auto';
 WDW.openPlan();document.querySelector('#sheet #dpPush').click();await w(200);const cb=document.querySelector('#pushIn [data-pucat]');if(cb)cb.focus();
 document.scrollingElement.scrollTop=64;const during=document.scrollingElement.scrollTop;document.querySelector('#puClose').click();if(cb)cb.blur();await w(250);
 const after=document.scrollingElement.scrollTop;WDW.closeSheet();await w(100);const b=document.querySelector('#bPlan').getBoundingClientRect();
 return {during,after,hit:document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)===document.querySelector('#bPlan'),resets:WDW.PIN?WDW.PIN.n:null}});
ck(out.close.during>0,'test setup: document did not scroll');
ck(out.close.hit,'Plan button not under its own centre after closing');ck(out.close.after===0,'document still scrolled '+out.close.after+'px after closing Phone alerts');
// a stray scroll while nothing is focused snaps back too
out.idle=await pg.evaluate(async()=>{document.scrollingElement.scrollTop=40;await new Promise(r=>setTimeout(r,150));return document.scrollingElement.scrollTop});
ck(out.idle===0,'document stays scrolled '+out.idle+'px with nothing focused');
// typing in a text field is left alone (iOS scrolls it above the keyboard)
out.typing=await pg.evaluate(async()=>{const t=document.createElement('textarea');t.id='tf';t.style.cssText='position:fixed;top:10px;left:10px';document.body.appendChild(t);t.focus();
 document.scrollingElement.scrollTop=30;await new Promise(r=>setTimeout(r,150));const v=document.scrollingElement.scrollTop;t.blur();await new Promise(r=>setTimeout(r,200));return [v,document.scrollingElement.scrollTop]});
ck(out.typing[0]===30,'scroll fought while typing in a text field');ck(out.typing[1]===0,'not reset after leaving the text field');
out.fail=fail;return out

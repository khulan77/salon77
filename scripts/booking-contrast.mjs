// Rendered text contrast, including alpha backgrounds composited through ancestors.
export async function bookingContrast(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-booking-theme]');
    if (!root) return [];
    const rgb = (value) => {
      const parts=value.match(/[\d.]+/g)?.map(Number);
      return parts?.length>=3 ? [...parts.slice(0,3),parts[3]??1] : [0,0,0,0];
    };
    const blend = (fg,bg) => fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3]));
    const luminance = (c) => c.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i],0);
    const failures=[];
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
      const node=walker.currentNode, el=node.parentElement, text=node.textContent.trim();
      if(!text || !el || el.closest('script,style,[aria-hidden=true],button:disabled'))continue;
      const style=getComputedStyle(el),rect=el.getBoundingClientRect();
      if(!rect.width || !rect.height || style.visibility==='hidden')continue;
      const ancestors=[]; let p=el;
      while(p){ancestors.push(p);p=p.parentElement;}
      let background=[255,255,255];
      for(const ancestor of ancestors.reverse())background=blend(rgb(getComputedStyle(ancestor).backgroundColor),background);
      const foreground=blend(rgb(style.color),background);
      const a=luminance(foreground),b=luminance(background),ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
      const size=parseFloat(style.fontSize),bold=parseInt(style.fontWeight)>=700,required=size>=24||(size>=18.66&&bold)?3:4.5;
      if(ratio+0.01<required)failures.push({text:text.slice(0,80),cls:el.className,ratio:Math.round(ratio*100)/100,required});
    }
    return failures;
  });
}

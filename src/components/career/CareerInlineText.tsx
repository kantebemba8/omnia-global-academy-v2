import { useEffect, useRef } from 'react';

type Props = {
  field: string; value?: string; fallback?: string; multiline?: boolean;
  onChange?: (field: string, value: string) => void;
};
/** In-place editing via the SAME structured CV/LM data as the left form.
 * Edit is committed on blur, preserving caret while typing; gallery/export are read-only. */
export default function CareerInlineText({field,value,fallback='',multiline=false,onChange}:Props){
  const node=useRef<HTMLSpanElement>(null);
  const text=value||fallback;
  useEffect(()=>{
    if(node.current&&document.activeElement!==node.current&&node.current.textContent!==text) node.current.textContent=text;
  },[text]);
  return <span ref={node} data-career-field={field} contentEditable={Boolean(onChange)}
    suppressContentEditableWarning spellCheck={Boolean(onChange)} role={onChange?'textbox':undefined}
    aria-label={onChange?`Modifier ${field}`:undefined}
    aria-multiline={onChange?multiline:undefined}
    tabIndex={onChange?0:undefined}
    style={{cursor:onChange?'text':undefined,outlineOffset:2,whiteSpace:multiline?'pre-wrap':undefined}}
    className={onChange?'rounded-sm outline-none focus:bg-amber-50/80 focus:ring-2 focus:ring-[#bf8813]':''}
    onKeyDown={e=>{if(onChange&&!multiline&&e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}
    onBlur={e=>{if(!onChange)return;const next=(multiline ? e.currentTarget.innerText : e.currentTarget.textContent || '').trim();if(next!==text)onChange(field,next);}}
  >{text}</span>;
}

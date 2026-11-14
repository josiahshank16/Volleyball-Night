import type {ReactNode} from 'react';
import {GripVertical} from 'lucide-react';
import {useDraggable,useDroppable} from '@dnd-kit/core';
import {CSS} from '@dnd-kit/utilities';

/** A full team card is one drop target, including its empty space and SUBs. */
export function DropTeam({index,full,children}:{index:number;full:boolean;children:ReactNode}){
 const {setNodeRef,isOver}=useDroppable({id:`team:${index}`});
 return <div ref={setNodeRef} className={'team-card team-drop-zone'+(isOver?(full?' team-drop-full':' team-drop-hover'):'')}>
  {children}
 </div>;
}

/** A dedicated drag handle avoids fighting normal taps, swaps and selects. */
export function DragPlayer({id,selected,children}:{id:string;selected:boolean;children:ReactNode}){
 const {attributes,listeners,setNodeRef,transform,isDragging}=useDraggable({id:`player:${id}`});
 return <div ref={setNodeRef}
  className={'team-person'+(selected?' active-swap':'')+(isDragging?' dragging-person':'')}
  style={{transform:transform?CSS.Translate.toString(transform):undefined,zIndex:isDragging?20:undefined,position:isDragging?'relative':undefined}}>
  <button className="team-drag-handle" type="button"
   aria-label="Drag player to another team"
   title="Drag to another team"
   {...attributes} {...listeners}>
   <GripVertical size={17}/>
  </button>
  {children}
 </div>;
}

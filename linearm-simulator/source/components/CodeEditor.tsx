'use client';
import {useEffect,useRef} from 'react';
import {EditorView,Decoration,keymap,placeholder} from '@codemirror/view';
import {EditorState,StateEffect,StateField} from '@codemirror/state';
import {basicSetup} from 'codemirror';
import {cpp} from '@codemirror/lang-cpp';
import {indentWithTab} from '@codemirror/commands';
import {HighlightStyle,syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';
const mark=StateEffect.define<number>();
const lineMark=StateField.define({create(){return Decoration.none},update(v,tr){v=v.map(tr.changes);for(const e of tr.effects)if(e.is(mark)){if(e.value===0){v=Decoration.none;continue;}const line=Math.max(1,Math.min(e.value,tr.state.doc.lines));v=Decoration.set([Decoration.line({class:'executing-line'}).range(tr.state.doc.line(line).from)]);}return v;},provide:f=>EditorView.decorations.from(f)});
const theme=EditorView.theme({'&':{height:'100%',background:'#101b25',color:'#cedee9',fontSize:'14px'},'.cm-scroller':{fontFamily:'"SFMono-Regular",Consolas,"Liberation Mono",monospace',lineHeight:'1.65'},'.cm-content':{padding:'14px 0'},'.cm-placeholder':{color:'#8a9caa'},'.cm-gutters':{background:'#101b25',color:'#566d80',borderRight:'1px solid #21303d',minWidth:'42px'},'.cm-activeLineGutter':{background:'#1c323b',color:'#78d9cc'},'.cm-activeLine':{background:'#1d2d383d'},'&.cm-focused .cm-cursor':{borderLeftColor:'#79e8d5'},'.cm-selectionBackground, &.cm-focused .cm-selectionBackground':{background:'#2b556b !important'},'.executing-line':{background:'#32796828',boxShadow:'inset 3px 0 #64e0cd'},'.cm-searchMatch':{background:'#735918'},'.cm-panels':{background:'#1b2b37',color:'#cfe2ef'},'.cm-tooltip':{background:'#1b2b37',color:'#cfe2ef',border:'1px solid #3a5362'}},{dark:true});
const highlight=syntaxHighlighting(HighlightStyle.define([{tag:tags.keyword,color:'#c6a5f2'},{tag:tags.number,color:'#f3c074'},{tag:tags.string,color:'#a8d99d'},{tag:tags.comment,color:'#778b9c'},{tag:tags.typeName,color:'#77c7e8'},{tag:tags.function(tags.variableName),color:'#7ce0ce'},{tag:tags.meta,color:'#e2ae86'}]));
export default function CodeEditor({value,onChange,line,onRun,onReady}:{value:string,onChange:(v:string)=>void,line:number,onRun:()=>void,onReady:(jump:(line:number)=>void)=>void}){
 const host=useRef<HTMLDivElement>(null),view=useRef<EditorView|null>(null),handlers=useRef({onChange,onRun});handlers.current={onChange,onRun};
 useEffect(()=>{if(!host.current)return;const editor=new EditorView({state:EditorState.create({doc:value,extensions:[basicSetup,placeholder('在这里输入或粘贴你的 Arduino 代码…'),cpp(),theme,highlight,lineMark,keymap.of([indentWithTab,{key:'Mod-Enter',run:()=>{handlers.current.onRun();return true;}}]),EditorView.updateListener.of(update=>{if(update.docChanged)handlers.current.onChange(update.state.doc.toString());}),EditorView.contentAttributes.of({'aria-label':'Arduino ESP32 代码编辑器',spellcheck:'false'})]}),parent:host.current});view.current=editor;onReady(n=>{const pos=editor.state.doc.line(Math.min(Math.max(n,1),editor.state.doc.lines)).from;editor.dispatch({selection:{anchor:pos},effects:EditorView.scrollIntoView(pos,{y:'center'})});editor.focus();});return()=>editor.destroy();},[]);
 useEffect(()=>{const v=view.current;if(v&&v.state.doc.toString()!==value)v.dispatch({changes:{from:0,to:v.state.doc.length,insert:value}});},[value]);
 useEffect(()=>{if(view.current)view.current.dispatch({effects:mark.of(line)});},[line]);
 return <div className="editor-host" ref={host}/>;
}

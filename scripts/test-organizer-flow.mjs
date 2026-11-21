process.on('uncaughtException',error=>{console.error(error.message);process.exit(1)});
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('src/main.tsx'),modes=read('src/ModeHome.tsx');
const ast=ts.createSourceFile('main.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declaration=name=>ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name)?.getText(ast);
const constants=['organizerTitles','byName','copy'].map(name=>ast.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(ast)===name)).getText(ast)).join('\n');
const switchAst=ts.createSourceFile('ModeHome.tsx',modes,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const modeSwitch=switchAst.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='ModeSwitch').getText(switchAst);
const moduleURL=text=>'data:text/javascript;base64,'+Buffer.from(ts.transpile(text,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.React})).toString('base64');
const modelURL=moduleURL(read('src/model.ts'));
const model=await import(modelURL);
const icons=source.match(/import \{([^}]+)\} from 'lucide-react'/)[1].split(',').map(x=>x.trim()).filter(Boolean);
async function fixture(page){
 const app=declaration('App').replace("useState<Page>('home')",`useState<Page>('${page}')`);
 return import(moduleURL(`import React,{useState,useMemo,useRef} from ${JSON.stringify(import.meta.resolve('react'))};
 import * as model from ${JSON.stringify(modelURL)};
 const {configs,generate,uid,ft,skill,SKILLS,SCORE_TARGETS,pointStatus,reconcileAttendance,newSession,buildGames,exportState}=model;
 const Empty=()=>null;const House=Empty;const ${icons.map(name=>name+'=Empty').join(',')};const useSensors=()=>[],useSensor=()=>null,PointerSensor=null,KeyboardSensor=null;
 const DndContext=({children})=>React.createElement(React.Fragment,null,children),DropTeam=({children})=>React.createElement('section',null,children),DragPlayer=({children})=>React.createElement('div',null,children);
 const connectedGroupName='Test volleyball group',activeGroup=null,location={search:'?mode=organizer'};
 const modeHref=mode=>'/?mode='+mode,goMode=()=>{},askForUiPin=()=>{throw Error('Unexpected PIN prompt')};
 const useCloudState=()=>{throw Error('The fixture must inject its isolated state')};
 const PlayerModal=Empty,Scorekeeper=Empty,CloudHealth=Empty,KioskCheckin=Empty,Display=Empty,RelationshipSettings=Empty;
 ${constants}\n${declaration('Stat')}\n${modeSwitch}\n${app}\nexport {App,ModeSwitch};`));
}
function render(App,state){return renderToStaticMarkup(React.createElement(App,{stateHook:()=>({state,apply:()=>true,mode:'local',status:'local',error:'',missing:false,retryCloud:()=>{},createCloud:async()=>{}})}))}
const initial=model.initial();
const home=await fixture('home'),homeHTML=render(home.App,initial);
assert.equal((homeHTML.match(/class="organizer-launch-card /g)||[]).length,4);
for(const title of ['Check-in','Setup','Players','Buddies and Rivals'])assert.ok(homeHTML.includes('<strong>'+title+'</strong>'));
const switchElement=home.ModeSwitch({});assert.equal(switchElement.props.onClick,undefined);assert.equal(switchElement.props.href,'/?mode=home');
const setup=await fixture('setup');
function checkSetup(html){for(const id of ['setup-layout','setup-rosters','setup-schedule','team-layout','schedule-cycles','schedule-target','matchup-first','matchup-second'])assert.ok(html.includes('id="'+id+'"'),id+' must exist before teams are created');assert.ok(html.includes('Other players checked in'));assert.ok(html.includes('Add team'));assert.ok(html.includes('Full six-game round robin'));assert.ok(!html.includes('onclick='));}
const emptyHTML=render(setup.App,initial);checkSetup(emptyHTML);assert.match(emptyHTML,/<button class="btn primary" disabled="">Generate schedule/);
const draft=structuredClone(initial);draft.players=model.samplePlayers().slice(0,12);draft.session.checkedIn=draft.players.map(p=>p.id);draft.session.draft=[{id:'t1',name:'Team 1',playerIds:draft.session.checkedIn.slice(0,6),subs:0},{id:'t2',name:'Team 2',playerIds:draft.session.checkedIn.slice(6),subs:0}];const draftHTML=render(setup.App,draft);checkSetup(draftHTML);assert.ok(draftHTML.includes('Confirm teams &amp; continue'));assert.match(draftHTML,/<button class="btn primary" disabled="">Generate schedule/);
const live=structuredClone(draft);live.session.confirmed=live.session.draft;live.session.draft=[];live.session.games=[{id:'game1',a:0,b:1,cycle:1,scoreA:9,scoreB:7}];const liveHTML=render(setup.App,live);checkSetup(liveHTML);assert.ok(liveHTML.includes('Continue to schedule'));assert.ok(liveHTML.includes('Rebuild schedule'));assert.ok(liveHTML.includes('Add game to end'));
console.log('Passed: four organizer launch sections; open mode switch; all setup fields rendered for empty, draft and live states; schedule generation gated until confirmation.');

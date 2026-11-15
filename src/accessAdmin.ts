/** Owner-only setup operations. Google OAuth access tokens remain in memory. */
type GoogleError=Error&{status?:number};
type Account={localId?:string;email?:string};

export async function ownerApi<T>(url:string,token:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch(url,{method,headers:{Authorization:'Bearer '+token,
  ...(body===undefined?{}:{'Content-Type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 const raw=await response.text();
 let value:unknown={};
 try{value=JSON.parse(raw||'{}')}catch{value={message:raw.slice(0,300)}}
 if(!response.ok){
  const detail=value as {error?:{message?:string};message?:string};
  const error=new Error('Google API '+response.status+': '+(detail.error?.message||detail.message||response.statusText)) as GoogleError;
  error.status=response.status;
  throw error;
 }
 return value as T;
}

export function leaderEmail(projectId:string){
 if(!/^vn-[a-z0-9-]{3,54}$/.test(projectId))throw Error('Invalid group project ID.');
 // example.com is reserved for examples, while its domain shape is accepted
 // by Firebase's email validator. Password reset mail has no real recipient.
 return 'leader@'+projectId+'.example.com';
}

/** The owner sign-in requests `openid email` in addition to cloud-platform. */
export async function googleAccount(token:string){
 const account=await ownerApi<{sub?:string;email?:string;email_verified?:boolean}>(
  'https://openidconnect.googleapis.com/v1/userinfo',token);
 if(!account.sub||!account.email||account.email_verified!==true)
  throw Error('Google did not verify the selected account. Choose the group owner account and try again.');
 return {sub:account.sub,email:account.email};
}

/** A Google account with IAM access to this group can manage Authentication. */
export async function verifyOwnerProject(projectId:string,token:string){
 const project=await ownerApi<{projectId?:string;state?:string}>(
  'https://cloudresourcemanager.googleapis.com/v3/projects/'+encodeURIComponent(projectId),token);
 if(project.state==='DELETE_REQUESTED')throw Error('This group is scheduled for deletion.');
 if(project.projectId!==projectId)throw Error('Google returned the wrong Firebase project.');
}

/** Enable only email/password; do not turn on public account creation UI. */
export async function enableLeaderAuthentication(projectId:string,token:string){
 await verifyOwnerProject(projectId,token);
 const service='https://serviceusage.googleapis.com/v1/projects/'+encodeURIComponent(projectId)+
  '/services/identitytoolkit.googleapis.com';
 const current=await ownerApi<{state?:string}>(service,token);
 if(current.state!=='ENABLED'){
  const started=await ownerApi<{name?:string}>(service+':enable',token,'POST',{});
  if(!started.name)throw Error('Google did not return an Authentication activation operation.');
  let active=false;
  for(let attempt=0;attempt<60;attempt++){
   const status=await ownerApi<{done?:boolean;error?:{message?:string}}>(
    'https://serviceusage.googleapis.com/v1/'+started.name,token);
   if(status.done){
    if(status.error)throw Error('Authentication activation failed: '+(status.error.message||'Unknown error'));
    active=true;break;
   }
   await new Promise(resolve=>setTimeout(resolve,1500));
  }
  if(!active)throw Error('Google is still activating Authentication. Retry this group shortly.');
 }
 const base='https://identitytoolkit.googleapis.com/admin/v2/projects/'+encodeURIComponent(projectId)+'/config';
 await ownerApi(base+'?updateMask=signIn.email.enabled,signIn.email.passwordRequired',token,'PATCH',
  {signIn:{email:{enabled:true,passwordRequired:true}}});
}

/** Creates or rotates the one shared PIN account; only called after owner OAuth. */
export async function setLeaderPin(projectId:string,apiKey:string,token:string,pin:string):Promise<string>{
 if(!/^\d{6}$/.test(pin))throw Error('Enter exactly six digits for the leader PIN.');
 if(!apiKey||apiKey.length>300)throw Error('The group’s Firebase API key is missing.');
 await verifyOwnerProject(projectId,token);
 const base='https://identitytoolkit.googleapis.com/v1/projects/'+encodeURIComponent(projectId)+'/accounts';
 const email=leaderEmail(projectId);
 const found=await ownerApi<{users?:Account[]}>(base+':lookup',token,'POST',{email:[email]});
 const existing=found.users?.find(user=>user.email===email);
 if(existing){
  if(!existing.localId)throw Error('The existing leader account has no ID.');
  await ownerApi(base+':update',token,'POST',{localId:existing.localId,password:pin});
  return existing.localId;
 }
 const created=await ownerApi<Account>(base+'?key='+encodeURIComponent(apiKey),token,'POST',
  {email,password:pin,displayName:'Volleyball Night leaders'});
 if(!created.localId)throw Error('Google did not return an ID for the leader account.');
 return created.localId;
}

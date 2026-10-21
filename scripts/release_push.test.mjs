import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createVerify} from 'node:crypto';
import {parseReleaseEvent,toFcmRequest,sendReleasePush,makeServiceAccountJwt,resolvePublishedAsset} from './release_push.mjs';

const sha='a'.repeat(64);
function event({tag='ui-preview-v0.1.5',size=75000,digest='sha256:'+sha,
  repo='annabil-dev/MYTH-app',action='published',assets=true}={}){
 const ver=tag.replace('ui-preview-v','');
 return {action,repository:{full_name:repo},release:{draft:false,prerelease:true,tag_name:tag,
   assets:assets?[{name:'MYTH-Android-UI-Preview-v'+ver+'.apk',size,
     state:'uploaded',digest}]:[]}};
}

test('release event produces exact package, version, GitHub APK and checksum',()=>{
 const r=parseReleaseEvent(event());
 assert.equal(r.packageId,'io.mythchain.myth.preview');
 assert.equal(r.versionCode,6);
 assert.equal(r.versionName,'0.1.5-ui-preview');
 assert.equal(r.sha256,sha);
 assert.equal(r.downloadUrl,'https://github.com/annabil-dev/MYTH-app/releases/download/ui-preview-v0.1.5/MYTH-Android-UI-Preview-v0.1.5.apk');
 assert.equal(toFcmRequest(r).message.topic,'myth_android_preview_updates');
 assert.equal(toFcmRequest(r).message.data.type,'MYTH_ANDROID_RELEASE');
 assert.equal(toFcmRequest(r).message.android.priority,'HIGH');
});
test('desktop, foreign repo, draft, malformed tags, missing asset and bad digest suppressed',()=>{
 for(const bad of [
  event({tag:'ui-preview-v0.1.0'}),
  event({repo:'attacker/MYTH-app'}),event({action:'edited'}),
  event({tag:'v0.1.5'}),event({tag:'ui-preview-v0.1.5/evil'}),
  event({assets:false}),event({size:900}),event({digest:'sha256:xyz'}),
 ]){
  assert.equal(parseReleaseEvent(bad),null);
 }
});
test('unsigned, malformed or unsupported service-account config fails closed',()=>{
 assert.throws(()=>makeServiceAccountJwt({}),/credentials/);
});
test('OAuth RS256 proof and FCM POST only for an eligible published release',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const sa={type:'service_account',project_id:'mythchain-df44c',
  client_email:'test@mythchain-df44c.iam.gserviceaccount.com',
  private_key:privateKey.export({type:'pkcs8',format:'pem'})};
 const calls=[];
 const fakeFetch=async(url,opts)=>{
  calls.push({url,opts});
  if(url.includes('oauth2.googleapis.com'))return {ok:true,json:async()=>({access_token:'MOCK-DO-NOT-USE'})};
  if(url.includes('fcm.googleapis.com'))return {ok:true,json:async()=>({name:'projects/fixture/messages/1'})};
  throw Error('Unexpected external destination');
 };
 const result=await sendReleasePush(event(),sa,fakeFetch);
 assert.equal(result.sent,true);
 assert.equal(calls.length,2);
 assert.equal(calls[0].opts.method,'POST');
 const jwt=new URLSearchParams(calls[0].opts.body).get('assertion');
 const [h,p,s]=jwt.split('.');
 assert.equal(JSON.parse(Buffer.from(p,'base64url')).scope,'https://www.googleapis.com/auth/firebase.messaging');
 const verifier=createVerify('RSA-SHA256');verifier.update(h+'.'+p);verifier.end();
 assert.equal(verifier.verify(publicKey,Buffer.from(s,'base64url')),true);
 assert.equal(calls[1].url,'https://fcm.googleapis.com/v1/projects/mythchain-df44c/messages:send');
 const body=JSON.parse(calls[1].opts.body);
 assert.equal(body.message.topic,'myth_android_preview_updates');
 assert.equal(body.message.data.sha256,sha);
});
test('never makes an OAuth/FCM request for unrelated release',async()=>{
 const r=await sendReleasePush(event({tag:'ui-preview-v0.1.0'}),{},()=>{throw Error('must not call network')});
 assert.equal(r.sent,false);
});
test('FCM failure propagates, no false sent result',async()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const sa={type:'service_account',project_id:'mythchain-df44c',
  client_email:'test@mythchain-df44c.iam.gserviceaccount.com',
  private_key:privateKey.export({type:'pkcs8',format:'pem'})};
 let n=0;
 await assert.rejects(()=>sendReleasePush(event(),sa,async()=>{
  n++;return n===1?{ok:true,json:async()=>({access_token:'MOCK'})}:{ok:false,status:403};
 }),/Firebase push rejected/);
});

test('publisher resolves an asset that becomes available after the published event',async()=>{
 const pending=event({assets:false});
 let fetched=0,waited=0;
 const lookup=async(url,opts)=>{
  assert.equal(url,'https://api.github.com/repos/annabil-dev/MYTH-app/releases/tags/ui-preview-v0.1.5');
  assert.equal(opts.headers.Authorization,'Bearer MOCK');
  fetched++;
  const assets=fetched===1?[]:event().release.assets;
  return {ok:true,json:async()=>({assets})};
 };
 const resolved=await resolvePublishedAsset(pending,'MOCK',lookup,async()=>{waited++});
 assert.equal(parseReleaseEvent(resolved).versionCode,6);
 assert.equal(fetched,2);
 assert.equal(waited,1);
});
test('publisher never reads API for unrelated release',async()=>{
 const r=await resolvePublishedAsset(event({tag:'ui-preview-v0.1.0'}),'x',()=>{throw Error('no network')});
 assert.equal(parseReleaseEvent(r),null);
});

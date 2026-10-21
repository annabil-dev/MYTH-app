/**
 * MYTH Android release.published -> Firebase Cloud Messaging topic.
 * Runs only inside the GitHub Actions workflow for annabil-dev/MYTH-app.
 * Firebase service account is loaded from encrypted GitHub Actions Secret;
 * never embedded in repository files or Android APK.
 */
import {createSign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const REPO='annabil-dev/MYTH-app';
export const PACKAGE_ID='io.mythchain.myth.preview';
export const FCM_PROJECT='mythchain-df44c';
export const TOPIC='myth_android_preview_updates';
const VERSION_TAG=/^ui-preview-v0\.1\.([1-9][0-9]{0,4})$/;
const SHA=/^sha256:([0-9a-f]{64})$/;

export function parseReleaseEvent(event){
  if(event?.action!=='published' ||
      event.repository?.full_name!==REPO ||
      event.release?.draft!==false ||
      event.release?.prerelease!==true) return null;
  const tag=event.release.tag_name;
  const match=VERSION_TAG.exec(tag??'');
  if(!match)return null;
  const patch=Number(match[1]);
  if(!Number.isSafeInteger(patch) || patch>99998)return null;
  const version='0.1.'+patch;
  const apk='MYTH-Android-UI-Preview-v'+version+'.apk';
  const asset=(event.release.assets??[]).find(x=>
    x?.name===apk && x.state==='uploaded' &&
    Number.isSafeInteger(x.size) && x.size>=50000);
  if(!asset)return null;
  const digest=SHA.exec(asset.digest??'');
  if(!digest)return null;
  return {
    packageId:PACKAGE_ID,
    versionCode:patch+1,
    versionName:version+'-ui-preview',
    downloadUrl:'https://github.com/'+REPO+'/releases/download/'+tag+'/'+apk,
    sha256:digest[1]
  };
}

export function toFcmRequest(release){
  if(release?.packageId!==PACKAGE_ID || !Number.isSafeInteger(release.versionCode))
    throw Error('Invalid Android release');
  return {
    message:{
      topic:TOPIC,
      data:{
        type:'MYTH_ANDROID_RELEASE',
        packageId:release.packageId,
        versionCode:String(release.versionCode),
        versionName:release.versionName,
        downloadUrl:release.downloadUrl,
        sha256:release.sha256
      },
      android:{
        priority:'HIGH',
        ttl:'604800s',
        collapse_key:'myth_android_latest_release'
      }
    }
  };
}

/**
 * GitHub release publication can race with asset finalization.
 * This bounded event-triggered refresh is NOT mobile polling.
 */
export async function resolvePublishedAsset(event,ghToken,fetcher=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms))){
  if(event?.action!=='published'||event.repository?.full_name!==REPO||
    event.release?.draft!==false||event.release?.prerelease!==true||
    !VERSION_TAG.test(event.release?.tag_name??''))return event;
  if(parseReleaseEvent(event))return event;
  const url='https://api.github.com/repos/'+REPO+
    '/releases/tags/'+encodeURIComponent(event.release.tag_name);
  for(let attempt=0;attempt<8;attempt++){
    const res=await fetcher(url,{
      method:'GET',
      headers:{
        Accept:'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28',
        ...(ghToken?{Authorization:'Bearer '+ghToken}:{})
      }
    });
    if(!res.ok)throw Error('GitHub release API HTTP '+res.status);
    const fresh=await res.json();
    const updated={...event,release:{...event.release,assets:fresh.assets??[]}};
    if(parseReleaseEvent(updated))return updated;
    if(attempt<7)await wait(2000);
  }
  return event;
}
export function makeServiceAccountJwt(account,now=Math.floor(Date.now()/1000)){
  if(account?.type!=='service_account' ||
     account.project_id!==FCM_PROJECT ||
     typeof account.client_email!=='string' ||
     !account.client_email.endsWith('.gserviceaccount.com') ||
     typeof account.private_key!=='string' ||
     !account.private_key.includes('-----BEGIN PRIVATE KEY-----'))
     throw Error('Firebase release publisher credentials not configured for MYTHCHAIN');
  const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload={
    iss:account.client_email,
    sub:account.client_email,
    aud:'https://oauth2.googleapis.com/token',
    iat:now,
    exp:now+3600,
    scope:'https://www.googleapis.com/auth/firebase.messaging'
  };
  const unsigned=b64({alg:'RS256',typ:'JWT'})+'.'+b64(payload);
  const signature=createSign('RSA-SHA256').update(unsigned).end()
    .sign(account.private_key,'base64url');
  return unsigned+'.'+signature;
}

export async function sendReleasePush(event,serviceAccount,fetcher=fetch){
  const release=parseReleaseEvent(event);
  if(!release)return {sent:false,reason:'not_android_release'};
  const assertion=makeServiceAccountJwt(serviceAccount);
  const grant=await fetcher('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  if(!grant.ok)throw Error('Google OAuth HTTP '+grant.status);
  const tokens=await grant.json();
  if(typeof tokens?.access_token!=='string'||!tokens.access_token)
    throw Error('Google OAuth did not return a token');
  const result=await fetcher('https://fcm.googleapis.com/v1/projects/'+FCM_PROJECT+'/messages:send',{
    method:'POST',
    headers:{
      Authorization:'Bearer '+tokens.access_token,
      'Content-Type':'application/json'
    },
    body:JSON.stringify(toFcmRequest(release))
  });
  if(!result.ok)throw Error('Firebase push rejected: HTTP '+result.status);
  const receipt=await result.json();
  if(typeof receipt.name!=='string'||!receipt.name)
    throw Error('Firebase returned no message identifier');
  return {sent:true,versionName:release.versionName};
}

async function main(){
  if(process.env.GITHUB_EVENT_NAME!=='release'||
      process.env.GITHUB_REPOSITORY!==REPO||
      !process.env.GITHUB_EVENT_PATH)
    throw Error('Release publisher runs only on MYTH-app GitHub release events');
  const raw=process.env.MYTH_FCM_SERVICE_ACCOUNT_JSON;
  if(!raw)throw Error('MYTH_FCM_SERVICE_ACCOUNT_JSON repository secret is missing');
  const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  if(event.action!=='published'||event.repository?.full_name!==REPO||
     event.release?.draft!==false||event.release.prerelease!==true||
     !VERSION_TAG.test(event.release.tag_name??'')){
    console.log('Skipping unrelated release; no Firebase credentials used');
    return;
  }
  const published=await resolvePublishedAsset(event,process.env.GITHUB_TOKEN);
  if(!parseReleaseEvent(published))
    throw Error('Android release APK or SHA-256 digest not ready');
  // JSON.parse errors include the beginning of the input, which may contain
  // secret material. Never emit the original parse error to Actions logs.
  let account;
  try { account=JSON.parse(raw); }
  catch { throw Error('MYTH_FCM_SERVICE_ACCOUNT_JSON must be a complete service-account JSON file in GitHub Secrets'); }
  const response=await sendReleasePush(published,account);
  console.log(response.sent ? 'FCM accepted notification for '+response.versionName : 'Skipped');
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().catch(error=>{
    // Never print tokens, key material, HTTP response bodies or exceptions containing secrets.
    console.error('MYTH release notification publisher failed: '+error.message);
    process.exitCode=1;
  });
}

/**
 * Onboarding has two estimated checking windows:
 * - up to 10 visible cloud-setup checks;
 * - up to 14 visible Firestore connection checks.
 *
 * A 25th, final slot is intentionally reserved for verified success only.
 * These are experience-based estimates, NOT an elapsed-time percentage.
 * Never report 100% here: the wizard switches to "ready" only after the
 * Firestore session has actually been initialized and read back.
 */
export const CLOUD_CHECK_SLOTS=10;
export const FIRESTORE_CHECK_SLOTS=14;
export const SETUP_PROGRESS_SLOTS=CLOUD_CHECK_SLOTS+FIRESTORE_CHECK_SLOTS+1;
export const MAX_UNVERIFIED_SLOTS=SETUP_PROGRESS_SLOTS-1;

export type SetupProgressEvent=
 | {stage:'cloud';kind:'check'}
 | {stage:'firestore';kind:'check';attempt:number};

export type SetupNotify=(message:string,event?:SetupProgressEvent)=>void;

export function advanceSetupProgress(previous:number,event:SetupProgressEvent):number{
 const current=Math.max(0,Math.min(MAX_UNVERIFIED_SLOTS,Math.floor(previous)));
 if(event.stage==='cloud')return current>=CLOUD_CHECK_SLOTS?current:current+1;
 const checked=Math.max(1,Math.min(FIRESTORE_CHECK_SLOTS,Math.floor(event.attempt)));
 return Math.min(MAX_UNVERIFIED_SLOTS,Math.max(current,CLOUD_CHECK_SLOTS+checked));
}

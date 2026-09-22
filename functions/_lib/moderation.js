const BLOCKED = [
  'fuck','shit','ass','asshole','bitch','bastard','damn','dick','cock',
  'pussy',' cunt','slut','whore','nigger','nigga','faggot','retard',
  'crap','piss','hell','bollocks','wanker','twat','prick','tosser',
  'motherfucker','mofucka','penis','vagina','booty','boob','tits',
  'nazi','hitler','kkk','chink','spic','wetback','kike','gook',
  'trash','scum','loser','noob','idiot','stupid','dumb','ugly',
  'admin','moderator','staff','system','root','superuser'
];

export function hasProfanity(str) {
  if (!str) return false;
  const lower = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let i = 0; i < BLOCKED.length; i++) {
    const w = BLOCKED[i].replace(/[^a-z0-9]/g, '');
    if (lower.includes(w)) return true;
  }
  return false;
}

const rateBuckets = new Map();

export function checkRateLimit(key, max, windowMs) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 1 };
    rateBuckets.set(key, bucket);
    return true;
  }
  bucket.count++;
  if (bucket.count > max) return false;
  return true;
}



/** Rules for an explicitly migrated group. Never publish before data seeding. */
export const PROTECTED_GROUP_RULES=`rules_version = '2';
service cloud.firestore {
 match /databases/{database}/documents {
  function leader() {
   return request.auth != null
     && request.auth.uid == get(/databases/$(database)/documents/access/config).data.leaderUid
     && (
       (get(/databases/$(database)/documents/access/config).data.pinChangedAt is int
         && request.auth.token.auth_time >= get(/databases/$(database)/documents/access/config).data.pinChangedAt)
       || (get(/databases/$(database)/documents/access/config).data.pinChangedAt is timestamp
         && request.auth.token.auth_time * 1000 >= get(/databases/$(database)/documents/access/config).data.pinChangedAt.toMillis())
     );
  }
  match /access/{document} {
   allow get: if document == 'status';
   // A fresh PIN sign-in may rotate the account password. Only the server
   // timestamp cutoff can change; owner identity and leader UID stay private.
   allow update: if document == 'config' && leader()
     && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['pinChangedAt'])
     && request.resource.data.pinChangedAt == request.time;
   allow list, create, delete: if false;
  }
  match /liveSessions/{sessionId} {
   allow get, update: if sessionId == 'current' && leader();
   allow create, list, delete: if false;
  }
  match /publicPlayers/{playerId} {
   allow get, list: if true;
   allow create: if request.resource.data.keys().hasOnly(['name'])
     && request.resource.data.name is string
     && request.resource.data.name.size() >= 1
     && request.resource.data.name.size() <= 50
     && (leader() ||
       getAfter(/databases/$(database)/documents/registrations/$(playerId)).data.name
         == request.resource.data.name);
   allow update, delete: if leader();
  }
  match /registrations/{playerId} {
   allow get, list: if leader();
   allow create: if request.resource.data.keys().hasOnly([
       'name','selfSkill','gender','height','createdAt'])
     && request.resource.data.keys().hasAll([
       'name','selfSkill','gender','height','createdAt'])
     && request.resource.data.name is string
     && request.resource.data.name.size() >= 1
     && request.resource.data.name.size() <= 50
     && request.resource.data.selfSkill is int
     && request.resource.data.selfSkill >= 1
     && request.resource.data.selfSkill <= 10
     && request.resource.data.gender in ['woman','man','other','unspecified']
     && (request.resource.data.height == null ||
       (request.resource.data.height is int
        && request.resource.data.height >= 36
        && request.resource.data.height <= 84))
     && request.resource.data.createdAt == request.time
     && getAfter(/databases/$(database)/documents/publicPlayers/$(playerId)).data.name
       == request.resource.data.name;
   allow update, delete: if leader();
  }
  match /attendance/{attendanceId} {
   allow get: if attendanceId == 'current';
   allow update: if attendanceId == 'current'
     && request.resource.data.keys().hasOnly(['checkedIn'])
     && request.resource.data.checkedIn is list
     && request.resource.data.checkedIn.size() <= 250
     && (leader() || (
       request.resource.data.checkedIn.toSet().size() == request.resource.data.checkedIn.size()
       && request.resource.data.checkedIn.removeAll(resource.data.checkedIn).size() <= 1
       && resource.data.checkedIn.removeAll(request.resource.data.checkedIn).size() <= 1
       && (request.resource.data.checkedIn.removeAll(resource.data.checkedIn).size() == 0
         || getAfter(/databases/$(database)/documents/publicPlayers/$(request.resource.data.checkedIn.removeAll(resource.data.checkedIn)[0])).data.name is string)
     ));
   allow create, list, delete: if false;
  }
  match /publicDisplays/{displayId} {
   allow get: if displayId == 'current' && resource.data.enabled == true;
   allow create, update: if displayId == 'current' && leader();
   allow list, delete: if false;
  }
  match /{document=**} {allow read, write: if false;}
 }
}`;

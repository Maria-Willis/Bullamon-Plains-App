// Bullamon Plains -- offline app shell.
//
// This caches the app's own files (not your farm data -- that's handled
// separately by the app itself, in localStorage) so the page can still
// open with no signal at all. Bump CACHE_NAME whenever the list of shell
// files below changes, OR whenever the *contents* of a file already in that
// list change (e.g. a recoloured icon, a new manifest.json) -- otherwise a
// device that already has this service worker installed keeps serving the
// old cached copy of that file indefinitely, even after the real file on
// the server has changed. (Bumped 2026-09-24: the green icon files were
// recoloured to blue, but devices with the old service worker were still
// showing the old green favicon/PWA icon from this cache until this bump.)
// (Bumped again 2026-09-25: index.html changed -- machinery icons moved to
// real files under icons/machinery/, plus the dashboard-issue-reappearing
// fix -- and the dozer/loader icon files themselves changed twice in the
// same day. Devices that had already loaded any of the old versions were
// still stuck on stale cached copies of index.html and/or the icon files
// until this bump, even after a fully successful GitHub/Vercel deploy.)
// (Bumped again 2026-09-25, later the same day: index.html changed again --
// Dashboard delete buttons added/opened up for the issues and reminders
// cards. Same reasoning as above; bumping every time index.html's contents
// change is now the standing practice, not a one-off.)
// (Bumped again 2026-09-25, a third time the same day: added a small visible
// APP_BUILD version tag in the sidebar next to the Refresh app button --
// after Maria correctly did everything right (uploaded both files, deploy
// succeeded) and still couldn't tell whether her device had picked up the
// changes, since there was no way to check that without comparing raw file
// contents. This tag now makes that instantly visible on-screen.)
// (Bumped again 2026-09-25, a fourth time the same day: removed the
// "Report a machinery issue" card from the Dashboard, at Maria's request.)
// (Bumped again 2026-09-25, a fifth time the same day: Safety Data Sheets
// redesigned into a searchable list + a categorised single-product detail
// page, with several brand new optional fields.)
// (Bumped again 2026-09-25, a sixth time the same day: 15 chemicals'
// worth of SDS detail filled in from real, cited web research at Maria's
// request, plus a display-bug fix so already-researched chemicals' poison
// schedule/signal word are no longer hidden on the new detail page.)
var CACHE_NAME = "bullamon-plains-shell-v8";

var SHELL_ASSETS = [
  "./",
  "./index.html",
  "./config.js",
  "./manifest.json",
  "./icons/favicon.ico",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// The Supabase client library itself, so it's still available to load
// offline -- without this, a device with no cached copy of it yet would
// see window.supabase as undefined and have no way to even try syncing
// once back in range.
var CROSS_ORIGIN_ASSETS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){
        return cache.addAll(SHELL_ASSETS).then(function(){
          return Promise.all(CROSS_ORIGIN_ASSETS.map(function(url){
            return fetch(url, { mode: "no-cors" })
              .then(function(res){ return cache.put(url, res); })
              .catch(function(){ /* offline on first install -- fine, just skip it for now */ });
          }));
        });
      })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys()
      .then(function(names){
        return Promise.all(names.filter(function(n){ return n !== CACHE_NAME; }).map(function(n){ return caches.delete(n); }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  if(req.method !== "GET") return; // never intercept Supabase reads/writes -- those are POST/PATCH, or GETs to a different origin we don't touch below

  var url = new URL(req.url);
  var isShellCrossOrigin = CROSS_ORIGIN_ASSETS.indexOf(req.url) > -1;
  // Uploaded map photos/PDFs, and bulls' attached PDFs, live in Supabase
  // Storage, a different origin from the app itself -- matched by path
  // rather than a fixed URL (unlike CROSS_ORIGIN_ASSETS above) since it
  // needs to work for any file added to either the "maps" or "bulls"
  // bucket, not just files known in advance.
  var isCachedStorageFile = url.pathname.indexOf("/storage/v1/object/public/maps/") > -1 ||
    url.pathname.indexOf("/storage/v1/object/public/bulls/") > -1;
  if(url.origin !== self.location.origin && !isShellCrossOrigin && !isCachedStorageFile) return; // let Supabase's own API calls go straight to the network, untouched

  event.respondWith(
    caches.match(req).then(function(cached){
      var fetchPromise = fetch(req, isShellCrossOrigin ? { mode: "no-cors" } : {})
        .then(function(res){
          if(res && (res.ok || res.type === "opaque")){
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
          }
          return res;
        })
        .catch(function(){ return null; });
      // Serve the cached copy immediately when we have one (fast, and
      // works offline); refresh it in the background either way so the
      // next load picks up anything new once there's a connection again.
      return cached || fetchPromise;
    })
  );
});

// The page (index.html) asks us to proactively download every current map
// photo/PDF and bull-attachment PDF, right after it loads fresh farm data --
// so these still work offline even for a file nobody's actually opened on
// this device yet, not only ones a fetch/<img> has already caused us to
// cache above. Skips anything already cached, so this never re-downloads a
// file that hasn't changed. (Still called "cacheMapFiles" for both kinds of
// file -- see prefetchStorageFilesForOffline() in index.html.)
self.addEventListener("message", function(event){
  var msg = event.data;
  if(!msg || msg.type !== "cacheMapFiles" || !Array.isArray(msg.urls)) return;
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return Promise.all(msg.urls.map(function(url){
        return cache.match(url).then(function(existing){
          if(existing) return; // already have it -- don't re-download
          return fetch(url, { mode: "cors" }).then(function(res){
            if(res && res.ok){ return cache.put(url, res); }
          }).catch(function(){ /* offline, or blocked -- will retry on the next successful sync */ });
        });
      }));
    })
  );
});

// Push notifications -- see "Get notified of new notes" on the Dashboard in
// index.html. A push arrives here from Supabase's notify-new-dashboard-note
// Edge Function (triggered by a database webhook whenever a new Dashboard
// note is added), carrying a small JSON payload -- this just displays it as
// a normal system notification, which is what lets it show up even if
// nobody has the app open at the time.
self.addEventListener("push", function(event){
  var data = {};
  try{
    data = event.data ? event.data.json() : {};
  }catch(e){
    data = { title: "Bullamon Plains", body: event.data ? event.data.text() : "You have a new notification." };
  }
  var title = data.title || "Bullamon Plains";
  var options = {
    body: data.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    data: { url: data.url || "./" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses an already-open tab if there is one,
// rather than always opening a new one.
self.addEventListener("notificationclick", function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList){
      for(var i = 0; i < clientList.length; i++){
        if("focus" in clientList[i]) return clientList[i].focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

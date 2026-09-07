
// Bullamon Plains -- offline app shell.
//
// This caches the app's own files (not your farm data -- that's handled
// separately by the app itself, in localStorage) so the page can still
// open with no signal at all. Bump CACHE_NAME whenever the list of shell
// files below changes, so old devices clean up the previous cache.
var CACHE_NAME = "bullamon-plains-shell-v1";

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
  // Uploaded map photos/PDFs live in Supabase Storage, a different origin
  // from the app itself -- matched by path rather than a fixed URL (unlike
  // CROSS_ORIGIN_ASSETS above) since it needs to work for any file added to
  // the "maps" bucket, not just files known in advance.
  var isMapFile = url.pathname.indexOf("/storage/v1/object/public/maps/") > -1;
  if(url.origin !== self.location.origin && !isShellCrossOrigin && !isMapFile) return; // let Supabase's own API calls go straight to the network, untouched

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
// photo/PDF, right after it loads fresh farm data -- so Maps still works
// offline even for a file nobody's actually opened on this device yet, not
// only ones a fetch/<img> has already caused us to cache above. Skips
// anything already cached, so this never re-downloads a file that hasn't
// changed.
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

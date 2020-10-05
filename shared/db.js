"use strict";
/* exported livemarksDB */

const livemarksDB = function() {
  const DB_NAME = "livemarks";
  const DB_VERSION = 1;
    
  return new Promise((res, rej) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = rej;
    request.onupgradeneeded = function (ev) {
      const db = ev.target.result;
      /*const objectStore = */db.createObjectStore(DB_NAME, { keyPath: "url" });
    };
    request.onsuccess = function (ev) {
      const db = ev.target.result;
      res ({
        addURL(url) {
          const transaction = db.transaction(DB_NAME, "readwrite");
          const readurls = transaction.objectStore(DB_NAME);
          return new Promise((res, rej) => {
            const req = readurls.add({url});
            req.onerror = rej;
            req.onsuccess = res;
          });
        },
        findURL(url) {
          const transaction = db.transaction(DB_NAME);
          const readurls = transaction.objectStore(DB_NAME);
          return new Promise(res => {
            const req = readurls.get(url);
            req.onerror = () => res(null);
            req.onsuccess = e => res(req.result||null);
          });
        }
      })
    };
        
  })
};

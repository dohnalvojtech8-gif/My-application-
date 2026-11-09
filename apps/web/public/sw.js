self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
// Financial responses and authenticated pages are deliberately never cached.
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="cs"><meta name="viewport" content="width=device-width"><title>SYSTEMATIC MONEY</title><h1>Jste offline</h1><p>Pro bezpečné načtení financí se připojte k internetu.</p><button onclick="location.reload()">Zkusit znovu</button>',{headers:{'Content-Type':'text/html;charset=utf-8'}})))});
self.addEventListener('push',event=>{const data=event.data?.json()||{};event.waitUntil(self.registration.showNotification(data.title||'SYSTEMATIC MONEY',{body:'Máte upozornění na platbu.',icon:'/icon.svg',data:{url:'/?date='+encodeURIComponent(data.date||'')}}))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.openWindow(event.notification.data?.url||'/'))});

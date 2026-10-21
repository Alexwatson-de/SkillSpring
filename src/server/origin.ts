import { requireThat } from '@/lib/domain';
// Next may bind to 0.0.0.0 or an internal host. Trust the configured public
// application origin as well as the runtime URL, never arbitrary forwarded headers.
export function assertSameOrigin(req:Request){const origin=req.headers.get('origin');const allowed=new Set([new URL(req.url).origin]);if(process.env.NEXT_PUBLIC_SITE_URL){try{allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);}catch{}}requireThat(!origin||allowed.has(origin),'Untrusted request origin',403);}

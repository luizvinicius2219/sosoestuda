import assert from 'node:assert/strict';
import test from 'node:test';
import {publicAddress,publicUrl,pageText} from '../lib/public-page.ts';

test('public page lookup rejects private networks, metadata addresses and IPv4-mapped IPv6',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','fe80::1','fc00::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
 for(const ip of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(publicAddress(ip),true,ip);
});
test('only public HTTPS hostnames without credentials or custom ports may be fetched',()=>{
 for(const url of ['http://example.com','https://127.0.0.1','https://[::1]','https://metadata.internal','https://localhost','https://user:secret@example.com','https://example.com:8443','file:///etc/passwd'])assert.throws(()=>publicUrl(url));
 assert.equal(publicUrl('https://www.tjsp.jus.br/').hostname,'www.tjsp.jus.br');
});
test('page text removes executable/style markup and limits untrusted input in the model context',()=>{
 const page=pageText('<title>Tribunal &amp; concurso</title><style>secret style</style><script>unsafe()</script><p>Inscrições &#x32; abertas.</p><p>Confira a fonte.</p>');
 assert.equal(page.title,'Tribunal & concurso');assert.ok(page.text.includes('Inscrições 2 abertas.'));assert.ok(!page.text.includes('unsafe()'));assert.ok(!page.text.includes('secret style'));
 assert.equal(pageText('<p>'+'x'.repeat(50000)+'</p>').text.length,15000);
});

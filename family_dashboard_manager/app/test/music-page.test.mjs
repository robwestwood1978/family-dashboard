import test from 'node:test';
import assert from 'node:assert/strict';
import {musicIdentity,musicImage,musicMatches,musicQueue,normaliseMusicItem} from '../frontend/music-page.js';
const current={attributes:{media_title:'Current song',media_artist:'Example artist',media_content_id:'x-sonos-spotify:spotify%3atrack%3acurrent?sid=9'}};
test('Spotify identities agree across native Sonos and Music Assistant URIs',()=>{
  assert.equal(musicIdentity(current.attributes.media_content_id),musicIdentity('spotify://track/current'));
  assert.equal(musicIdentity('spotify--example-provider://track/current'),musicIdentity('spotify:track:current'));
  assert.equal(musicIdentity('spotify://playlist/weekend'),'spotify:playlist:weekend');
  assert.equal(musicIdentity('spotify://album/example'),'spotify:album:example');
  assert.equal(musicImage('javascript:alert(1)'), '');assert.equal(musicImage('//untrusted.example/image'),'');
  assert.equal(musicImage('/api/image/1'),'/api/image/1');
});
test('Up next slices the actual current queue and preserves absolute Sonos positions',()=>{
  const response={response:{'media_player.example':[{media_title:'Before'},{media_title:'Current song',media_artist:'Example artist',media_content_id:'spotify://track/current'},{media_title:'After',media_content_id:'spotify://track/after'}]}};
  const q=musicQueue(response,'media_player.example',current,'Sonos');
  assert.equal(q.positionKnown,true);assert.deepEqual(q.items.map(i=>[i.name,i.position]),[['After',2]]);
  const stale=musicQueue(response,'media_player.example',{attributes:{media_title:'A different source'}},'Sonos');
  assert.equal(stale.positionKnown,false);assert.equal(stale.items.length,3);
  assert.throws(()=>musicQueue({response:{'media_player.other':[]}},'media_player.example',current,'Sonos'));
});
test('A retained Music Assistant track is never treated as the native current track',()=>{
  assert.equal(musicMatches(normaliseMusicItem({media_title:'Retained song',media_artist:'Other artist'}),current),false);
  assert.equal(musicMatches(normaliseMusicItem({media_title:'Current song',media_artist:'Example artist'}),current),true);
  assert.equal(musicMatches(normaliseMusicItem({media_title:'Current song'}),{attributes:{}}),false);
});

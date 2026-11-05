import test from 'node:test';
import assert from 'node:assert/strict';
import {musicIdentity,musicImage,musicMatches,musicQueue,musicManagedPlayback,musicProgress,normaliseMusicItem} from '../frontend/music-page.js';
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

test('Direct Spotify ownership wins over a retained matching MA song',()=>{
  const assistant={state:'playing',attributes:{media_title:'Current song',media_artist:'Example artist',media_content_id:'spotify--example://track/current'}};
  assert.equal(musicManagedPlayback({...current,state:'playing'},assistant),false);
  const managed={state:'playing',attributes:{media_title:'Current song',media_artist:'Example artist',media_content_id:'http://music.example/flow/stream'}};
  assert.equal(musicManagedPlayback(managed,assistant),true);
  assert.equal(musicManagedPlayback(managed,{...assistant,state:'paused'}),false);
});

test('Playback time advances only while playing and never exceeds the song',()=>{
  const now=Date.parse('2026-08-24T15:08:00Z');
  const attrs={media_duration:200,media_position:50,media_position_updated_at:'2026-08-24T15:07:30Z'};
  assert.deepEqual(musicProgress({state:'playing',attributes:attrs},now),{duration:200,position:80});
  assert.equal(musicProgress({state:'paused',attributes:attrs},now).position,50);
  assert.equal(musicProgress({state:'playing',attributes:{...attrs,media_position:500}},now).position,200);
  assert.deepEqual(musicProgress({state:'playing',attributes:{}},now),{duration:0,position:0});
});

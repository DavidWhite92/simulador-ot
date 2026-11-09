import { useEffect } from 'react';

let player, background = null, current = null, cue = false, volume = 0.5, muted = false;
function audio() {
  if (!player) {
    player = new Audio();
    player.addEventListener('ended', () => { cue = false; play(background); });
    player.addEventListener('error', () => { cue = false; });
  }
  return player;
}
function play(track, oneShot = false) {
  const p = audio();
  p.pause();
  current = track;
  cue = oneShot;
  if (!track) return;
  p.src = `/audio/${track}.mp3`;
  p.loop = !oneShot;
  p.volume = volume;
  p.muted = muted;
  p.play().catch(() => {});
}
export function setMusicVolume(value, silence) {
  volume = value; muted = silence;
  const p = audio(); p.volume = value; p.muted = silence;
}
export function unlockMusic() {
  if (current && audio().paused) audio().play().catch(() => {});
}
export function useMusicBackground(track, identity) {
  useEffect(() => { background = track; play(track); return () => { background = null; play(null); }; }, [track, identity]);
}
export function useMusicCue(track, identity) {
  useEffect(() => {
    if (track) play(track, true);
    return () => { if (track && cue) { cue = false; play(background); } };
  }, [track, identity]);
}

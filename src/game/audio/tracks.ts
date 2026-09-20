// The shipped music tracks. A new theme is a JSON drop plus one line here — the
// same shape as the animation defs (assets/anim + battleAnim.ts). Validation
// runs at module load (buildTracks → parseTrack throws on a bad note or id), so
// a malformed track fails at startup rather than playing silence.
import { buildTracks, createMusicPlayer } from './music';
import type { MusicPlayer, Track } from './music';
import battle from '../../../assets/music/music.battle.track.json';
import title from '../../../assets/music/music.title.track.json';
import victory from '../../../assets/music/music.victory.track.json';

export const MUSIC_TRACKS: ReadonlyMap<string, Track> = buildTracks([battle, title, victory]);

export function createMusic(): MusicPlayer {
  return createMusicPlayer(MUSIC_TRACKS);
}

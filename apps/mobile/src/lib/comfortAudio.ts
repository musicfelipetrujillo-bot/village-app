// Comfort sounds — shushing / white noise / rain, for the 3am one-handed moment.
//
// THE WHOLE POINT is that the sound KEEPS PLAYING once she puts the phone down:
// screen locked, app backgrounded, baby on her chest. That needs two things the
// current binary does not have:
//   1. `expo-audio` (no audio library ships in the app today), and
//   2. `UIBackgroundModes: ['audio']` in app.json (added, applies on prebuild).
// Both are NATIVE. They light up on the next EAS build — nothing here can be
// turned on by an OTA.
//
// So the import is DYNAMIC, exactly like lib/pro.ts does for react-native-purchases:
// a top-level import of a native module that is absent from the current binary
// crashes the app at launch. Every entry point below fails soft, so the Reset &
// Recharge screen ships over the air today and simply reports the sounds as not
// available yet rather than exploding.

export type ComfortSoundId = 'shush' | 'white_noise' | 'rain';

export interface ComfortSound {
  id: ComfortSoundId;
  emoji: string;
  /** en/es labels live at the call site; this stays data-only. */
  labelEn: string;
  labelEs: string;
  /**
   * require()'d audio asset. NULL until the files land in assets/audio/.
   * Deliberately not a remote URL: at 3am on bad wifi a stream that buffers is
   * worse than no button at all, so these ship in the bundle.
   */
  source: number | null;
}

export const COMFORT_SOUNDS: ComfortSound[] = [
  { id: 'shush', emoji: '🤫', labelEn: 'shushing', labelEs: 'shhh', source: null },
  { id: 'white_noise', emoji: '🌊', labelEn: 'white noise', labelEs: 'ruido blanco', source: null },
  { id: 'rain', emoji: '🌧️', labelEn: 'rain', labelEs: 'lluvia', source: null },
];

/** Sleep-timer choices, in minutes. `null` = keep going until she stops it. */
export const SLEEP_TIMERS: (number | null)[] = [15, 30, 60, null];

export class ComfortAudioUnavailableError extends Error {
  constructor() { super('comfort_audio_unavailable'); }
}

/** True once a build actually contains expo-audio AND an asset exists. */
export function isComfortAudioReady(sound: ComfortSound): boolean {
  return sound.source !== null;
}

// Dynamic import ONLY — see the header. Never hoist this to a top-level import.
async function getAudioModule(): Promise<any> {
  try {
    return await import('expo-audio');
  } catch {
    throw new ComfortAudioUnavailableError();
  }
}

let current: { id: ComfortSoundId; player: any } | null = null;
let timerHandle: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timerHandle) { clearTimeout(timerHandle); timerHandle = null; }
}

/** What is playing right now, if anything. Drives the tile's active state. */
export function playingSoundId(): ComfortSoundId | null {
  return current?.id ?? null;
}

/**
 * Start a looping comfort sound, replacing whatever was playing.
 * @param minutes sleep timer; null keeps it going until stopped.
 */
export async function playComfortSound(sound: ComfortSound, minutes: number | null): Promise<void> {
  if (!isComfortAudioReady(sound)) throw new ComfortAudioUnavailableError();
  const Audio = await getAudioModule();
  await stopComfortSound();

  // staysActiveInBackground + playsInSilentMode are the two settings that make
  // this survive the lock screen and the ringer switch — a mom who silenced her
  // phone for the baby still needs the white noise to come out.
  await Audio.setAudioModeAsync?.({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'mixWithOthers',
  });

  const player = Audio.createAudioPlayer(sound.source);
  player.loop = true;
  player.play();
  current = { id: sound.id, player };

  clearTimer();
  if (minutes != null) {
    timerHandle = setTimeout(() => { void stopComfortSound(); }, minutes * 60_000);
  }
}

export async function stopComfortSound(): Promise<void> {
  clearTimer();
  const active = current;
  current = null;
  if (!active) return;
  try {
    active.player.pause?.();
    active.player.remove?.();
  } catch { /* the player may already be gone — nothing to recover */ }
}

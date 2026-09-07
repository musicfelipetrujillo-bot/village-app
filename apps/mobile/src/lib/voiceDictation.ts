// Voice dictation — the Home mic button's speech-to-text.
//
// She holds the baby in one arm. Typing "why is she waking every 40 minutes"
// with a thumb at 3am is the thing that doesn't happen. The mic on Home turns
// that into: tap, talk, and the question lands in the Villie chat already sent.
//
// ON-DEVICE ONLY. `requiresOnDeviceRecognition` keeps the audio on the phone —
// nothing about a baby's feeding, a mom's mood, or a medication name goes to
// Apple's servers. That is a deliberate posture for a maternal-health app, and
// it is why an unsupported locale surfaces an honest "not available" rather
// than silently falling back to network recognition. Flip ON_DEVICE_ONLY to
// false only with a privacy-notice review — it changes where the audio goes.
//
// The import is DYNAMIC, exactly like lib/comfortAudio.ts and lib/pro.ts.
// `expo-speech-recognition` calls `requireNativeModule()` at import time, which
// THROWS in a binary that predates the native module. Home renders for every
// user on every build, so a top-level import here would white-screen the app
// the moment this JS ships over the air to Build 12 or earlier. Every entry
// point below fails soft and the caller falls back to the text composer.
//
// NATIVE, NOT OTA: this needs NSMicrophoneUsageDescription +
// NSSpeechRecognitionUsageDescription in Info.plist (both added in app.json).
// It lights up on the next EAS build — no OTA can turn it on.

export type VoiceLang = 'en' | 'es';

/** See the header. Keep true unless the privacy notice is updated first. */
export const ON_DEVICE_ONLY = true;

export class VoiceDictationUnavailableError extends Error {
  constructor() { super('voice_dictation_unavailable'); }
}

// Dynamic import ONLY — see the header. Never hoist this to a top-level import.
// `undefined` = not tried yet, `null` = tried and this binary can't do it.
let cachedModule: any | null | undefined;

async function loadModule(): Promise<any> {
  if (cachedModule === null) throw new VoiceDictationUnavailableError();
  if (cachedModule) return cachedModule;
  try {
    const mod = await import('expo-speech-recognition');
    cachedModule = mod.ExpoSpeechRecognitionModule;
    return cachedModule;
  } catch {
    cachedModule = null;
    throw new VoiceDictationUnavailableError();
  }
}

export const getSpeechModule = loadModule;

/**
 * True when this binary actually contains the native recognizer. Call this
 * BEFORE opening any voice UI — on a build without it, the caller should drop
 * straight to the text composer rather than showing a sheet that can't work.
 */
export async function isVoiceDictationAvailable(): Promise<boolean> {
  try {
    await loadModule();
    return true;
  } catch {
    return false;
  }
}

/**
 * BCP-47 tag for the recognizer. Mirrors the app's EN/ES toggle — a Spanish-
 * preference mom dictating in Spanish into an en-US recognizer gets garbage,
 * which reads as "voice is broken" rather than "wrong language".
 */
export function dictationLocale(lang: VoiceLang): string {
  return lang === 'es' ? 'es-US' : 'en-US';
}

/**
 * Copy for a failed dictation. Every branch ends somewhere she can still act —
 * the sheet always offers "type instead", so none of these is a dead end.
 */
export function dictationErrorMessage(code: string | null, lang: VoiceLang): string {
  const es = lang === 'es';
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return es
        ? 'villie necesita permiso para el micrófono. Actívalo en Ajustes › villie.'
        : 'villie needs microphone access. Turn it on in Settings › villie.';
    case 'no-speech':
    case 'speech-timeout':
      return es ? 'No escuché nada. Inténtalo de nuevo.' : "I didn't catch that. Try again.";
    case 'language-not-supported':
      return es
        ? 'El dictado sin conexión no está disponible en español en este teléfono.'
        : "On-device dictation isn't available for this language on this phone.";
    case 'audio-capture':
      return es ? 'No pude usar el micrófono.' : "I couldn't reach the microphone.";
    case 'interrupted':
      return es ? 'Algo interrumpió la grabación.' : 'Something interrupted the recording.';
    case 'busy':
      return es ? 'El micrófono está ocupado. Inténtalo de nuevo.' : 'The microphone is busy. Try again.';
    case 'network':
      return es ? 'Sin conexión para el reconocimiento de voz.' : 'Speech recognition needs a connection right now.';
    default:
      return es ? 'El dictado no funcionó esta vez.' : "Dictation didn't work this time.";
  }
}

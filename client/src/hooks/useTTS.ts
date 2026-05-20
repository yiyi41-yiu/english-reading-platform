import { useCallback } from "react";

export function useTTS() {
  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;

    // Try to find a good English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google"))
      || voices.find(v => v.lang.startsWith("en-US"))
      || voices.find(v => v.lang.startsWith("en"));
    if (englishVoice) utterance.voice = englishVoice;

    window.speechSynthesis.speak(utterance);
  }, []);

  const speakWord = useCallback((word: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const cleanWord = word.replace(/[^a-zA-Z'-]/g, "");
    if (!cleanWord) return;

    const utterance = new SpeechSynthesisUtterance(cleanWord);
    utterance.lang = "en-US";
    utterance.rate = 0.8;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google"))
      || voices.find(v => v.lang.startsWith("en-US"))
      || voices.find(v => v.lang.startsWith("en"));
    if (englishVoice) utterance.voice = englishVoice;

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak, speakWord };
}

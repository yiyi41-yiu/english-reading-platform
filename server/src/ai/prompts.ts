type PromptInput = Record<string, string | undefined>;

const prompts: Record<string, (input: PromptInput) => string> = {
  translate_word: ({ word, context_sentence }) =>
    `You are a professional English-Chinese dictionary. For the word "${word}" in context "${context_sentence || ""}", return accurate and complete data.

Requirements:
- translation: Natural Chinese translation of the word IN THIS CONTEXT
- word_type: part of speech (noun/verb/adj/adv/prep/conj/pronoun/etc.)
- pronunciation: IPA phonetic transcription
- affixes: break down the word into prefix, root, suffix (use "" if none)
- example_sentence: Create a NEW example sentence using this word (different from the context), with its Chinese translation
- derivatives: 2-4 related word forms (plural, tense variations, related words) with their Chinese translations

Return ONLY valid JSON (no markdown, no extra text):
{ "translation": "中文翻译", "word_type": "...", "pronunciation": "/.../", "affixes": { "prefix": "", "root": "...", "suffix": "" }, "example_sentence": { "en": "English example", "zh": "中文翻译" }, "derivatives": [{"word": "...", "type": "...", "translation": "中文"}] }`,

  translate_paragraph: ({ paragraph }) =>
    `You are a professional English-Chinese translator. Translate the following English paragraph into natural, fluent Chinese. Preserve the original meaning, tone, and paragraph structure. Use idiomatic Chinese expressions where appropriate.

Paragraph: "${paragraph}"

Return ONLY valid JSON (no markdown, no extra text):
{ "translation": "地道的中文翻译" }`,

  analyze_grammar: ({ sentence }) =>
    `Analyze the grammatical structure of this English sentence: "${sentence}"
Return JSON: {
  "sentence_type": "simple|compound|complex",
  "clauses": [
    {
      "text": "clause text",
      "type": "main|subordinate",
      "function": "declarative|interrogative|relative|adverbial|...",
      "modifiers": [{"text": "modifier", "type": "adjective|adverb|prepositional|..."}]
    }
  ],
  "structure_description": "Brief Chinese explanation of the sentence structure"
}`,

  generate_exercises: ({ title, grade_level, article_text }) =>
    `Based on the following English article, generate reading comprehension exercises.

Title: ${title}
Grade Level: ${grade_level}
Article:
${article_text}

Generate exactly:
- 3 detail questions (about specific facts in the text)
- 1 main idea question
- 2 cloze (fill-in-the-blank) questions (remove a key word, provide 4 options)
- 2 grammar fill-in-the-blank questions (test tense, prepositions, articles, etc.)

Each question must have 4 options (A, B, C, D), the correct answer, and a brief explanation in Chinese.

Return JSON: {
  "exercises": [
    { "type": "detail|main_idea|cloze|grammar", "question": "...", "options": ["A", "B", "C", "D"], "answer": "correct option text", "explanation": "Chinese explanation" }
  ]
}`,
};

export function buildPrompt(operation: string, input: PromptInput): string {
  const builder = prompts[operation];
  if (!builder) throw new Error(`Unknown operation: ${operation}`);
  return builder(input);
}

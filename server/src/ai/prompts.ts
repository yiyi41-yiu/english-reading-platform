type PromptInput = Record<string, string | undefined>;

const prompts: Record<string, (input: PromptInput) => string> = {
  translate_word: ({ word, context_sentence }) =>
    `Translate the English word "${word}" in the context of: "${context_sentence || ""}"
Return JSON: { "translation": "Chinese translation", "word_type": "noun|verb|adj|adv|prep|...", "pronunciation": "/phonetic/", "affixes": { "prefix": "or empty", "root": "root word", "suffix": "or empty" }, "derivatives": [{"word": "related word", "type": "word type", "translation": "Chinese"}] }`,

  translate_paragraph: ({ paragraph }) =>
    `Translate the following English paragraph into natural Chinese. Keep the original paragraph structure and tone.
Paragraph: "${paragraph}"
Return JSON: { "translation": "Chinese translation" }`,

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

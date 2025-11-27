/**
 * Exception thrown when a user violates language enforcement rules.
 * Used in strict language mode to signal that the user communicated in a different language
 * than the configured default language.
 */
export class LanguageViolationException extends Error {
  constructor(
    message: string,
    public readonly detectedLanguage?: string,
    public readonly expectedLanguage?: string,
  ) {
    super(message);
    this.name = 'LanguageViolationException';
  }
}

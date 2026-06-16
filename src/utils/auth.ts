import { emailExistsInTaskSheet } from './googleSheets';

/**
 * Validates if an email exists in the task sheet email column.
 * The parser supports both Doer Email and Final Doer Email style columns.
 */
export async function validateEmailInSheet(email: string): Promise<boolean> {
  return emailExistsInTaskSheet(email);
}
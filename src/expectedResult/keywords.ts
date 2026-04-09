/**
 * @fileoverview Expected Results Configuration for Action Handlers
 * @description Contains expected result strings and validation functions used by action handlers
 *              to determine if post-action validation should be performed.
 * @module expected-Result/expectedResult
 * @since 1.0.0
 */

/**
 * Supported action types for expected result validation
 */
export type ActionType =
  | 'enter'
  | 'type'
  | 'select'
  | 'click'
  | 'check'
  | 'uncheck'
  | 'upload'
  | 'download'
  | 'validate'
  | 'hover';

/**
 * Configuration object containing success keywords for each action type (all lowercase).
 * @constant {Record<ActionType, string[]>}
 */
const ACTION_SUCCESS_KEYWORDS: Record<ActionType, readonly string[]> = {
  enter: [
    'entered',
    'filled',
    'accepted',
    'submitted',
    'typed',
    'populated',
    'saved',
    'updated',
    'confirmed',
    'complete',
    'successful',
  ],
  type: ['typed'],
  select: ['selected', 'chosen', 'picked', 'set', 'changed', 'updated', 'applied', 'successful', 'selected successfully'],
  click: ['clicked', 'pressed', 'tapped', 'triggered', 'activated', 'successful'],
  check: ['checked', 'enabled', 'activated', 'selected', 'ticked', 'marked', 'successful'],
  uncheck: ['unchecked', 'disabled', 'deactivated', 'deselected', 'unticked', 'unmarked', 'cleared', 'successful'],
  upload: ['uploaded', 'attached', 'added', 'submitted', 'transferred', 'successful'],
  download: ['downloaded', 'saved', 'exported', 'retrieved', 'fetched', 'successful', 'downloaded successfully'],
  validate: ['validated', 'verified', 'confirmed', 'matched', 'passed', 'correct', 'successful'],
  hover: ['hovered', 'displayed', 'shown', 'visible', 'appeared', 'tooltip', 'revealed', 'triggered', 'successful'],
};

/**
 * Keywords indicating action should be blocked (all lowercase).
 * IMPORTANT: Checked BEFORE success keywords to handle phrases like "should not be entered".
 * @constant {Record<ActionType, string[]>}
 */
const ACTION_BLOCKED_KEYWORDS: Record<ActionType, readonly string[]> = {
  enter: [
    'not be entered',
    'not entered',
    'cannot enter',
    'unable to enter',
    'read-only',
    'readonly',
    'disabled',
    'greyed out',
    'grayed out',
    'locked',
    'inactive',
    'not allowed',
    'blocked',
    'frozen',
    'immutable',
    'not editable',
    'not fillable',
    "shouldn't be entered",
    'must not be entered',
  ],
  type: [
    'not be typed',
    'not be entered',
    'not typed',
    'cannot type',
    'unable to type',
    'read-only',
    'readonly',
    'disabled',
    'greyed out',
    'grayed out',
    'locked',
    'inactive',
    'not allowed',
    'blocked',
    'frozen',
    'immutable',
    'not editable',
    'not typable',
    "shouldn't be typed",
    'must not be typed',
  ],
  select: [
    'not selected',
    'cannot select',
    'unable to select',
    'disabled',
    'greyed out',
    'grayed out',
    'locked',
    'inactive',
    'not allowed',
    'blocked',
    'not selectable',
  ],
  click: [
    'not clicked',
    'cannot click',
    'unable to click',
    'disabled',
    'greyed out',
    'grayed out',
    'locked',
    'inactive',
    'not allowed',
    'blocked',
    'not clickable',
  ],
  check: [
    'not checked',
    'cannot check',
    'unable to check',
    'disabled',
    'greyed out',
    'grayed out',
    'locked',
    'inactive',
    'not allowed',
    'blocked',
  ],
  uncheck: [
    'not unchecked',
    'cannot uncheck',
    'unable to uncheck',
    'disabled',
    'greyed out',
    'grayed out',
    'locked',
    'inactive',
    'not allowed',
    'blocked',
  ],
  upload: ['not uploaded', 'cannot upload', 'unable to upload', 'disabled', 'not allowed', 'blocked', 'upload failed'],
  download: [
    'not downloaded',
    'cannot download',
    'unable to download',
    'disabled',
    'not allowed',
    'blocked',
    'download failed',
    'should not be downloaded',
  ],
  validate: ['not validated', 'validation failed', 'mismatch', 'incorrect', 'failed', 'not matched'],
  hover: [
    'not hovered',
    'cannot hover',
    'unable to hover',
    'not visible',
    'hidden',
    'disabled',
    'greyed out',
    'grayed out',
    'not displayed',
    'not shown',
    'blocked',
    'not hoverable',
  ],
};

/**
 * Internal helper to check if result contains any keyword from the given array.
 * @param result - The expected result string
 * @param keywords - Array of lowercase keywords to match
 * @returns True if result contains any keyword
 */
const matchesKeywords = (result: string | null | undefined, keywords: readonly string[]): boolean => {
  if (!result || typeof result !== 'string') return false;
  const lowerResult = result.toLowerCase();
  return keywords.some((keyword) => lowerResult.includes(keyword));
};

/**
 * Check if result expects action to succeed.
 * @param result - The expected result string from the test case
 * @param actionType - The type of action to check
 * @returns True if result expects the action to succeed
 */
export const expectsActionSuccess = (result: string | null | undefined, actionType: ActionType): boolean =>
  matchesKeywords(result, ACTION_SUCCESS_KEYWORDS[actionType]);

/**
 * Check if result expects action to be blocked.
 * @param result - The expected result string from the test case
 * @param actionType - The type of action to check
 * @returns True if result expects action to be blocked
 */
export const expectsActionBlocked = (result: string | null | undefined, actionType: ActionType): boolean =>
  matchesKeywords(result, ACTION_BLOCKED_KEYWORDS[actionType]);

// ============================================
// Convenience wrappers - expects action to succeed
// ============================================
export const expectsEnterSuccess = (result: string | null | undefined) => expectsActionSuccess(result, 'enter');
export const expectsTypeSuccess = (result: string | null | undefined) => expectsActionSuccess(result, 'type');
export const expectsSelectSuccess = (result: string | null | undefined) => expectsActionSuccess(result, 'select');
export const expectsClickSuccess = (result: string | null | undefined) => expectsActionSuccess(result, 'click');
export const expectsCheckSuccess = (result: string | null | undefined) => expectsActionSuccess(result, 'check');
export const expectsUncheckSuccess = (result: string | null | undefined) => expectsActionSuccess(result, 'uncheck');
export const expectsUploadSuccess = (result: string | null | undefined) => expectsActionSuccess(result, 'upload');
export const expectsDownloadSuccess = (result: string | null | undefined) => expectsActionSuccess(result, 'download');
export const expectsValidateSuccess = (result: string | null | undefined) => expectsActionSuccess(result, 'validate');
export const expectsHoverSuccess = (result: string | null | undefined) => expectsActionSuccess(result, 'hover');

// ============================================
// Convenience wrappers - expects action to be blocked
// ============================================
export const expectsEnterBlocked = (result: string | null | undefined) => expectsActionBlocked(result, 'enter');
export const expectsTypeBlocked = (result: string | null | undefined) => expectsActionBlocked(result, 'type');
export const expectsSelectBlocked = (result: string | null | undefined) => expectsActionBlocked(result, 'select');
export const expectsClickBlocked = (result: string | null | undefined) => expectsActionBlocked(result, 'click');
export const expectsCheckBlocked = (result: string | null | undefined) => expectsActionBlocked(result, 'check');
export const expectsUncheckBlocked = (result: string | null | undefined) => expectsActionBlocked(result, 'uncheck');
export const expectsUploadBlocked = (result: string | null | undefined) => expectsActionBlocked(result, 'upload');
export const expectsDownloadBlocked = (result: string | null | undefined) => expectsActionBlocked(result, 'download');
export const expectsValidateBlocked = (result: string | null | undefined) => expectsActionBlocked(result, 'validate');
export const expectsHoverBlocked = (result: string | null | undefined) => expectsActionBlocked(result, 'hover');

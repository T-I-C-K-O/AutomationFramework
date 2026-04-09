/**
 * @fileoverview Expected Results Module
 * @description Exports expected result configurations and validation functions
 *              for use across action handlers.
 * @module expected-Result
 */

export {
  // Type
  type ActionType,
  // Generic functions
  expectsActionSuccess,
  expectsActionBlocked,
  // Expects action to succeed - convenience wrappers
  expectsEnterSuccess,
  expectsTypeSuccess,
  expectsSelectSuccess,
  expectsClickSuccess,
  expectsCheckSuccess,
  expectsUncheckSuccess,
  expectsUploadSuccess,
  expectsDownloadSuccess,
  expectsValidateSuccess,
  expectsHoverSuccess,
  // Expects action to be blocked - convenience wrappers
  expectsEnterBlocked,
  expectsTypeBlocked,
  expectsSelectBlocked,
  expectsClickBlocked,
  expectsCheckBlocked,
  expectsUncheckBlocked,
  expectsUploadBlocked,
  expectsDownloadBlocked,
  expectsValidateBlocked,
  expectsHoverBlocked,
} from './keywords';

import { Page, test } from '@playwright/test';
import { sleepFor } from '../../session/utils/Promise';
import { beforeAllClean } from './setup/beforeEach';
import { newUser } from './setup/new_user';
import { openAppAndWait } from './setup/open';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  waitForTestIdWithText
} from './utilities/utils';

let window: Page;
test.beforeEach(beforeAllClean);

// test.afterEach(async () => {
//   if (window) {
//     await forceCloseAllWindows([window]);
//   }
// });
test('Create User', async () => {
  // Launch Electron app.
  window = await openAppAndWait('1');
  // // Create User
  const userA = await newUser(window, 'userA');
  // Open profile tab
  await clickOnTestIdWithText(window, 'leftpane-primary-avatar');
  await sleepFor(100, true);
  //check username matches
  await waitForTestIdWithText(window, 'your-profile-name', userA.userName);
  //check session id matches
  await waitForTestIdWithText(window, 'your-session-id', userA.sessionid);
  // exit profile module
  await window.click('.session-icon-button.small');
  // go to settings section
  await clickOnTestIdWithText(window, 'settings-section');
  // check recovery phrase matches
  await clickOnMatchingText(window, 'Recovery Phrase');
  await waitForTestIdWithText(window, 'recovery-phrase-seed-modal', userA.recoveryPhrase);
  // Exit profile module
  await window.click('.session-icon-button.small');
});

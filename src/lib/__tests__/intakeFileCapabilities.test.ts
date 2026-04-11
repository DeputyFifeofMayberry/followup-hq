import { getIntakeFileCapability, getIntakeFileInputAccept, isIntakeFileAccepted } from '../intakeFileCapabilities';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

const msg = getIntakeFileCapability('mail.msg');
assert(msg.state === 'manual_review_only', '.msg should be accepted with manual review');
assert(isIntakeFileAccepted('notes.docx'), 'docx should be accepted');
assert(isIntakeFileAccepted('legacy.doc'), 'doc should be accepted for manual review');
assert(getIntakeFileCapability('deck.pptx').state === 'manual_review_only', 'pptx should route through manual review');
assert(getIntakeFileInputAccept().includes('.msg'), 'accept list should include .msg');

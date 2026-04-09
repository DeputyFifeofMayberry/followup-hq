import { getIntakeFileCapability, getIntakeFileInputAccept, isIntakeFileAccepted } from '../intakeFileCapabilities';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

const msg = getIntakeFileCapability('mail.msg');
assert(msg.state === 'blocked', '.msg should be blocked');
assert(isIntakeFileAccepted('notes.docx'), 'docx should be accepted');
assert(!isIntakeFileAccepted('legacy.doc'), 'doc should be blocked');
assert(!getIntakeFileInputAccept().includes('.msg'), 'accept list should not include .msg');

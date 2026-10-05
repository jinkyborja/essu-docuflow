// Single source of truth for the transactional-email sender.
//
// Must be a domain verified in Resend, otherwise every send fails. Changed from
// jersondev.com to scalesite.io on 2026-08-19 (old domain retired).
export const MAIL_FROM = 'ESSU DocuFlow <noreply@scalesite.io>';
